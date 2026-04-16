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

// Grids icon — pre-rasterised from the brand SVG so no runtime SVG rendering needed.
// Generated from: functions/src/assets/grids-icon.svg → 96×96 PNG → base64
const GRIDS_ICON_B64 =
  "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";

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
  displayName: string;   // shown directly as the name (no greeting prefix)
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

// ─── Rounded polygon SVG path ─────────────────────────────────────────────────
// Builds a closed SVG path for a regular n-gon whose corners are rounded with
// quadratic bézier curves.  cornerRadius is clamped so it never exceeds half
// the edge length (which would distort the shape).

function roundedPolygonPath(
  cx: number,
  cy: number,
  radius: number,
  n: number,
  cornerRadius: number
): string {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  });

  let d = "";
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];

    const in0 = { x: p0.x - p1.x, y: p0.y - p1.y };
    const in2 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const len0 = Math.hypot(in0.x, in0.y);
    const len2 = Math.hypot(in2.x, in2.y);

    const cr = Math.min(cornerRadius, len0 / 2, len2 / 2);
    const start = { x: p1.x + (in0.x / len0) * cr, y: p1.y + (in0.y / len0) * cr };
    const end   = { x: p1.x + (in2.x / len2) * cr, y: p1.y + (in2.y / len2) * cr };

    if (i === 0) {
      d += `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
    } else {
      d += ` L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
    }
    d += ` Q ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }
  d += " Z";
  return d;
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
    // Corner radius: 16px minimum (scaled to avatar size), capped at ~18% of radius
    const cornerRadius = Math.max(16, Math.round(r * 0.18));
    const pathD = roundedPolygonPath(r, r, r, n, cornerRadius);
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <path d="${pathD}" fill="white"/>
      </svg>`
    );
  }

  // square — rounded corners (~12% of size, minimum 16px)
  const rx = Math.max(16, Math.round(size * 0.12));
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

// ─── Desktop thumbnail cache helper ──────────────────────────────────────────
// Returns the stored desktop thumbnail buffer from Firebase Storage, or null if
// it hasn't been generated yet.  Using this avoids launching Chromium for the OG
// composite when a fresh screenshot already exists (written by generateThumbnail).

