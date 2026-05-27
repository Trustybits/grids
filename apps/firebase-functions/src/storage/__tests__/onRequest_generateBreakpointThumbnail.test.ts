import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as functions from "firebase-functions/v1";
import { respondWithMaintenanceIfEnabled } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const { storageState, puppeteerState } = vi.hoisted(() => ({
  storageState: {
    existsByPath: new Map<string, boolean>(),
    existsShouldThrow: false,
    existsCalls: [] as string[],
    saveCalls: [] as Array<{
      path: string;
      buffer: Buffer;
      options: { contentType?: string; metadata?: Record<string, unknown> };
    }>,
  },
  puppeteerState: {
    launchCalls: [] as unknown[],
    gotoCalls: [] as string[],
    screenshotBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    launchShouldThrow: false,
  },
}));

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    https: {
      onRequest: (handler: unknown) => handler,
    },
  })),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("firebase-admin", () => ({
  default: {
    storage: () => ({
      bucket: () => ({
        file: (path: string) => ({
          exists: async () => {
            storageState.existsCalls.push(path);
            if (storageState.existsShouldThrow) {
              throw new Error("storage unavailable");
            }
            return [storageState.existsByPath.get(path) ?? false];
          },
          save: async (
            buffer: Buffer,
            options: { contentType?: string; metadata?: Record<string, unknown> },
          ) => {
            storageState.saveCalls.push({ path, buffer, options });
          },
        }),
      }),
    }),
  },
}));

vi.mock("@sparticuz/chromium-min", () => ({
  default: {
    executablePath: vi.fn(async () => "/fake/chrome"),
    args: ["--fake-chromium-arg"],
  },
}));

vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn(async (opts: unknown) => {
      puppeteerState.launchCalls.push(opts);
      if (puppeteerState.launchShouldThrow) {
        throw new Error("launch failed");
      }
      const page = {
        setRequestInterception: vi.fn(async () => undefined),
        on: vi.fn(),
        goto: vi.fn(async (url: string) => {
          puppeteerState.gotoCalls.push(url);
        }),
        waitForSelector: vi.fn(async () => undefined),
        evaluate: vi.fn(async () => undefined),
        addStyleTag: vi.fn(async () => undefined),
        screenshot: vi.fn(async () => puppeteerState.screenshotBuffer),
      };
      return {
        newPage: vi.fn(async () => page),
        close: vi.fn(async () => undefined),
      };
    }),
  },
}));

vi.mock("../../maintenance.js", () => ({
  respondWithMaintenanceIfEnabled: vi.fn(),
}));

import { generateThumbnail as handlerExport } from "../onRequest_generateBreakpointThumbnail.js";

const generateThumbnail = handlerExport as unknown as (
  req: { query: Record<string, unknown> },
  res: FakeRes,
) => Promise<void>;

interface FakeRes {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  redirect: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  statusCode?: number;
  jsonBody?: unknown;
  redirectArgs?: unknown[];
}

function makeRes(): FakeRes {
  const res: FakeRes = {
    status: vi.fn(),
    json: vi.fn(),
    redirect: vi.fn(),
    setHeader: vi.fn(),
    end: vi.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.jsonBody = body;
    return res;
  });
  res.redirect.mockImplementation((...args: unknown[]) => {
    res.redirectArgs = args;
    return res;
  });
  return res;
}

