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
        goto: vi.fn(async () => undefined),
        waitForSelector: vi.fn(async () => undefined),
        // Every Node-side caller `await`s evaluate for side effects; the only
        // values actually consumed are `docHeight` (a number) and the tile
        // rects array. Returning `[]` is safe for both — `Math.ceil([])` is 0
        // and an empty rects array produces an empty scatter composition.
        evaluate: vi.fn(async () => []),
        addStyleTag: vi.fn(async () => undefined),
        setViewport: vi.fn(async () => undefined),
        setContent: vi.fn(async () => undefined),
        waitForFunction: vi.fn(async () => undefined),
        screenshot: vi.fn(async () => puppeteerState.screenshotBuffer),
        close: vi.fn(async () => undefined),
      };
      return {
        newPage: vi.fn(async () => page),
        close: vi.fn(async () => undefined),
      };
    }),
  },
}));

vi.mock("sharp", () => {
  // sharp() returns a chainable object. Only `metadata()` is exercised in the
  // happy path (rects come back empty so per-tile extract/stats aren't hit),
  // but we stub the full chain defensively in case future tests exercise it.
  const instance = {
    metadata: async () => ({ width: 1524, height: 940 }),
    extract: () => instance,
    png: () => instance,
    toBuffer: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    stats: async () => ({
      channels: [
        { stdev: 50, mean: 100 },
        { stdev: 50, mean: 100 },
        { stdev: 50, mean: 100 },
      ],
    }),
  };
  return { default: () => instance };
});

vi.mock("../../maintenance.js", () => ({
  respondWithMaintenanceIfEnabled: vi.fn(),
}));

/**
 * Builds a Firestore-REST-shaped grid document the handler's parseDoc helper
 * can parse. Returns the minimum fields needed to push the handler past
 * resolveGridInfo and into the puppeteer render path.
 */
function fakeGridDocResponse(ogImageSrc?: string): Response {
  const fields: Record<string, unknown> = {
    themeId: { stringValue: "dark" },
    tiles: { arrayValue: { values: [] } },
  };
  if (ogImageSrc) fields.ogImageSrc = { stringValue: ogImageSrc };
  const body = { fields };
  return {
    ok: true,
    json: async () => body,
  } as unknown as Response;
}

/** Firestore-REST-shaped slug document pointing at a default grid. */
function fakeSlugDocResponse(defaultGridId: string): Response {
  const body = {
    fields: { defaultGridId: { stringValue: defaultGridId } },
  };
  return {
    ok: true,
    json: async () => body,
  } as unknown as Response;
}

import {
  generateOgImage as handlerExport,
  extractTiptapText,
  parsePositions,
  parseCoverageOverride,
  themeFor,
  fnv1a,
  mulberry32,
  buildOgHtml,
  normalizeScreenshotBaseUrl,
  parseRefreshQuery,
} from "../onRequest_generateOgImage.js";

