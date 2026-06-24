/**
 * Regenerate apps/web/public/grids_wordmark.png for transactional emails.
 *
 * Email clients do not load web fonts reliably, so the header uses a raster
 * wordmark (icon + Orbitron "grids") hosted at https://grids.so/grids_wordmark.png
 *
 * Renders via headless Chrome with a locally embedded Orbitron TTF (sharp/librsvg
 * cannot load @font-face; Google Fonts network wait is flaky in CI).
 *
 * Usage: npm run email:generate-wordmark
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../");
const webPublic = join(packageRoot, "../web/public");
const fontPath = join(webPublic, "assets/fonts/Orbitron-Bold.ttf");
const logoPath = join(webPublic, "grids_logo.png");
const outPath = join(webPublic, "grids_wordmark.png");

function resolveChromeExecutable(): string {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Chrome/Chromium not found. Set PUPPETEER_EXECUTABLE_PATH to your browser binary.",
  );
}

const fontData = readFileSync(fontPath).toString("base64");
const logoData = readFileSync(logoPath).toString("base64");
const logoDataUrl = `data:image/png;base64,${logoData}`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @font-face {
      font-family: "Orbitron";
      src: url("data:font/truetype;base64,${fontData}") format("truetype");
      font-weight: 700;
      font-style: normal;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent; }
    #wordmark {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 0;
      background: transparent;
    }
    #wordmark img {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      display: block;
    }
    #wordmark span {
      font-family: "Orbitron", sans-serif;
      font-weight: 700;
      font-size: 20px;
      line-height: 1;
      letter-spacing: 0.02em;
      color: #33312C;
      text-transform: lowercase;
    }
  </style>
</head>
<body>
  <div id="wordmark">
    <img src="${logoDataUrl}" alt="" />
    <span>grids</span>
  </div>
</body>
</html>`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const puppeteer: any = (await import("puppeteer-core")).default;

const browser = await puppeteer.launch({
  executablePath: resolveChromeExecutable(),
  headless: true,
  defaultViewport: { width: 200, height: 60, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });
  await page.evaluate(async () => {
    await document.fonts.load("700 20px Orbitron");
    await document.fonts.ready;
  });

  const fontFamily = await page.$eval(
    "#wordmark span",
    (el: Element) => window.getComputedStyle(el).fontFamily,
  );
  if (!fontFamily.toLowerCase().includes("orbitron")) {
    throw new Error(
      `Orbitron failed to load (computed font-family: ${fontFamily})`,
    );
  }

  const wordmark = await page.$("#wordmark");
  if (!wordmark) {
    throw new Error("Wordmark element not found in render page");
  }

  const screenshot = await wordmark.screenshot({
    type: "png",
    omitBackground: true,
  });

  writeFileSync(outPath, screenshot);
  console.log(`Wrote ${outPath}`);
} finally {
  await browser.close();
}
