/**
 * functions/src/thumbnail.ts — Multi-breakpoint clean grid screenshot generator
 *
 * Captures a transparent PNG of the grid page with ALL UI chrome removed —
 * no nav, toolbar, buttons, or Vite devtools badge. No compositing or overlay;
 * this is the raw grid tiles on a transparent background, ready for use as:
 *   • In-app grid card thumbnails
 *   • Alternative OG image layouts
 *   • Preview images in share flows
 *
 * Storage paths:
 *   thumbnails/slug/{slug}/{breakpoint}.png
 *   thumbnails/grid/{gridId}/{breakpoint}.png
 *
 * Query params:
 *   ?slug=matt              screenshot of grids.so/matt
 *   ?gridId=abc123          screenshot of grids.so/grid/abc123
 *   ?breakpoint=desktop     1524 × 940   (default)
 *   ?breakpoint=tablet      820  × 1180
 *   ?breakpoint=mobile      390  × 844
 *   ?breakpoint=all         captures all three in parallel, returns JSON
 *   ?refresh=1              bypass Storage cache
 *
 * Function URL (once deployed):
 *   https://us-central1-grids-one.cloudfunctions.net/generateThumbnail
 */

import * as functions from "firebase-functions/v1";
import admin from "firebase-admin";
import type { Request, Response } from "firebase-functions/v1";
import { respondWithMaintenanceIfEnabled } from "../maintenance.js";

// chromium and puppeteer are lazy-loaded inside captureBreakpoint.
// Top-level imports cause the Firebase CLI's function-introspection server to
// time out during `firebase deploy` because the modules are very slow to initialise.

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET_NAME = "grids-one.firebasestorage.app";
const SITE_BASE = "https://grids.so";

// v147.0.0 has no pack assets on GitHub releases; using v143.0.4 (last confirmed stable).
// Firebase Functions run on Linux x86_64 → use the .x64.tar variant (added in v127+).
// Update this URL when upgrading @sparticuz/chromium-min.
const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

// ─── Breakpoint definitions ───────────────────────────────────────────────────