const generateOgImage = handlerExport as unknown as (
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
  puppeteerState.launchShouldThrow = false;
  resetMaintenanceMock(respondWithMaintenanceIfEnabled);
  vi.mocked(functions.logger.warn).mockClear();
  vi.mocked(functions.logger.error).mockClear();
  vi.unstubAllGlobals();
  // The render path awaits several long settles inside puppeteer scripting
  // (`await new Promise(r => setTimeout(r, 4_000))` etc). Stub setTimeout so
  // those Node-side waits resolve immediately and keep the test fast.
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

describe("generateOgImage", () => {
  it("returns immediately when maintenance response is sent", async () => {
    vi.mocked(respondWithMaintenanceIfEnabled).mockReturnValue(true);
    const res = makeRes();

    await generateOgImage({ query: {} }, res);

    expect(respondWithMaintenanceIfEnabled).toHaveBeenCalledWith("generateOgImage", res);
    expect(res.status).not.toHaveBeenCalled();
    expect(storageState.existsCalls).toEqual([]);
  });

  it("requires either slug or gridId", async () => {
    const res = makeRes();

    await generateOgImage({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Provide ?slug= or ?gridId=" });
  });

  it("redirects to a cached slug OG image", async () => {
    storageState.existsByPath.set("og-images/slug/matt.png", true);
    // No slug/grid docs resolve → no custom OG image, fall through to cache.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const res = makeRes();

    await generateOgImage({ query: { slug: "matt" } }, res);

    expect(storageState.existsCalls).toEqual(["og-images/slug/matt.png"]);
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "https://firebasestorage.googleapis.com/v0/b/demo-test-project.firebasestorage.app/o/og-images%2Fslug%2Fmatt.png?alt=media",
    );
  });

  it("redirects to a cached grid OG image", async () => {
    storageState.existsByPath.set("og-images/grid/grid-1.png", true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const res = makeRes();

    await generateOgImage({ query: { gridId: "grid-1" } }, res);

    expect(storageState.existsCalls).toEqual(["og-images/grid/grid-1.png"]);
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "https://firebasestorage.googleapis.com/v0/b/demo-test-project.firebasestorage.app/o/og-images%2Fgrid%2Fgrid-1.png?alt=media",
    );
  });

  it("skips cache when refresh is set and returns 404 if grid cannot resolve", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const res = makeRes();

    await generateOgImage({ query: { gridId: "grid-1", refresh: "1" } }, res);

    expect(storageState.existsCalls).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/grids/grid-1"),
      { headers: { Accept: "application/json" } },
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Grid not found" });
  });

  it("skips cache when seed or position overrides are present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const res = makeRes();

    await generateOgImage({
      query: {
        slug: "matt",
        seed: "alternate",
        positions: "A1",
        minCov: "0.15",
        maxCov: "0.5",
      },
    }, res);

    expect(storageState.existsCalls).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/slugs/matt"),
      { headers: { Accept: "application/json" } },
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("logs cache-check failures and then resolves grid info", async () => {
    storageState.existsShouldThrow = true;
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const res = makeRes();

    await generateOgImage({ query: { gridId: "grid-1" } }, res);

    expect(functions.logger.warn).toHaveBeenCalledWith(
      "[og] cache check failed, regenerating:",
      expect.any(Error),
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("uploads the rendered grid OG image with correct path, content-type, and cache metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeGridDocResponse());
    vi.stubGlobal("fetch", fetchMock);
    const res = makeRes();

    await generateOgImage({ query: { gridId: "grid-1", refresh: "1" } }, res);

    expect(storageState.saveCalls).toHaveLength(1);
    const [save] = storageState.saveCalls;
    expect(save.path).toBe("og-images/grid/grid-1.png");
    expect(save.buffer).toBe(puppeteerState.screenshotBuffer);
    expect(save.options.contentType).toBe("image/png");
    expect(save.options.metadata).toMatchObject({
      cacheControl: "public, max-age=86400",
      themeId: "dark",
    });
    expect(typeof save.options.metadata?.generatedAt).toBe("string");
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "https://firebasestorage.googleapis.com/v0/b/demo-test-project.firebasestorage.app/o/og-images%2Fgrid%2Fgrid-1.png?alt=media",
    );
  });

  it("uploads the rendered slug OG image at the slug path", async () => {
    // URL-keyed mock: the slug + grid docs are each fetched twice (custom OG
    // check, then resolveGridInfo), so ordered mockResolvedValueOnce chains
    // would desync. Any other fetch gets a harmless non-ok default.
    const fetchMock = vi.fn().mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/slugs/matt")) return fakeSlugDocResponse("grid-1");
      if (u.includes("/grids/grid-1")) return fakeGridDocResponse();
      return { ok: false } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = makeRes();

    await generateOgImage({ query: { slug: "matt", refresh: "1" } }, res);

    expect(storageState.saveCalls).toHaveLength(1);
    expect(storageState.saveCalls[0].path).toBe("og-images/slug/matt.png");
    expect(storageState.saveCalls[0].options.contentType).toBe("image/png");
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "https://firebasestorage.googleapis.com/v0/b/demo-test-project.firebasestorage.app/o/og-images%2Fslug%2Fmatt.png?alt=media",
    );
  });

  it("redirects to a custom OG image on the grid doc, skipping cache and generation", async () => {
    storageState.existsByPath.set("og-images/grid/grid-1.png", true);
    const customUrl =
      "https://firebasestorage.googleapis.com/v0/b/demo-test-project.firebasestorage.app/o/og-images%2Fcustom%2Fgrid-1%2Fog?alt=media&v=123";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeGridDocResponse(customUrl));
    vi.stubGlobal("fetch", fetchMock);
    const res = makeRes();

    await generateOgImage({ query: { gridId: "grid-1" } }, res);

    expect(res.redirect).toHaveBeenCalledWith(302, customUrl);
    expect(storageState.existsCalls).toEqual([]);
    expect(storageState.saveCalls).toEqual([]);
    expect(puppeteerState.launchCalls).toEqual([]);
  });

  it("redirects to the default grid's custom OG image for slug requests, even with refresh", async () => {
    const customUrl = "https://example.com/custom-og.png";
    const fetchMock = vi.fn().mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/slugs/matt")) return fakeSlugDocResponse("grid-1");
      if (u.includes("/grids/grid-1")) return fakeGridDocResponse(customUrl);
      return { ok: false } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = makeRes();

    // refresh=1 must NOT regenerate over a custom image.
    await generateOgImage({ query: { slug: "matt", refresh: "1" } }, res);

    expect(res.redirect).toHaveBeenCalledWith(302, customUrl);
    expect(storageState.saveCalls).toEqual([]);
    expect(puppeteerState.launchCalls).toEqual([]);
  });

  it("check probe reports an existing cached image without generating", async () => {
    storageState.existsByPath.set("og-images/grid/grid-1.png", true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const res = makeRes();

    await generateOgImage({ query: { gridId: "grid-1", check: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      exists: true,
      custom: false,
      url: "https://firebasestorage.googleapis.com/v0/b/demo-test-project.firebasestorage.app/o/og-images%2Fgrid%2Fgrid-1.png?alt=media",
    });
    expect(puppeteerState.launchCalls).toEqual([]);
    expect(storageState.saveCalls).toEqual([]);
  });

  it("check probe reports a missing image without generating", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const res = makeRes();

    await generateOgImage({ query: { gridId: "grid-1", check: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      exists: false,
      custom: false,
      url: null,
    });
    expect(puppeteerState.launchCalls).toEqual([]);
  });

  it("check probe reports a custom OG image", async () => {
    const customUrl = "https://example.com/custom-og.png";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeGridDocResponse(customUrl));
    vi.stubGlobal("fetch", fetchMock);
    const res = makeRes();

    await generateOgImage({ query: { gridId: "grid-1", check: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      exists: true,
      custom: true,
      url: customUrl,
    });
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("does not call save and returns 500 when the browser fails to launch", async () => {
    puppeteerState.launchShouldThrow = true;
    const fetchMock = vi.fn().mockResolvedValue(fakeGridDocResponse());
    vi.stubGlobal("fetch", fetchMock);
    const res = makeRes();

    await generateOgImage({ query: { gridId: "grid-1", refresh: "1" } }, res);

    expect(storageState.saveCalls).toEqual([]);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "OG image generation failed" });
  });
});

describe("parseRefreshQuery", () => {
  it("accepts common truthy refresh values", () => {
    expect(parseRefreshQuery("1")).toBe(true);
    expect(parseRefreshQuery("true")).toBe(true);
    expect(parseRefreshQuery("TRUE")).toBe(true);
    expect(parseRefreshQuery("yes")).toBe(true);
  });

  it("rejects missing or falsey refresh values", () => {
    expect(parseRefreshQuery(undefined)).toBe(false);
    expect(parseRefreshQuery("")).toBe(false);
    expect(parseRefreshQuery("0")).toBe(false);
    expect(parseRefreshQuery("false")).toBe(false);
  });
});

// ─── normalizeScreenshotBaseUrl ─────────────────────────────────────────────

describe("normalizeScreenshotBaseUrl", () => {
  it("strips a trailing slash without rewriting the host", () => {
    expect(normalizeScreenshotBaseUrl("http://localhost:5173/")).toBe(
      "http://localhost:5173",
    );
    expect(normalizeScreenshotBaseUrl("https://grids.so/")).toBe(
      "https://grids.so",
    );
  });
});

// ─── buildOgHtml — profile meta without avatar ───────────────────────────────
// When a grid has no profile photo, the OG must not render an empty avatar
// shape — only the text block, vertically centered in the meta area.

describe("buildOgHtml — avatar presence", () => {
  const baseInfo = {
    screenshotUrl: "https://grids.so/test",
    themeId: "dark",
    avatarShape: "circle" as const,
    avatarSides: 6,
    displayName: "Test User",
    handle: "testuser",
    subtitle: "CEO & Founder",
    skipTileIndices: [],
    seed: "slug:testuser",
  };

  it("omits the avatar shape when profilePhotoUrl is missing", () => {
    const html = buildOgHtml(
      { ...baseInfo, avatarUrl: null },
      [],
      [],
      themeFor("dark"),
    );
    expect(html).toContain('class="profile no-avatar"');
    expect(html).not.toContain('class="avatar"');
    expect(html).not.toContain("stroke-width");
  });

  it("renders the avatar when profilePhotoUrl is set", () => {
    const html = buildOgHtml(
      {
        ...baseInfo,
        avatarUrl: "https://cdn.example.com/photo.png",
      },
      [],
      [],
      themeFor("dark"),
    );
    expect(html).toMatch(/<div class="profile">\s*\n?\s*<div class="avatar">/);
    expect(html).toContain('class="avatar"');
    expect(html).toContain("https://cdn.example.com/photo.png");
  });

  it("promotes the logo to the avatar slot and drops the slug row when there is no avatar and no handle", () => {
    const html = buildOgHtml(
      { ...baseInfo, avatarUrl: null, handle: null },
      [],
      [],
      themeFor("dark"),
    );
    expect(html).toContain('class="logo-large"');
    expect(html).not.toContain('class="avatar"');
    expect(html).not.toContain('class="slug-row"');
    expect(html).not.toContain('class="slug-icon"');
    // The top element exists, so the profile should not get the no-avatar tweak.
    expect(html).not.toContain('class="profile no-avatar"');
  });

  it("keeps the small logo + slug row when a handle exists but no avatar", () => {
    const html = buildOgHtml(
      { ...baseInfo, avatarUrl: null, handle: "testuser" },
      [],
      [],
      themeFor("dark"),
    );
    expect(html).toContain('class="profile no-avatar"');
    expect(html).not.toContain('class="logo-large"');
    expect(html).toContain('class="slug-row"');
    expect(html).toContain("/testuser");
  });
});

// ─── extractTiptapText helper ──────────────────────────────────────────────
// Converts TipTap/ProseMirror JSON stored in Firestore into plain text used
// in OG image generation. Bugs here are silent: a regression produces an OG
// image with the wrong name or title with no error thrown.

describe("extractTiptapText — plain string input", () => {
  it("returns the string trimmed when passed plain text", () => {
    expect(extractTiptapText("Matthew Galley")).toBe("Matthew Galley");
  });

  it("trims surrounding whitespace", () => {
    expect(extractTiptapText("  CEO & Founder  ")).toBe("CEO & Founder");
  });

  it("returns empty string for an empty string", () => {
    expect(extractTiptapText("")).toBe("");
  });
});

describe("extractTiptapText — JSON string input", () => {
  it("extracts text from a serialised TipTap doc with one paragraph", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Matthew Galley" }],
        },
      ],
    });
    expect(extractTiptapText(json)).toBe("Matthew Galley");
  });

  it("concatenates text across multiple paragraphs", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "CEO" }] },
        { type: "paragraph", content: [{ type: "text", text: "Founder" }] },
      ],
    });
    expect(extractTiptapText(json)).toBe("CEOFounder");
  });

  it("returns empty string for a doc with no text nodes", () => {
    const json = JSON.stringify({ type: "doc", content: [] });
    expect(extractTiptapText(json)).toBe("");
  });

  it("returns the raw string when JSON.parse fails (malformed input)", () => {
    expect(extractTiptapText("{not valid json")).toBe("{not valid json");
  });
});

