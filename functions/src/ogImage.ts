/**
 * functions/src/ogImage.ts — Dynamic OG Image Generator
 *
 * Firebase Cloud Function (v1 onRequest) that:
 *   1. Checks Firebase Storage for a cached OG image
 *   2. If cached  → 302 redirects to the public Storage URL (Google CDN, ~50ms)
 *   3. If missing → Puppeteer screenshots the live grid page → sharp composites
 *      a bottom-to-top black gradient + avatar (clipped to user's shape) + handle
 *      → uploads PNG to Storage → 302 redirects to the new Storage URL
 *
 * Storage paths:
 *   og-images/slug/{slug}.png
 *   og-images/grid/{gridId}.png
 *
 * Query params:
 *   ?slug=matt      screenshots grids.so/matt
 *   ?gridId=abc123  screenshots grids.so/grid/abc123
 *   ?refresh=1      bypasses cache and regenerates (use after a grid update)
 *
 * Function URL (once deployed):
 *   https://us-central1-grids-one.cloudfunctions.net/generateOgImage
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import type { Request, Response } from "firebase-functions/v1";

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET_NAME = "grids-one.firebasestorage.app";
const FIRESTORE_BASE =
  "https://firestore.googleapis.com/v1/projects/grids-one/databases/(default)/documents";
const SITE_BASE = "https://grids.so";

// Must match the installed @sparticuz/chromium-min version.
// Update this URL when upgrading the package.
const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.tar";

// ─── Firestore REST helpers ───────────────────────────────────────────────────

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

function parseValue(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v)
    return (v.arrayValue.values ?? []).map((item) => parseValue(item));
  if ("mapValue" in v) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields ?? {}))
      out[k] = parseValue(val);
    return out;
  }
  return null;
}

function parseDoc(raw: {
  fields?: Record<string, FsValue>;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw.fields ?? {})) out[k] = parseValue(v);
  return out;
}

async function firestoreGet(
  collection: string,
  id: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(id)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    return parseDoc(await res.json());
  } catch {
    return null;
  }
}

// ─── Grid info resolution ─────────────────────────────────────────────────────

interface GridInfo {
  screenshotUrl: string;
  avatarUrl: string | null;
  avatarShape: "circle" | "square" | "polygon";
  avatarSides: number;
  displayName: string;
  handle: string | null;
}

async function resolveGridInfo(
  slug: string | undefined,
  gridId: string | undefined,
  screenshotBase: string
): Promise<GridInfo | null> {
  if (slug) {
    const slugDoc = await firestoreGet("slugs", slug.toLowerCase());
    if (!slugDoc) return null;

    const defaultGridId = slugDoc.defaultGridId as string | undefined;
    if (!defaultGridId) return null;

    const layoutDoc = await firestoreGet("layouts", defaultGridId);
    const tiles = (layoutDoc?.tiles ?? []) as Array<Record<string, unknown>>;
    const profileTile = tiles.find(
      (t) => (t?.content as Record<string, unknown>)?.type === "profile"
    );
    const content = (profileTile?.content ?? {}) as Record<string, unknown>;

    return {
      screenshotUrl: `${screenshotBase}/${slug}`,
      avatarUrl: (content.profilePhotoUrl as string) || null,
      avatarShape:
        (content.avatarShape as GridInfo["avatarShape"]) || "circle",
      avatarSides: (content.avatarSides as number) || 6,
      displayName: slug,
      handle: slug,
    };
  }

  if (gridId) {
    const layoutDoc = await firestoreGet("layouts", gridId);
    if (!layoutDoc) return null;

    const tiles = (layoutDoc?.tiles ?? []) as Array<Record<string, unknown>>;
    const profileTile = tiles.find(
      (t) => (t?.content as Record<string, unknown>)?.type === "profile"
    );
    const content = (profileTile?.content ?? {}) as Record<string, unknown>;

    return {
      screenshotUrl: `${screenshotBase}/grid/${gridId}`,
      avatarUrl: (content.profilePhotoUrl as string) || null,
      avatarShape:
        (content.avatarShape as GridInfo["avatarShape"]) || "circle",
      avatarSides: (content.avatarSides as number) || 6,
      displayName: (layoutDoc.name as string) || "Untitled Grid",
      handle: null,
    };
  }

  return null;
}

// ─── Avatar clip mask ─────────────────────────────────────────────────────────

function makeClipMask(
  size: number,
  shape: GridInfo["avatarShape"],
  sides: number
): Buffer {
  const r = size / 2;

  if (shape === "circle") {
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <circle cx="${r}" cy="${r}" r="${r}" fill="white"/>
      </svg>`
    );
  }

  if (shape === "polygon") {
    const n = Math.max(3, sides);
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      return `${r + r * Math.cos(a)},${r + r * Math.sin(a)}`;
    }).join(" ");
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <polygon points="${pts}" fill="white"/>
      </svg>`
    );
  }

  // square — rounded corners
  const rx = Math.round(size * 0.12);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="${rx}" ry="${rx}" fill="white"/>
    </svg>`
  );
}

// ─── SVG escape ───────────────────────────────────────────────────────────────

function svgEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Storage public URL ───────────────────────────────────────────────────────

function storageUrl(path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(path)}?alt=media`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

async function handler(req: Request, res: Response): Promise<void> {
  const slug = req.query.slug as string | undefined;
  const gridId = req.query.gridId as string | undefined;
  const refresh = req.query.refresh === "1";

  if (!slug && !gridId) {
    res.status(400).json({ error: "Provide ?slug= or ?gridId=" });
    return;
  }

  const cachePath = slug
    ? `og-images/slug/${slug}.png`
    : `og-images/grid/${gridId}.png`;

  const bucket = admin.storage().bucket(BUCKET_NAME);
  const file = bucket.file(cachePath);

  // ── 1. Serve from Storage cache if available ───────────────────────────────
  if (!refresh) {
    const [exists] = await file.exists();
    if (exists) {
      res.redirect(302, storageUrl(cachePath));
      return;
    }
  }

  // ── 2. Resolve grid/profile data ───────────────────────────────────────────
  const screenshotBase =
    (process.env.OG_SCREENSHOT_BASE_URL ?? SITE_BASE).replace(/\/$/, "");

  const info = await resolveGridInfo(slug, gridId, screenshotBase);
  if (!info) {
    res.status(404).json({ error: "Grid not found" });
    return;
  }

  // OG dimensions and avatar layout
  const W = 1200;
  const H = 630;
  const AV = 110;
  const MARGIN = 32;
  const AV_X = MARGIN;
  const AV_Y = H - AV - MARGIN;
  const TEXT_X = AV_X + AV + 20;
  const TEXT_Y_NAME = AV_Y + AV / 2;
  const TEXT_Y_HANDLE = TEXT_Y_NAME + 46;

  // ── 3. Puppeteer screenshot ────────────────────────────────────────────────
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    // In the local emulator, use a local Chrome install via PUPPETEER_EXECUTABLE_PATH.
    // In production (Linux Cloud Functions), use the @sparticuz/chromium-min binary.
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
    const executablePath = isEmulator
      ? (process.env.PUPPETEER_EXECUTABLE_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
      : await chromium.executablePath(CHROMIUM_URL);

    browser = await puppeteer.launch({
      args: isEmulator ? [] : chromium.args,
      defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();

    // Block media and fonts to speed up load
    await page.setRequestInterception(true);
    page.on("request", (intercepted) => {
      if (["media", "font"].includes(intercepted.resourceType())) {
        intercepted.abort();
      } else {
        intercepted.continue();
      }
    });

    await page.goto(info.screenshotUrl, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });

    // Wait for grid to fully render (v-else-if="gridLoaded" in UserSlugPage)
    await page.waitForSelector(".grid-container", { timeout: 20_000 });

    // Brief pause for tile images to paint
    await new Promise((r) => setTimeout(r, 1_200));

    // Hide toolbar and scrollbars for a clean shot
    await page.addStyleTag({
      content: `
        ::-webkit-scrollbar { display: none !important; }
        body { overflow: hidden !important; }
        .toolbar, [class*="toolbar"] { display: none !important; }
      `,
    });

    const screenshotBuffer = (await page.screenshot({ type: "png" })) as Buffer;
    await browser.close();
    browser = null;

    // ── 4. Composite: gradient + avatar + text ─────────────────────────────
    const composites: sharp.OverlayOptions[] = [];

    // Bottom-to-top gradient (matches Figma)
    composites.push({
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="35%" stop-color="black" stop-opacity="0"/>
              <stop offset="78%" stop-color="black" stop-opacity="0.85"/>
              <stop offset="100%" stop-color="black" stop-opacity="1"/>
            </linearGradient>
          </defs>
          <rect width="${W}" height="${H}" fill="url(#g)"/>
        </svg>
      `),
      blend: "over",
    });

    // Avatar image clipped to the user's chosen shape
    let hasAvatar = false;
    if (info.avatarUrl) {
      try {
        const avatarRes = await fetch(info.avatarUrl, {
          signal: AbortSignal.timeout(8_000),
        });
        if (avatarRes.ok) {
          const avatarData = Buffer.from(await avatarRes.arrayBuffer());
          const mask = makeClipMask(AV, info.avatarShape, info.avatarSides);

          const clippedAvatar = await sharp(avatarData)
            .resize(AV, AV, { fit: "cover", position: "centre" })
            .composite([{ input: mask, blend: "dest-in" }])
            .png()
            .toBuffer();

          composites.push({ input: clippedAvatar, top: AV_Y, left: AV_X });

          // Subtle ring around avatar
          const ringSize = AV + 4;
          composites.push({
            input: Buffer.from(`
              <svg xmlns="http://www.w3.org/2000/svg" width="${ringSize}" height="${ringSize}">
                <circle cx="${ringSize / 2}" cy="${ringSize / 2}" r="${ringSize / 2 - 1}"
                        fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
              </svg>
            `),
            top: AV_Y - 2,
            left: AV_X - 2,
          });

          hasAvatar = true;
        }
      } catch {
        // Avatar failed — continue without it
      }
    }

    // Text: display name + @handle
    const nameSize = info.displayName.length > 16 ? 52 : 72;
    const textX = hasAvatar ? TEXT_X : AV_X;
    const textY = info.handle ? TEXT_Y_NAME : AV_Y + AV / 2;

    composites.push({
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
          <text
            x="${textX}" y="${textY}"
            font-family="system-ui, -apple-system, Arial, sans-serif"
            font-size="${nameSize}" font-weight="700"
            fill="white" dominant-baseline="middle"
          >${svgEsc(info.displayName)}</text>
          ${
            info.handle
              ? `<text
              x="${textX}" y="${TEXT_Y_HANDLE}"
              font-family="system-ui, -apple-system, Arial, sans-serif"
              font-size="26" font-weight="400"
              fill="rgba(255,255,255,0.55)" dominant-baseline="middle"
            >${svgEsc(`@${info.handle}`)}</text>`
              : ""
          }
        </svg>
      `),
      blend: "over",
    });

    const finalImage = await sharp(screenshotBuffer)
      .resize(W, H, { fit: "cover" })
      .composite(composites)
      .png({ compressionLevel: 8 })
      .toBuffer();

    // ── 5. Upload to Firebase Storage ─────────────────────────────────────
    await file.save(finalImage, {
      contentType: "image/png",
      metadata: {
        cacheControl: "public, max-age=86400",
        generatedAt: new Date().toISOString(),
      },
    });

    functions.logger.info(`[og] generated and cached: ${cachePath}`);

    // ── 6. Redirect to the now-cached Storage URL ──────────────────────────
    res.redirect(302, storageUrl(cachePath));
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
    functions.logger.error("[og] generation failed:", err);
    res.status(500).json({ error: "OG image generation failed" });
  }
}

// Export as a v1 onRequest function with boosted memory for Chromium
export const generateOgImage = functions
  .runWith({ memory: "2GB", timeoutSeconds: 60 })
  .https.onRequest(handler);
