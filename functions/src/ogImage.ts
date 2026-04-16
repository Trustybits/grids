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

// ─── TipTap rich-text → plain text ───────────────────────────────────────────
// Profile tile fields (name, title, bio) are stored as serialised TipTap JSON.
// Walk the doc tree and concatenate every leaf text node.

function extractTiptapText(raw: unknown): string {
  if (typeof raw === "string") {
    try {
      return extractTiptapText(JSON.parse(raw));
    } catch {
      return raw.trim(); // already plain text
    }
  }
  if (!raw || typeof raw !== "object") return "";
  const node = raw as Record<string, unknown>;
  if (typeof node.text === "string") return node.text;
  const children = (node.content as unknown[]) ?? [];
  return children
    .map((c) => extractTiptapText(c))
    .join("")
    .trim();
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

    // name and title are stored as TipTap JSON — extract plain text
    const displayName =
      extractTiptapText(content.name) || slug;
    const subtitle =
      extractTiptapText(content.title) || null;

    return {
      screenshotUrl: `${screenshotBase}/${slug}`,
      avatarUrl: (content.profilePhotoUrl as string) || null,
      avatarShape:
        (content.avatarShape as GridInfo["avatarShape"]) || "circle",
      avatarSides: (content.avatarSides as number) || 6,
      displayName,
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

    const displayName =
      extractTiptapText(content.name) ||
      (layoutDoc.name as string) ||
      "Untitled Grid";
    const subtitle =
      extractTiptapText(content.title) || null;

    return {
      screenshotUrl: `${screenshotBase}/grid/${gridId}`,
      avatarUrl: (content.profilePhotoUrl as string) || null,
      avatarShape:
        (content.avatarShape as GridInfo["avatarShape"]) || "circle",
      avatarSides: (content.avatarSides as number) || 6,
      displayName,
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

  // ── Screenshot viewport matches the Figma source frame exactly ──────────────
  // Figma frame: 1524×940. Screenshot taken at this size, then the grid portion
  // is resized to 1240×765 and positioned at (470, 93) within the OG canvas.
  const SW = 1524;
  const SH = 940;

  // ── Layout constants — all scaled from Figma (1524×940) → OG (1200×630) ────
  const scaleX = W / 1524;   // 0.787
  const scaleY = H / 940;    // 0.670

  // Grid screenshot: resized from SW×SH → proportional size within OG canvas
  const GRID_W = Math.round(1240 * scaleX);  // ~976
  const GRID_H = Math.round(765 * scaleY);   // ~513
  const GRID_X = Math.round(470 * scaleX);   // ~370
  const GRID_Y = Math.round(93 * scaleY);    // ~62

  // Left panel padding and avatar
  const PAD_X = Math.round(96 * scaleX);     // ~76 → use 72
  const PAD_Y = Math.round(96 * scaleY);     // ~64
  const AV    = Math.round(198 * scaleX);    // ~156 → avatar size (square)
  const AV_X  = PAD_X;
  const AV_Y  = PAD_Y;

  // Text: sits below avatar with the same gap as Figma
  const TEXT_X  = PAD_X;
  const NAME_Y  = AV_Y + AV + Math.round(64 * scaleY);  // ~282
  const SUB_Y   = NAME_Y + Math.round(76 * scaleY);      // subtitle below name

  // Bottom link row
  const LINK_Y   = H - Math.round(96 * scaleY);          // ~567 center
  const ICON_SZ  = Math.round(48 * scaleX);              // ~38
  const LINK_X   = PAD_X + ICON_SZ + Math.round(24 * scaleX); // text after icon

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

    // Transparent background so tile drop-shadows render naturally when the
    // screenshot is composited over the dark OG canvas.
    await page.evaluate(() => {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    });

    const screenshotBuffer = (await page.screenshot({
      type: "png",
      omitBackground: true,
    })) as Buffer;
    await browser.close();
    browser = null;

    // ── 4. Composite layers (Figma node 2737-15887) ────────────────────────────
    //
    // Layer order (bottom → top):
    //   A  Dark background (#10100e canvas)
    //   B  Grid screenshot — resized & positioned per Figma
    //   C  Left panel gradient — solid dark left, fades right into grid
    //   D  Bottom gradient overlay — fades bottom half to near-black
    //   E  Avatar — clipped to user's shape
    //   F  Text — "hey, I'm [Name]", subtitle, grids.so/handle
    //   G  Grids app icon — fetched from grids.so/favicon.png

    const composites: sharp.OverlayOptions[] = [];

    // ── Layer B: grid screenshot, resized & positioned ────────────────────────
    const gridBuf = await sharp(screenshotBuffer)
      .resize(GRID_W, GRID_H, { fit: "fill" })
      .toBuffer();
    composites.push({ input: gridBuf, top: GRID_Y, left: GRID_X });

    // ── Layer C: left panel — solid dark, fades right into grid ──────────────
    // Matches Figma's meta_content (#10100e) + gradient_background (blurred fade)
    composites.push({
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
          <defs>
            <linearGradient id="lp" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stop-color="#10100e" stop-opacity="1"/>
              <stop offset="40%"  stop-color="#10100e" stop-opacity="1"/>
              <stop offset="55%"  stop-color="#10100e" stop-opacity="0.85"/>
              <stop offset="68%"  stop-color="#10100e" stop-opacity="0.4"/>
              <stop offset="80%"  stop-color="#10100e" stop-opacity="0.05"/>
              <stop offset="88%"  stop-color="#10100e" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <rect width="${W}" height="${H}" fill="url(#lp)"/>
        </svg>
      `),
      blend: "over",
    });

    // ── Layer D: bottom gradient overlay (Figma: opacity 55%, fades to black) ─
    const gradTop = Math.round(H * (446 / 940)); // ~299px
    composites.push({
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
          <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stop-color="black" stop-opacity="0"/>
              <stop offset="83%"  stop-color="black" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="black" stop-opacity="0.55"/>
            </linearGradient>
          </defs>
          <rect y="${gradTop}" width="${W}" height="${H - gradTop}" fill="url(#bg)"/>
        </svg>
      `),
      blend: "over",
    });

    // ── Layer E: avatar clipped to user's chosen shape ────────────────────────
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

    // ── Layer F: text ─────────────────────────────────────────────────────────
    // "hey, I'm [Name]" — font scales to keep it within the left panel width
    const greeting = info.handle ? `hey, I'm ${info.displayName}` : info.displayName;
    const panelTextW = Math.round(663 * scaleX) - PAD_X; // available text width
    const greetingSize = Math.min(
      Math.round(76 * scaleX),  // Figma max: 76px scaled
      Math.max(28, Math.floor(panelTextW / (greeting.length * 0.52)))
    );
    const subSize    = Math.round(32 * scaleX);  // ~25px
    const linkSize   = Math.round(32 * scaleX);  // ~25px

    composites.push({
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
          <text
            x="${TEXT_X}" y="${NAME_Y}"
            font-family="Arial, Liberation Sans, sans-serif"
            font-size="${greetingSize}" font-weight="700"
            fill="white"
          >${svgEsc(greeting)}</text>

          ${info.subtitle ? `<text
            x="${TEXT_X}" y="${SUB_Y}"
            font-family="Arial, Liberation Sans, sans-serif"
            font-size="${subSize}" font-weight="700"
            fill="rgba(255,255,255,0.34)"
            letter-spacing="${Math.round(subSize * 0.1)}"
          >${svgEsc(info.subtitle.toUpperCase())}</text>` : ""}

          ${info.handle ? `<text
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

    // ── Layer G: Grids app icon (favicon.png) ─────────────────────────────────
    if (info.handle) {
      try {
        const iconRes = await fetch("https://grids.so/favicon.png", {
          signal: AbortSignal.timeout(5_000),
        });
        if (iconRes.ok) {
          const iconBuf = await sharp(Buffer.from(await iconRes.arrayBuffer()))
            .resize(ICON_SZ, ICON_SZ, { fit: "fill" })
            .png()
            .toBuffer();
          composites.push({
            input: iconBuf,
            top: LINK_Y - Math.round(ICON_SZ / 2),
            left: PAD_X,
          });
        }
      } catch {
        // Icon fetch failed — link text still shows without it
      }
    }

    // ── Assemble: dark background + all layers ────────────────────────────────
    const finalImage = await sharp({
      create: { width: W, height: H, channels: 3, background: { r: 16, g: 16, b: 14 } },
    })
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