describe("extractTiptapText — object input", () => {
  it("extracts text from a doc object", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Community Manager" }],
        },
      ],
    };
    expect(extractTiptapText(doc)).toBe("Community Manager");
  });

  it("returns text from a bare text node", () => {
    expect(extractTiptapText({ type: "text", text: "hello" })).toBe("hello");
  });

  it("handles deeply nested content", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "bold",
              content: [{ type: "text", text: "Bold" }],
            },
            { type: "text", text: " normal" },
          ],
        },
      ],
    };
    expect(extractTiptapText(doc)).toBe("Bold normal");
  });

  it("handles emoji in display names", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "nath 👋" }],
        },
      ],
    };
    expect(extractTiptapText(doc)).toBe("nath 👋");
  });

  it("returns empty string for null", () => {
    expect(extractTiptapText(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(extractTiptapText(undefined)).toBe("");
  });

  it("returns empty string for a number", () => {
    expect(extractTiptapText(42)).toBe("");
  });

  it("returns empty string for an object with no text or content", () => {
    expect(extractTiptapText({ type: "hardBreak" })).toBe("");
  });
});

// ─── parsePositions — ?positions= query parser ─────────────────────────────
// Bug surface: a bad parse silently falls back to default SEED_POSITIONS
// without erroring, so a typo in the URL produces "looks normal" output.

