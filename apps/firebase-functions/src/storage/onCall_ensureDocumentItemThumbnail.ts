import { HttpsError } from "firebase-functions/v1/https";
import { randomUUID } from "node:crypto";
import * as functions from "firebase-functions/v1";
import admin from "firebase-admin";
import sharp from "sharp";
import { noopIfMaintenance } from "../maintenance.js";
import { requireAuth, requireStringFields } from "../shared/utils_callable.js";
import { launchChromiumBrowser } from "./utils_browser.js";
import { buildStorageDownloadUrl } from "./utils_storageDownloadUrl.js";

// ─── Document stack: PDF page-1 thumbnail (callable) ────────────────────────

type DocumentItemRecord = {
  id: string;
  fileName: string;
  url: string;
  mimeType?: string;
  thumbnailUrl?: string;
};

type DocumentContentRecord = {
  type: string;
  items?: DocumentItemRecord[];
};

type GridTileRecord = {
  i: string;
  content: DocumentContentRecord | { type: string };
};

function parseStorageObjectPathFromDownloadUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("firebasestorage")) return null;
    const parts = u.pathname.split("/o/");
    if (parts.length < 2) return null;
    const encoded = parts[1];
    if (!encoded) return null;
    return decodeURIComponent(encoded.split("?")[0] || encoded);
  } catch {
    return null;
  }
}

function isPdfDocumentItem(fileName: string, mime?: string): boolean {
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf")) return true;
  const i = fileName.lastIndexOf(".");
  const e = i >= 0 ? fileName.slice(i + 1).toLowerCase() : "";
  return e === "pdf";
}

async function renderPdfFirstPagePng(pdfSignedUrl: string): Promise<Buffer> {
  const browser = await launchChromiumBrowser({
    width: 920,
    height: 1180,
    deviceScaleFactor: 1,
  });

  try {
    const page = await browser.newPage();
    await page.goto(pdfSignedUrl, { waitUntil: "load", timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 900));
    const buf = (await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 920, height: 1180 },
    })) as Buffer;
    return buf;
  } finally {
    await browser.close();
  }
}

export const ensureDocumentItemThumbnail = functions
  .runWith({ memory: "1GB", timeoutSeconds: 120 })
  .https.onCall(async (data, context) => {
    if (noopIfMaintenance("ensureDocumentItemThumbnail")) return null;

    const uid = requireAuth(context, "Sign in required.");
    const { gridId, tileId, itemId } = requireStringFields(
      data,
      ["gridId", "tileId", "itemId"],
      "gridId, tileId, and itemId are required.",
    );
    const db = admin.firestore();
    const gridRef = db.collection("grids").doc(gridId);

    const gridSnap = await gridRef.get();
    if (!gridSnap.exists) {
      throw new HttpsError("not-found", "Grid not found.");
    }

    const grid = gridSnap.data();
    if (!grid) {
      throw new HttpsError("not-found", "Grid has no data.");
    }
    if (grid.userId !== uid) {
      throw new HttpsError("permission-denied", "You do not own this grid.");
    }

    const tiles = grid.tiles as GridTileRecord[] | undefined;
    if (!Array.isArray(tiles)) {
      throw new HttpsError("failed-precondition", "Grid has no tiles.");
    }

    const tile = tiles.find((t) => t.i === tileId);
    if (!tile || (tile.content as { type?: string }).type !== "document") {
      throw new HttpsError("not-found", "Document tile not found.");
    }

    const content = tile.content as DocumentContentRecord;
    const items = content.items;
    if (!Array.isArray(items)) {
      throw new HttpsError("not-found", "No document items.");
    }

    const item = items.find((it) => it.id === itemId);
    if (!item?.url || typeof item.url !== "string") {
      throw new HttpsError("not-found", "Document item not found.");
    }

    if (item.thumbnailUrl && item.thumbnailUrl.startsWith("http")) {
      return { thumbnailUrl: item.thumbnailUrl, cached: true };
    }

    if (!isPdfDocumentItem(item.fileName, item.mimeType)) {
      return { skipped: true as const };
    }

    const objectPath = parseStorageObjectPathFromDownloadUrl(item.url);
    if (!objectPath) {
      throw new HttpsError(
        "failed-precondition",
        "Could not parse storage path from file URL.",
      );
    }

    const bucket = admin.storage().bucket();
    const [signedUrl] = await bucket.file(objectPath).getSignedUrl({
      action: "read",
      expires: Date.now() + 10 * 60 * 1000,
    });

    let rawPng: Buffer;
    try {
      rawPng = await renderPdfFirstPagePng(signedUrl);
    } catch (err) {
      functions.logger.error("[doc-thumb] puppeteer render failed:", err);
      throw new HttpsError("internal", "Failed to render PDF thumbnail.");
    }

    const pngBuffer = await sharp(rawPng)
      .resize({
        width: 520,
        height: 720,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const token = randomUUID();
    const thumbPath = `thumbnails/documents/${uid}/${itemId}.png`;

    await bucket.file(thumbPath).save(pngBuffer, {
      contentType: "image/png",
      metadata: {
        cacheControl: "public, max-age=604800",
        metadata: {
          published: "true",
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const thumbnailUrl = buildStorageDownloadUrl(bucket.name, thumbPath, token);

    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(gridRef);
      if (!fresh.exists) {
        throw new HttpsError("not-found", "Grid disappeared during update.");
      }
      const d = fresh.data();
      if (!d) {
        throw new HttpsError("not-found", "Grid disappeared during update.");
      }
      if (d.userId !== uid) {
        throw new HttpsError("permission-denied", "Ownership changed.");
      }
      const nextTiles = (d.tiles as GridTileRecord[]).map((t) => {
        if (t.i !== tileId) return t;
        const c = t.content as DocumentContentRecord;
        if (c.type !== "document" || !Array.isArray(c.items)) return t;
        const nextItems = c.items.map((it) =>
          it.id === itemId ? { ...it, thumbnailUrl } : it,
        );
        return {
          ...t,
          content: { ...c, items: nextItems },
        };
      });
      tx.update(gridRef, { tiles: nextTiles });
    });

    functions.logger.info("[doc-thumb] stored", {
      gridId,
      tileId,
      itemId,
      thumbPath,
    });

    return { thumbnailUrl };
  });
