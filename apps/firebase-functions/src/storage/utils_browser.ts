import { existsSync } from "node:fs";

// v147.0.0 has no pack assets on GitHub releases; using v143.0.4 (last confirmed stable).
// Firebase Functions run on Linux x86_64 -> use the .x64.tar variant (added in v127+).
// Update this URL when upgrading @sparticuz/chromium-min.
const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

const DEFAULT_EMULATOR_EXECUTABLE_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Windows Chrome installs commonly land in one of three locations depending on
// whether the 64-bit, 32-bit, or per-user installer was used.
const WINDOWS_CHROME_CANDIDATES = [
  DEFAULT_EMULATOR_EXECUTABLE_PATH,
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA
    ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
    : undefined,
].filter((path): path is string => Boolean(path));

const EMULATOR_CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  ...WINDOWS_CHROME_CANDIDATES,
];

function resolveEmulatorChromePath(): string {
  const override = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (override) return override.replace(/^["']|["']$/g, "");
  for (const candidate of EMULATOR_CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return DEFAULT_EMULATOR_EXECUTABLE_PATH;
}

type ChromiumViewport = {
  width: number;
  height: number;
  deviceScaleFactor: number;
};

// Keep these imports lazy so non-rendering Functions do not load Chromium at startup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function launchChromiumBrowser(defaultViewport: ChromiumViewport): Promise<any> {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chromium: any = (await import("@sparticuz/chromium-min")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puppeteer: any = (await import("puppeteer-core")).default;

  const executablePath = isEmulator
    ? resolveEmulatorChromePath()
    : await chromium.executablePath(CHROMIUM_URL);

  return puppeteer.launch({
    args: isEmulator ? [] : chromium.args,
    defaultViewport,
    executablePath,
    headless: true,
  });
}