describe("parsePositions — letter format", () => {
  it("parses A1 as col 0, row 0", () => {
    expect(parsePositions("A1")).toEqual([[0, 0]]);
  });

  it("parses L7 as col 11, row 6 (1-based row → 0-based)", () => {
    expect(parsePositions("L7")).toEqual([[11, 6]]);
  });

  it("accepts lowercase column letters", () => {
    expect(parsePositions("b3")).toEqual([[1, 2]]);
  });

  it("parses a comma-separated list, preserving order", () => {
    expect(parsePositions("A1,L7,B5")).toEqual([
      [0, 0],
      [11, 6],
      [1, 4],
    ]);
  });

  it("trims whitespace around tokens", () => {
    expect(parsePositions(" A1 , L7 ")).toEqual([
      [0, 0],
      [11, 6],
    ]);
  });
});

describe("parsePositions — numeric format", () => {
  it("parses 0-0 as col 0, row 0 (already 0-based)", () => {
    expect(parsePositions("0-0")).toEqual([[0, 0]]);
  });

  it("parses 11-6 as the far corner", () => {
    expect(parsePositions("11-6")).toEqual([[11, 6]]);
  });

  it("mixes letter and numeric tokens in one string", () => {
    expect(parsePositions("A1,8-0,B5")).toEqual([
      [0, 0],
      [8, 0],
      [1, 4],
    ]);
  });
});