const BREAKPOINTS = {
  desktop: { width: 1524, height: 940 },
  tablet: { width: 1240, height: 1784 },
  mobile: { width: 560, height: 1212 },
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;
const ALL_BREAKPOINTS: Breakpoint[] = ["desktop", "tablet", "mobile"];

// ─── Storage helpers ──────────────────────────────────────────────────────────

function storagePath(
  slug: string | undefined,
  gridId: string | undefined,
  breakpoint: Breakpoint,
): string {
  return slug
    ? `thumbnails/slug/${slug}/${breakpoint}.png`
    : `thumbnails/grid/${gridId}/${breakpoint}.png`;
}

function storageUrl(path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(path)}?alt=media`;
}

// ─── Screenshot capture ───────────────────────────────────────────────────────

async function captureBreakpoint(
  pageUrl: string,
  breakpoint: Breakpoint,
): Promise<Buffer> {
  const { width, height } = BREAKPOINTS[breakpoint];

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
    defaultViewport: { width, height, deviceScaleFactor: 1 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Block media and fonts for faster load
    await page.setRequestInterception(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.on("request", (r: any) => {
      if (["media", "font"].includes(r.resourceType())) r.abort();
      else r.continue();
    });

    await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });

    // Wait for the grid to render
    await page.waitForSelector(".grid-container", { timeout: 20_000 });

    // ── Strip ALL UI chrome via path-trimming ─────────────────────────────────
    // The whole app lives inside a single #app wrapper, so simply removing
    // non-ancestors of .grid-container would keep the navbar and Discord/share
    // icons alongside it.  Instead, walk UP from .grid-container to <body>
    // and at every level remove all siblings of the current node.
    // Result: only .grid-container and its direct ancestor chain survive —
    // nav, toolbar, Discord button, share icon, devtools badge all gone,
    // regardless of tag name or class.
    await page.evaluate(() => {
      // Devtools badge first (shadow-root hosted, won't be caught by sibling walk)
      document
        .querySelectorAll(
          "#vue-devtools-anchor, #vite-plugin-vue-devtools, #__vite-plugin-vue-devtools, [id*='devtools'], [class*='devtools']",
        )
        .forEach((el: Element) => el.remove());

      const grid = document.querySelector(".grid-container");
      if (!grid) return;

      // Walk from grid → body, pruning all siblings at each level
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

    // Wait for all images inside the grid to load
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.querySelectorAll(".grid-container img")).map(
          (img: Element) =>
            (img as HTMLImageElement).complete
              ? Promise.resolve()
              : new Promise((r) => {
                  img.addEventListener("load", r, { once: true });
                  img.addEventListener("error", r, { once: true });
                }),
        ),
      ),
    );

    // Brief paint buffer for transitions / lazy content
    await new Promise((r) => setTimeout(r, 1_500));

    // Transparent background — tile drop-shadows survive compositing
    await page.evaluate(() => {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    });

    const buf = (await page.screenshot({
      type: "png",
      omitBackground: true,
    })) as Buffer;

    return buf;
  } finally {
    await browser.close();
  }
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadThumbnail(path: string, pngBuffer: Buffer): Promise<void> {
  const bucket = admin.storage().bucket(BUCKET_NAME);
  await bucket.file(path).save(pngBuffer, {
    contentType: "image/png",
    metadata: {
      cacheControl: "public, max-age=86400",
      generatedAt: new Date().toISOString(),
    },
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

async function handler(req: Request, res: Response): Promise<void> {
  if (respondWithMaintenanceIfEnabled("generateThumbnail", res)) return;

  const slug = req.query.slug as string | undefined;
  const gridId = req.query.gridId as string | undefined;
  const bpParam = (req.query.breakpoint as string | undefined) ?? "desktop";
  const refresh = req.query.refresh === "1";

  if (!slug && !gridId) {
    res.status(400).json({ error: "Provide ?slug= or ?gridId=" });
    return;
  }

  const screenshotBase = (
    process.env.OG_SCREENSHOT_BASE_URL ?? SITE_BASE
  ).replace(/\/$/, "");

  const pageUrl = slug
    ? `${screenshotBase}/${slug}`
    : `${screenshotBase}/grid/${gridId}`;

  const isEmulatorEnv = process.env.FUNCTIONS_EMULATOR === "true";

  // ── ?breakpoint=all — capture every breakpoint in series ──────────────────
  // (Series rather than parallel: each capture already spins up its own
  //  Chromium, so parallel would triple peak memory on a 2 GB instance.)
  if (bpParam === "all") {
    const results: Record<string, string> = {};

    for (const bp of ALL_BREAKPOINTS) {
      const path = storagePath(slug, gridId, bp);

      if (!refresh && !isEmulatorEnv) {
        try {
          const [exists] = await admin
            .storage()
            .bucket(BUCKET_NAME)
            .file(path)
            .exists();
          if (exists) {
            results[bp] = storageUrl(path);
            continue;
          }
        } catch (cacheErr) {
          // Storage permission error — fall through and regenerate.
          // Long-term fix: grant service account Storage Object Admin on the bucket.
          functions.logger.warn(
            "[thumb] cache check failed, regenerating:",
            cacheErr,
          );
        }
      }

      functions.logger.info(`[thumb] capturing ${bp} for ${pageUrl}`);
      const buf = await captureBreakpoint(pageUrl, bp);

      if (!isEmulatorEnv) {
        await uploadThumbnail(path, buf);
        results[bp] = storageUrl(path);
      } else {
        // In emulator: return a data URI so the caller can inspect all three
        results[bp] = `data:image/png;base64,${buf.toString("base64")}`;
      }
    }

    res.json(results);
    return;
  }

  // ── Single breakpoint ──────────────────────────────────────────────────────
  if (!ALL_BREAKPOINTS.includes(bpParam as Breakpoint)) {
    res.status(400).json({
      error: `Invalid breakpoint "${bpParam}". Use: desktop, tablet, mobile, or all.`,
    });
    return;
  }

  const bp = bpParam as Breakpoint;
  const path = storagePath(slug, gridId, bp);

  // Serve from Storage cache if available
  if (!refresh && !isEmulatorEnv) {
    try {
      const [exists] = await admin
        .storage()
        .bucket(BUCKET_NAME)
        .file(path)
        .exists();
      if (exists) {
        res.redirect(302, storageUrl(path));
        return;
      }
    } catch (cacheErr) {
      // Storage permission error — fall through and regenerate.
      functions.logger.warn(
        "[thumb] cache check failed, regenerating:",
        cacheErr,
      );
    }
  }

  functions.logger.info(`[thumb] capturing ${bp} for ${pageUrl}`);

  try {
    const buf = await captureBreakpoint(pageUrl, bp);

    if (isEmulatorEnv) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      res.end(buf);
      return;
    }

    await uploadThumbnail(path, buf);
    functions.logger.info(`[thumb] stored: ${path}`);
    res.redirect(302, storageUrl(path));
  } catch (err) {
    functions.logger.error("[thumb] generation failed:", err);
    res.status(500).json({ error: "Thumbnail generation failed" });
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const generateThumbnail = functions
  .runWith({ memory: "2GB", timeoutSeconds: 120 })
  .https.onRequest(handler);