beforeEach(() => {
  storageState.existsByPath = new Map();
  storageState.existsShouldThrow = false;
  storageState.existsCalls = [];
  storageState.saveCalls = [];
  puppeteerState.launchCalls = [];
  puppeteerState.gotoCalls = [];
  puppeteerState.launchShouldThrow = false;
  resetMaintenanceMock(respondWithMaintenanceIfEnabled);
  vi.mocked(functions.logger.warn).mockClear();
  vi.mocked(functions.logger.error).mockClear();
  // The handler awaits a 1.5s settle inside captureBreakpoint. Stub setTimeout
  // so those Node-side waits resolve immediately and keep the test fast.
  vi.stubGlobal(
    "setTimeout",
    ((fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateThumbnail", () => {
  it("returns immediately when maintenance response is sent", async () => {
    vi.mocked(respondWithMaintenanceIfEnabled).mockReturnValue(true);
    const res = makeRes();

    await generateThumbnail({ query: {} }, res);

    expect(respondWithMaintenanceIfEnabled).toHaveBeenCalledWith("generateThumbnail", res);
    expect(res.status).not.toHaveBeenCalled();
    expect(storageState.existsCalls).toEqual([]);
  });

  it("requires either slug or gridId", async () => {
    const res = makeRes();

    await generateThumbnail({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Provide ?slug= or ?gridId=" });
  });

  it("rejects invalid single breakpoint values", async () => {
    const res = makeRes();

    await generateThumbnail({ query: { gridId: "grid-1", breakpoint: "watch" } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid breakpoint "watch". Use: desktop, tablet, mobile, or all.',
    });
  });

  it("redirects to cached slug thumbnail for the default desktop breakpoint", async () => {
    storageState.existsByPath.set("thumbnails/slug/matt/desktop.png", true);
    const res = makeRes();

    await generateThumbnail({ query: { slug: "matt" } }, res);

    expect(storageState.existsCalls).toEqual(["thumbnails/slug/matt/desktop.png"]);
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "https://firebasestorage.googleapis.com/v0/b/grids-one.firebasestorage.app/o/thumbnails%2Fslug%2Fmatt%2Fdesktop.png?alt=media",
    );
  });

  it("redirects to cached grid thumbnail for an explicit breakpoint", async () => {
    storageState.existsByPath.set("thumbnails/grid/grid-1/mobile.png", true);
    const res = makeRes();

    await generateThumbnail({ query: { gridId: "grid-1", breakpoint: "mobile" } }, res);

    expect(storageState.existsCalls).toEqual(["thumbnails/grid/grid-1/mobile.png"]);
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "https://firebasestorage.googleapis.com/v0/b/grids-one.firebasestorage.app/o/thumbnails%2Fgrid%2Fgrid-1%2Fmobile.png?alt=media",
    );
  });

  it("returns cached URLs for all breakpoints when every cache entry exists", async () => {
    storageState.existsByPath = new Map([
      ["thumbnails/grid/grid-1/desktop.png", true],
      ["thumbnails/grid/grid-1/tablet.png", true],
      ["thumbnails/grid/grid-1/mobile.png", true],
    ]);
    const res = makeRes();

    await generateThumbnail({ query: { gridId: "grid-1", breakpoint: "all" } }, res);

    expect(storageState.existsCalls).toEqual([
      "thumbnails/grid/grid-1/desktop.png",
      "thumbnails/grid/grid-1/tablet.png",
      "thumbnails/grid/grid-1/mobile.png",
    ]);
    expect(res.json).toHaveBeenCalledWith({
      desktop:
        "https://firebasestorage.googleapis.com/v0/b/grids-one.firebasestorage.app/o/thumbnails%2Fgrid%2Fgrid-1%2Fdesktop.png?alt=media",
      tablet:
        "https://firebasestorage.googleapis.com/v0/b/grids-one.firebasestorage.app/o/thumbnails%2Fgrid%2Fgrid-1%2Ftablet.png?alt=media",
      mobile:
        "https://firebasestorage.googleapis.com/v0/b/grids-one.firebasestorage.app/o/thumbnails%2Fgrid%2Fgrid-1%2Fmobile.png?alt=media",
    });
  });

  it("skips cache lookup, regenerates, and uploads with correct path, content-type, and cache metadata when refresh=1", async () => {
    const res = makeRes();

    await generateThumbnail({ query: { gridId: "grid-1", refresh: "1" } }, res);

    expect(storageState.existsCalls).toEqual([]);
    expect(storageState.saveCalls).toHaveLength(1);
    const [save] = storageState.saveCalls;
    expect(save.path).toBe("thumbnails/grid/grid-1/desktop.png");
    expect(save.buffer).toBe(puppeteerState.screenshotBuffer);
    expect(save.options.contentType).toBe("image/png");
    expect(save.options.metadata).toMatchObject({
      cacheControl: "public, max-age=86400",
    });
    expect(typeof save.options.metadata?.generatedAt).toBe("string");
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "https://firebasestorage.googleapis.com/v0/b/grids-one.firebasestorage.app/o/thumbnails%2Fgrid%2Fgrid-1%2Fdesktop.png?alt=media",
    );
  });

  it("logs cache-check failures and falls through to regeneration + upload", async () => {
    storageState.existsShouldThrow = true;
    const res = makeRes();

    await generateThumbnail({ query: { gridId: "grid-1" } }, res);

    expect(functions.logger.warn).toHaveBeenCalledWith(
      "[thumb] cache check failed, regenerating:",
      expect.any(Error),
    );
    expect(storageState.saveCalls).toHaveLength(1);
    expect(storageState.saveCalls[0].path).toBe("thumbnails/grid/grid-1/desktop.png");
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining("thumbnails%2Fgrid%2Fgrid-1%2Fdesktop.png"),
    );
  });

  it("uploads a slug thumbnail at the slug path with the chosen breakpoint", async () => {
    const res = makeRes();

    await generateThumbnail(
      { query: { slug: "matt", breakpoint: "mobile", refresh: "1" } },
      res,
    );

    expect(storageState.saveCalls).toHaveLength(1);
    expect(storageState.saveCalls[0].path).toBe("thumbnails/slug/matt/mobile.png");
    expect(storageState.saveCalls[0].options.contentType).toBe("image/png");
  });

  it("regenerates and uploads every missing breakpoint when breakpoint=all", async () => {
    storageState.existsByPath = new Map([
      ["thumbnails/grid/grid-1/desktop.png", true],
      // tablet + mobile are missing → should be regenerated and saved
    ]);
    const res = makeRes();

    await generateThumbnail({ query: { gridId: "grid-1", breakpoint: "all" } }, res);

    const savedPaths = storageState.saveCalls.map((c) => c.path).sort();
    expect(savedPaths).toEqual([
      "thumbnails/grid/grid-1/mobile.png",
      "thumbnails/grid/grid-1/tablet.png",
    ]);
    for (const call of storageState.saveCalls) {
      expect(call.options.contentType).toBe("image/png");
      expect(call.options.metadata).toMatchObject({
        cacheControl: "public, max-age=86400",
      });
    }
  });

  it("returns 500 and does not call save when the browser fails to launch", async () => {
    puppeteerState.launchShouldThrow = true;
    const res = makeRes();

    await generateThumbnail({ query: { gridId: "grid-1", refresh: "1" } }, res);

    expect(storageState.saveCalls).toEqual([]);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Thumbnail generation failed" });
  });
});