describe("parsePositions — invalid input", () => {
  it("returns null for undefined (caller falls back to defaults)", () => {
    expect(parsePositions(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parsePositions("")).toBeNull();
  });

  it("returns null when no token is valid", () => {
    expect(parsePositions("hello,world,!!!")).toBeNull();
  });

  it("drops out-of-range letter columns (M is past L)", () => {
    // "M1" has no valid column letter but matches the numeric regex if
    // present; here it should simply be discarded.
    expect(parsePositions("M1")).toBeNull();
  });

  it("drops out-of-range numeric rows (>= SEED_ROWS=7)", () => {
    expect(parsePositions("0-7")).toBeNull();
    expect(parsePositions("0-99")).toBeNull();
  });

  it("drops out-of-range numeric columns (>= SEED_COLS=12)", () => {
    expect(parsePositions("12-0")).toBeNull();
  });

  it("drops out-of-range letter rows (A8 — row 8 → idx 7 > max 6)", () => {
    expect(parsePositions("A8")).toBeNull();
  });

  it("drops invalid tokens but keeps the valid ones in the same string", () => {
    expect(parsePositions("A1,garbage,L7")).toEqual([
      [0, 0],
      [11, 6],
    ]);
  });
});

// ─── parseCoverageOverride — ?minCov= / ?maxCov= ──────────────────────────
// Falls back to the supplied default when the value is missing or NaN.

describe("parseCoverageOverride", () => {
  it("returns parsed float for a valid number string", () => {
    expect(parseCoverageOverride("0.45", 0.20)).toBe(0.45);
  });

  it("returns the fallback when the value is undefined", () => {
    expect(parseCoverageOverride(undefined, 0.20)).toBe(0.20);
  });

  it("returns the fallback for an empty string", () => {
    expect(parseCoverageOverride("", 0.60)).toBe(0.60);
  });

  it("returns the fallback for a non-numeric string", () => {
    expect(parseCoverageOverride("not-a-number", 0.20)).toBe(0.20);
  });

  it("accepts integers and zero", () => {
    expect(parseCoverageOverride("0", 0.20)).toBe(0);
    expect(parseCoverageOverride("1", 0.20)).toBe(1);
  });

  it("parses negative values as-is (caller is responsible for clamping)", () => {
    // The helper does not clamp — it only resolves "did the user provide a
    // finite number?". Documenting current behavior.
    expect(parseCoverageOverride("-0.5", 0.20)).toBe(-0.5);
  });

  it("uses parseFloat's lenient suffix behavior", () => {
    // parseFloat("0.4abc") === 0.4. Documenting current behavior so a future
    // change to stricter parsing is a conscious decision.
    expect(parseCoverageOverride("0.4abc", 0.20)).toBe(0.4);
  });
});

// ─── themeFor — themeId → ThemeTokens ─────────────────────────────────────

describe("themeFor", () => {
  it("returns the light theme for themeId='light'", () => {
    const t = themeFor("light");
    expect(t.gridBackground).toBe("#ffffff");
    expect(t.contentFull).toBe("#33312c");
    expect(t.vignetteColor).toBe("rgba(255, 255, 255, 1)");
  });

  it("returns the dark theme for themeId='dark'", () => {
    const t = themeFor("dark");
    expect(t.gridBackground).toBe("#10100e");
    expect(t.contentFull).toBe("#ffffff");
    expect(t.vignetteColor).toBe("rgba(16, 16, 14, 1)");
  });

  it("returns the dark theme for undefined (default)", () => {
    expect(themeFor(undefined).gridBackground).toBe("#10100e");
  });

  it("returns the dark theme for any unrecognized themeId", () => {
    // Only "light" triggers the light branch — every other value is dark.
    // This is the contract the resolveGridInfo defaulting relies on.
    expect(themeFor("midnight").gridBackground).toBe("#10100e");
    expect(themeFor("").gridBackground).toBe("#10100e");
    expect(themeFor("LIGHT").gridBackground).toBe("#10100e"); // case-sensitive
  });

  it("light and dark themes use different avatar shadows", () => {
    expect(themeFor("light").avatarShadow).not.toBe(themeFor("dark").avatarShadow);
  });
});

// ─── Seed override → deterministic RNG ─────────────────────────────────────
// The `?seed=` override exists so you can preview alternate scatter layouts
// for the same grid. Correctness here means: (a) same seed string → same
// number sequence, (b) different seeds → different sequences.

describe("seed → RNG pipeline (fnv1a + mulberry32)", () => {
  it("fnv1a returns a 32-bit unsigned integer", () => {
    const h = fnv1a("slug:matt");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it("fnv1a is deterministic for the same input", () => {
    expect(fnv1a("slug:matt")).toBe(fnv1a("slug:matt"));
  });

  it("fnv1a distinguishes between similar strings", () => {
    expect(fnv1a("slug:matt")).not.toBe(fnv1a("slug:matty"));
    expect(fnv1a("slug:matt")).not.toBe(fnv1a("grid:matt"));
  });

  it("fnv1a returns the empty-string seed value for empty input", () => {
    // Documenting that empty input is not rejected — fnv1a returns its
    // initial offset basis (2166136261). This matters because resolveSeed
    // is `seedOverride ?? info.seed`, not `|| info.seed` — so `?seed=`
    // (empty) would fall through to fnv1a("").
    expect(fnv1a("")).toBe(0x811c9dc5);
  });

  it("mulberry32 produces a deterministic sequence for the same seed", () => {
    const a = mulberry32(fnv1a("slug:matt"));
    const b = mulberry32(fnv1a("slug:matt"));
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("mulberry32 produces a different sequence for different seeds", () => {
    const fromSlug = mulberry32(fnv1a("slug:matt"));
    const fromOverride = mulberry32(fnv1a("custom-override"));
    expect(fromSlug()).not.toBe(fromOverride());
  });

  it("mulberry32 outputs are in [0, 1)", () => {
    const rng = mulberry32(fnv1a("slug:matt"));
    for (let i = 0; i < 50; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("models the seed-override contract: override seed → different RNG than default", () => {
    // Mirrors handler line ~1960: `const seedString = seedOverride ?? info.seed`
    const defaultSeed = "slug:matt";
    const override = "experimental-layout-v2";
    const defaultRng = mulberry32(fnv1a(defaultSeed));
    const overrideRng = mulberry32(fnv1a(override));
    expect(defaultRng()).not.toBe(overrideRng());
  });
});