async function fetchDesktopThumbnail(
  slug: string | undefined,
  gridId: string | undefined,
  bucket: ReturnType<ReturnType<typeof admin.storage>["bucket"]>
): Promise<Buffer | null> {
  try {
    const thumbPath = slug
      ? `thumbnails/slug/${slug}/desktop.png`
      : `thumbnails/grid/${gridId}/desktop.png`;
    const thumbFile = bucket.file(thumbPath);
    const [exists] = await thumbFile.exists();
    if (!exists) return null;
    const [data] = await thumbFile.download();
    return data as Buffer;
  } catch {
    return null;
  }
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

  // Grid screenshot: resized from SW×SH → preserve exact viewport AR within OG canvas.
  // GRID_H is derived from GRID_W * (SH/SW) so there is zero distortion regardless of
  // whether we use the stored thumbnail or a fresh Puppeteer screenshot.
  const GRID_W = Math.round(1240 * scaleX);          // ~976
  const GRID_H = Math.round(GRID_W * SH / SW);       // ~602 — natural AR (was wrong ~513)
  const GRID_X = Math.round(320 * scaleX);            // ~370
  const GRID_Y = 0;                                  // 48px from top (per design)

  // Left panel padding and avatar
  const PAD_X = Math.round(96 * scaleX);     // ~76 → use 72
  const PAD_Y = Math.round(96 * scaleY);     // ~64
  const AV    = Math.round(198 * scaleX);    // ~156 → avatar size (square)
  const AV_X  = PAD_X;
  const AV_Y  = PAD_Y;

  // Text: sits below avatar — Figma gap (64px) + user-requested 64px extra offset
  const TEXT_X  = PAD_X;
  const NAME_Y  = AV_Y + AV + Math.round(64 * scaleY) + 64;  // avatar bottom + gap + extra
  const SUB_Y   = NAME_Y + Math.round(76 * scaleY);           // subtitle below name

  // Bottom link row
  const LINK_Y   = H - Math.round(96 * scaleY);          // ~567 center
  const ICON_SZ  = Math.round(48 * scaleX);              // ~38
  const LINK_X   = PAD_X + ICON_SZ + Math.round(24 * scaleX); // text after icon

  // ── 3. Acquire grid screenshot ────────────────────────────────────────────
  // Prefer the stored desktop thumbnail — it's the same 1524×940 viewport we'd
  // screenshot anyway, so reusing it avoids launching Chromium entirely.
  // Falls back to a live Puppeteer screenshot when no thumbnail is cached yet.
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    let screenshotBuffer: Buffer | null = null;

    if (!isEmulatorEnv) {
      screenshotBuffer = await fetchDesktopThumbnail(slug, gridId, bucket);
      if (screenshotBuffer) {
        functions.logger.info("[og] reusing stored desktop thumbnail — skipping Chromium");
      }
    }

    if (!screenshotBuffer) {
      // No cached thumbnail — launch Puppeteer for a fresh screenshot.
      const executablePath = isEmulatorEnv
        ? (process.env.PUPPETEER_EXECUTABLE_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
        : await chromium.executablePath(CHROMIUM_URL);

      browser = await puppeteer.launch({
        args: isEmulatorEnv ? [] : chromium.args,
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

      // Remove all UI chrome via path-trimming — walk from .grid-container up to
      // <body> and at each level remove all siblings of the current node.
      await page.evaluate(() => {
        document.querySelectorAll(
          "#vue-devtools-anchor, #vite-plugin-vue-devtools, #__vite-plugin-vue-devtools, [id*='devtools'], [class*='devtools']"
        ).forEach((el) => el.remove());

        const grid = document.querySelector(".grid-container");
        if (!grid) return;

        let node: Element | null = grid;
        while (node && node !== document.body) {
          const parent: HTMLElement | null = node.parentElement;
          if (parent) {
            (Array.from(parent.children) as Element[]).forEach((sibling) => {
              if (sibling !== node) sibling.remove();
            });
          }
          node = parent as Element | null;
        }

        document.body.style.overflow = "hidden";
        document.body.style.margin = "0";
      });

      await page.addStyleTag({
        content: `::-webkit-scrollbar { display: none !important; } body { overflow: hidden !important; margin: 0 !important; }`,
      });

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

      await new Promise((r) => setTimeout(r, 2_000));

      await page.evaluate(() => {
        document.documentElement.style.background = "transparent";
        document.body.style.background = "transparent";
      });

      screenshotBuffer = (await page.screenshot({
        type: "png",
        omitBackground: true,
      })) as Buffer;
      await browser.close();
      browser = null;
    }

    // ── 4. Composite layers (Figma node 2737-15887) ────────────────────────────
    //
    // Layer order (bottom → top):
    //   A  Dark background (#10100e canvas)
    //   B  Grid screenshot — resized & positioned per Figma
    //   C  Left panel gradient — solid dark left, fades right into grid
    //   D  Bottom gradient overlay — fades bottom half to near-black
    //   E  Avatar — clipped to user's shape
    //   F  Text — [Name], subtitle, grids.so/handle
    //   G  Grids brand icon — embedded base64 PNG

    const composites: sharp.OverlayOptions[] = [];

    // ── Layer B: grid screenshot, resized to natural AR and positioned ─────────
    // screenshotBuffer is always non-null here (set above via thumbnail or Puppeteer)
    const gridBuf = await sharp(screenshotBuffer as Buffer)
      .resize(GRID_W, GRID_H, { fit: "fill" })
      .toBuffer();
    composites.push({ input: gridBuf, top: GRID_Y, left: GRID_X });

    // ── Layer C: left panel — solid black, fades right into grid ─────────────
    // Matches Figma meta_content (tile_background: black) + gradient fade
    composites.push({
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
          <defs>
            <linearGradient id="lp" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stop-color="black" stop-opacity="1"/>
              <stop offset="30%"  stop-color="black" stop-opacity="1"/>
              <stop offset="50%"  stop-color="black" stop-opacity="0.85"/>
              <stop offset="55%"  stop-color="black" stop-opacity="0.4"/>
              <stop offset="60%"  stop-color="black" stop-opacity="0.05"/>
              <stop offset="65%"  stop-color="black" stop-opacity="0"/>
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
    // Display name only — no "hey, I'm" prefix
    const displayText = info.displayName;
    const panelTextW = Math.round(663 * scaleX) - PAD_X; // available text width
    const nameSize = Math.min(
      Math.round(76 * scaleX),  // Figma max: 76px scaled
      Math.max(28, Math.floor(panelTextW / (displayText.length * 0.52)))
    );
    const subSize    = Math.round(32 * scaleX);  // ~25px
    const linkSize   = Math.round(32 * scaleX);  // ~25px

    composites.push({
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
          <text
            x="${TEXT_X}" y="${NAME_Y}"
            font-family="Arial, Liberation Sans, sans-serif"
            font-size="${nameSize}" font-weight="700"
            fill="white"
          >${svgEsc(displayText)}</text>

          ${info.subtitle ? `<text
            x="${TEXT_X}" y="${SUB_Y}"
            font-family="Arial, Liberation Sans, sans-serif"
            font-size="${subSize}" font-weight="700"
            fill="rgba(255,255,255,0.34)"
            letter-spacing="${Math.round(subSize * 0.1)}"
          >${svgEsc(info.subtitle.toUpperCase())}</text>` : ""}

          ${info.handle ? `<text
            x="${LINK_X}" y="${LINK_Y + Math.round(linkSize * 0.36)}"
            font-family="Arial, Liberation Sans, sans-serif"
            font-size="${linkSize}" font-weight="700"
            fill="rgba(255,255,255,0.76)"
          >${svgEsc(`/${info.handle}`)}</text>` : ""}
        </svg>
      `),
      blend: "over",
    });

    // ── Layer G: Grids brand icon (pre-rasterised, embedded as base64) ───────
    if (info.handle) {
      const iconBuf = await sharp(Buffer.from(GRIDS_ICON_B64, "base64"))
        .resize(ICON_SZ, ICON_SZ, { fit: "fill" })
        .png()
        .toBuffer();
      composites.push({
        input: iconBuf,
        top: LINK_Y - Math.round(ICON_SZ / 2),
        left: PAD_X,
      });
    }

    // ── Assemble: dark background + all layers ────────────────────────────────
    const finalImage = await sharp({
      create: { width: W, height: H, channels: 3, background: { r: 16, g: 16, b: 14 } },
    })
      .composite(composites)
      .png({ compressionLevel: 8 })
      .toBuffer();

    // ── 5. Upload to Firebase Storage (skipped in local emulator) ────────────
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
