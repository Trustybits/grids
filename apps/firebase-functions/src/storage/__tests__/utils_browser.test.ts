import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { chromiumState, puppeteerState } = vi.hoisted(() => ({
  chromiumState: {
    executablePathCalls: [] as string[],
  },
  puppeteerState: {
    launchCalls: [] as unknown[],
    browser: { close: vi.fn() },
  },
}));

vi.mock("@sparticuz/chromium-min", () => ({
  default: {
    args: ["--fake-chromium-arg"],
    executablePath: vi.fn(async (url: string) => {
      chromiumState.executablePathCalls.push(url);
      return "/cloud/chrome";
    }),
  },
}));

vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn(async (opts: unknown) => {
      puppeteerState.launchCalls.push(opts);
      return puppeteerState.browser;
    }),
  },
}));

import { launchChromiumBrowser } from "../utils_browser.js";

const originalFunctionsEmulator = process.env.FUNCTIONS_EMULATOR;
const originalPuppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

beforeEach(() => {
  chromiumState.executablePathCalls = [];
  puppeteerState.launchCalls = [];
  vi.mocked(puppeteerState.browser.close).mockClear();
  delete process.env.FUNCTIONS_EMULATOR;
  delete process.env.PUPPETEER_EXECUTABLE_PATH;
});

afterEach(() => {
  restoreEnv("FUNCTIONS_EMULATOR", originalFunctionsEmulator);
  restoreEnv("PUPPETEER_EXECUTABLE_PATH", originalPuppeteerExecutablePath);
});

describe("launchChromiumBrowser", () => {
  it("launches cloud Chromium with the configured binary URL and viewport", async () => {
    const viewport = { width: 1200, height: 630, deviceScaleFactor: 1 };

    const browser = await launchChromiumBrowser(viewport);

    expect(browser).toBe(puppeteerState.browser);
    expect(chromiumState.executablePathCalls).toHaveLength(1);
    expect(chromiumState.executablePathCalls[0]).toContain(
      "chromium-v143.0.4-pack.x64.tar",
    );
    expect(puppeteerState.launchCalls).toEqual([
      {
        args: ["--fake-chromium-arg"],
        defaultViewport: viewport,
        executablePath: "/cloud/chrome",
        headless: true,
      },
    ]);
  });

  it("uses the configured local executable and no Chromium args in the emulator", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    process.env.PUPPETEER_EXECUTABLE_PATH = "/custom/chrome";
    const viewport = { width: 390, height: 844, deviceScaleFactor: 1 };

    await launchChromiumBrowser(viewport);

    expect(chromiumState.executablePathCalls).toEqual([]);
    expect(puppeteerState.launchCalls).toEqual([
      {
        args: [],
        defaultViewport: viewport,
        executablePath: "/custom/chrome",
        headless: true,
      },
    ]);
  });

  it("falls back to the Windows Chrome path in the emulator", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    const viewport = { width: 920, height: 1180, deviceScaleFactor: 1 };

    await launchChromiumBrowser(viewport);

    expect(chromiumState.executablePathCalls).toEqual([]);
    expect(puppeteerState.launchCalls).toEqual([
      {
        args: [],
        defaultViewport: viewport,
        executablePath:
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        headless: true,
      },
    ]);
  });
});
