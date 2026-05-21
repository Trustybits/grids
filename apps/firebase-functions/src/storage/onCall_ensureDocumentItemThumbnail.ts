import { HttpsError } from "firebase-functions/v1/https";
import { randomUUID } from "node:crypto";
import * as functions from "firebase-functions/v1";
import admin from "firebase-admin";
import sharp from "sharp";

// v147.0.0 has no pack assets on GitHub releases; using v143.0.4 (last confirmed stable).
// Firebase Functions run on Linux x86_64 → use the .x64.tar variant (added in v127+).
// Update this URL when upgrading @sparticuz/chromium-min.
const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

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

type LayoutTileRecord = {
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
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chromium: any = (await import("@sparticuz/chromium-min")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puppeteer: any = (await import("puppeteer-core")).default;

  const executablePath = isEmulator
    ? (process.env.PUPPETEER_EXECUTABLE_PATH ??
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
    : await chromium.executablePath(CHROMIUM_URL);

  const browser = await puppeteer.launch({
    args: isEmulator ? [] : chromium.args,
    defaultViewport: { width: 920, height: 1180, deviceScaleFactor: 1 },
    executablePath,
    headless: true,
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
    if (!context.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const layoutId = typeof data?.layoutId === "string" ? data.layoutId : "";
    const tileId = typeof data?.tileId === "string" ? data.tileId : "";
    const itemId = typeof data?.itemId === "string" ? data.itemId : "";

    if (!layoutId || !tileId || !itemId) {
      throw new HttpsError(
        "invalid-argument",
        "layoutId, tileId, and itemId are required.",
      );
    }

    const uid = context.auth.uid;
    const db = admin.firestore();
    const layoutRef = db.collection("layouts").doc(layoutId);

    const layoutSnap = await layoutRef.get();
    if (!layoutSnap.exists) {
      throw new HttpsError("not-found", "Layout not found.");
    }

    const layout = layoutSnap.data();
    if (!layout) {
      throw new HttpsError("not-found", "Layout has no data.");
    }
    if (layout.userId !== uid) {
      throw new HttpsError("permission-denied", "You do not own this layout.");
    }

    const tiles = layout.tiles as LayoutTileRecord[] | undefined;
    if (!Array.isArray(tiles)) {
      throw new HttpsError("failed-precondition", "Layout has no tiles.");
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

    const thumbnailUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
      `${encodeURIComponent(thumbPath)}?alt=media&token=${token}`;

    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(layoutRef);
      if (!fresh.exists) {
        throw new HttpsError("not-found", "Layout disappeared during update.");
      }
      const d = fresh.data();
      if (!d) {
        throw new HttpsError("not-found", "Layout disappeared during update.");
      }
      if (d.userId !== uid) {
        throw new HttpsError("permission-denied", "Ownership changed.");
      }
      const nextTiles = (d.tiles as LayoutTileRecord[]).map((t) => {
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
      tx.update(layoutRef, { tiles: nextTiles });
    });

    functions.logger.info("[doc-thumb] stored", {
      layoutId,
      tileId,
      itemId,
      thumbPath,
    });

    return { thumbnailUrl };
  });
