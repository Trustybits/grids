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
  displayName: string;   // used in "hey, I'm [displayName]"
  handle: string | null; // used for "grids.so/[handle]" link
  subtitle: string | null; // role/title shown below the name
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

    // Try common field names for the job title / role subtitle
    const subtitle =
      (content.title as string) ||
      (content.jobTitle as string) ||
      (content.subtitle as string) ||
      (content.tagline as string) ||
      null;

    return {
      screenshotUrl: `${screenshotBase}/${slug}`,
      avatarUrl: (content.profilePhotoUrl as string) || null,
      avatarShape:
        (content.avatarShape as GridInfo["avatarShape"]) || "circle",
      avatarSides: (content.avatarSides as number) || 6,
      displayName: slug,
      handle: slug,
      subtitle,
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

    const subtitle =
      (content.title as string) ||
      (content.jobTitle as string) ||
      (content.subtitle as string) ||
      (content.tagline as string) ||
      null;

    return {
      screenshotUrl: `${screenshotBase}/grid/${gridId}`,
      avatarUrl: (content.profilePhotoUrl as string) || null,
      avatarShape:
        (content.avatarShape as GridInfo["avatarShape"]) || "circle",
      avatarSides: (content.avatarSides as number) || 6,
      displayName: (layoutDoc.name as string) || "Untitled Grid",
      handle: null,
      subtitle,
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
  // Skip cache entirely in the local emulator — no Storage credentials, always regenerate.
  const isEmulatorEnv = process.env.FUNCTIONS_EMULATOR === "true";
  if (!refresh && !isEmulatorEnv) {
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

  // OG output dimensions (standard 1200×630)
  const W = 1200;
  const H = 630;

  // Screenshot viewport — larger to capture the full desktop tile layout.
  // sharp will crop/resize down to W×H for the final OG image.
  const SW = 1524;
  const SH = 800;

  // ── Layout constants (proportionally scaled from the Figma 1524×940 frame) ──
  const PAD_X = 64;   // left padding inside panel
  const PAD_Y = 52;   // top padding

  const AV = 130;     // avatar diameter (square bounding box)
  const AV_X = PAD_X;
  const AV_Y = PAD_Y;

  // Text block sits below avatar
  const TEXT_X = PAD_X;
  const NAME_Y = AV_Y + AV + 36;  // ~218px — below avatar with gap

  // Bottom link row ("grids.so/slug")
  const LINK_Y = H - 48;          // ~582px vertical center
  const ICON_SZ = 32;             // grids.so icon size
  const LINK_X = PAD_X + ICON_SZ + 14; // text starts after icon + gap

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
      defaultViewport: { width: SW, height: SH, deviceScaleFactor: 1 },
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

    // Remove all UI chrome (nav, toolbar, buttons) directly from the DOM.
    // CSS class-name guessing is unreliable with Vue scoped styles — DOM removal always works.
    await page.evaluate(() => {
      const grid = document.querySelector(".grid-container");

      // Remove any element that is NOT an ancestor or descendant of the grid
      const toRemove: Element[] = [];
      document.body.querySelectorAll("*").forEach((el) => {
        if (grid && (grid.contains(el) || el.contains(grid))) return;
        const tag = el.tagName.toLowerCase();
        if (
          tag === "nav" ||
          tag === "header" ||
          tag === "button" ||
          tag === "aside" ||
          (tag === "div" &&
            Array.from(el.classList).some((c) =>
              /toolbar|appbar|navbar|topbar|top-bar|nav-bar|action-bar|actionbar|sidebar/.test(c)
            ))
        ) {
          toRemove.push(el);
        }
      });
      toRemove.forEach((el) => el.remove());

      // Suppress scrollbars and overflow
      document.body.style.overflow = "hidden";
      document.body.style.margin = "0";
    });

    // Also inject scrollbar suppression via style (belt-and-suspenders)
    await page.addStyleTag({
      content: `::-webkit-scrollbar { display: none !important; } body { overflow: hidden !important; margin: 0 !important; }`,
    });

    // Wait for tile images and avatar to fully paint.
    // First, wait for all <img> elements inside the grid to either load or error.
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.querySelectorAll(".grid-container img")).map(
          (img) =>
            (img as HTMLImageElement).complete
              ? Promise.resolve()
              : new Promise((r) => {
                  img.addEventListener("load", r, { once: true });
                  img.addEventListener("error", r, { once: true });
                })
        )
      )
    );

    // Extra paint buffer for CSS transitions and lazy-loaded content
    await new Promise((r) => setTimeout(r, 2_000));

    const screenshotBuffer = (await page.screenshot({ type: "png" })) as Buffer;
    await browser.close();
    browser = null;

    // ── 4. Composite layers (Figma node 2737-15887) ────────────────────────────
    const composites: sharp.OverlayOptions[] = [];

    // ── Layer A: left panel — solid dark base fading right into the grid ──────
    // Matches: meta_content (#10100e bg) + gradient_background blur overlay
    composites.push({
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
          <defs>
            <linearGradient id="lp" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stop-color="#10100e" stop-opacity="1"/>
              <stop offset="38%"  stop-color="#10100e" stop-opacity="1"/>
              <stop offset="52%"  stop-color="#10100e" stop-opacity="0.88"/>
              <stop offset="65%"  stop-color="#10100e" stop-opacity="0.45"/>
              <stop offset="78%"  stop-color="#10100e" stop-opacity="0.1"/>
              <stop offset="88%"  stop-color="#10100e" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <rect width="${W}" height="${H}" fill="url(#lp)"/>
        </svg>
      `),
      blend: "over",
    });

    // ── Layer B: bottom gradient overlay (opacity 55%, fades to black) ────────
    // Matches: gradient overlay div, top ~47% of canvas, fading to black
    const gradTop = Math.round(H * 0.47);
    composites.push({
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
          <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stop-color="black" stop-opacity="0"/>
              <stop offset="100%" stop-color="black" stop-opacity="0.55"/>
            </linearGradient>
          </defs>
          <rect y="${gradTop}" width="${W}" height="${H - gradTop}" fill="url(#bg)"/>
        </svg>
      `),
      blend: "over",
    });

    // ── Layer C: avatar clipped to the user's shape ───────────────────────────
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
        }
      } catch {
        // Avatar failed — continue without it
      }
    }

    // ── Layer D: text (greeting + subtitle + bottom link) ─────────────────────
    // "hey, I'm [name]" greeting — scale font to fit within the panel
    const greeting = info.handle ? `hey, I'm ${info.displayName}` : info.displayName;
    const greetingSize = Math.min(56, Math.max(32, Math.floor(56 * 13 / greeting.length)));
    const subSize = 19;
    const linkSize = 20;

    // Grids.so icon SVG (3×3 grid on cream background, matching Figma)
    const iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SZ}" height="${ICON_SZ}">
        <rect width="${ICON_SZ}" height="${ICON_SZ}" rx="${Math.round(ICON_SZ * 0.133)}" fill="#FEFDEC"/>
        <line x1="${ICON_SZ*0.333}" y1="0" x2="${ICON_SZ*0.333}" y2="${ICON_SZ}" stroke="rgba(16,16,14,0.5)" stroke-width="1"/>
        <line x1="${ICON_SZ*0.667}" y1="0" x2="${ICON_SZ*0.667}" y2="${ICON_SZ}" stroke="rgba(16,16,14,0.5)" stroke-width="1"/>
        <line x1="0" y1="${ICON_SZ*0.333}" x2="${ICON_SZ}" y2="${ICON_SZ*0.333}" stroke="rgba(16,16,14,0.5)" stroke-width="1"/>
        <line x1="0" y1="${ICON_SZ*0.667}" x2="${ICON_SZ}" y2="${ICON_SZ*0.667}" stroke="rgba(16,16,14,0.5)" stroke-width="1"/>
      </svg>`;

    composites.push({
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
          <!-- "hey, I'm [name]" -->
          <text
            x="${TEXT_X}" y="${NAME_Y}"
            font-family="Arial, Liberation Sans, sans-serif"
            font-size="${greetingSize}" font-weight="700"
            fill="white" dominant-baseline="auto"
          >${svgEsc(greeting)}</text>

          ${info.subtitle ? `
          <!-- Role / subtitle -->
          <text
            x="${TEXT_X}" y="${NAME_Y + greetingSize + 14}"
            font-family="Arial, Liberation Sans, sans-serif"
            font-size="${subSize}" font-weight="400"
            fill="rgba(255,255,255,0.34)"
            letter-spacing="2"
            dominant-baseline="auto"
          >${svgEsc(info.subtitle.toUpperCase())}</text>` : ""}

          ${info.handle ? `
          <!-- grids.so/[handle] text -->
          <text
            x="${LINK_X}" y="${LINK_Y}"
            font-family="Arial, Liberation Sans, sans-serif"
            font-size="${linkSize}" font-weight="700"
            fill="rgba(255,255,255,0.76)"
            dominant-baseline="middle"
          >${svgEsc(`grids.so/${info.handle}`)}</text>` : ""}
        </svg>
      `),
      blend: "over",
    });

    // ── Layer E: grids.so icon (composited separately to stay crisp) ─────────
    if (info.handle) {
      composites.push({
        input: Buffer.from(iconSvg),
        top: LINK_Y - Math.round(ICON_SZ / 2),
        left: PAD_X,
      });
    }

    const finalImage = await sharp(screenshotBuffer)
      .resize(W, H, { fit: "cover" })
      .composite(composites)
      .png({ compressionLevel: 8 })
      .toBuffer();

    // ── 5. Upload to Firebase Storage (skipped in local emulator) ────────────
    const isEmulatorEnv = process.env.FUNCTIONS_EMULATOR === "true";

    if (isEmulatorEnv) {
      // Local dev: stream the image directly — no Storage credentials available
      functions.logger.info(`[og] emulator mode — streaming image directly for: ${cachePath}`);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      res.end(finalImage);
      return;
    }

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
