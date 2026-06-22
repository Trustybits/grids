import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  customOgImagePath,
  defaultOgImageUrl,
  generatedOgImageUrl,
  ogImageCheckUrl,
  withVersionParam,
} from "../OgImageUtils";

// Root .env may set VITE_OG_IMAGE_ENDPOINT for emulator dev — clear it so
// URL-builder tests hit the production / same-origin logic under test.
beforeEach(() => {
  vi.stubEnv("VITE_OG_IMAGE_ENDPOINT", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("customOgImagePath", () => {
  it("namespaces the fixed object under the owner uid and grid id", () => {
    expect(customOgImagePath("user-1", "grid-1")).toBe(
      "og-images/custom/user-1/grid-1/og",
    );
  });
});

describe("generatedOgImageUrl", () => {
  it("includes the grid id and omits refresh / cache-bust by default", () => {
    const u = new URL(generatedOgImageUrl("grid-1"));
    expect(u.searchParams.get("gridId")).toBe("grid-1");
    expect(u.searchParams.has("refresh")).toBe(false);
    expect(u.searchParams.has("t")).toBe(false);
  });

  it("adds refresh=1 only when regenerating", () => {
    const u = new URL(generatedOgImageUrl("grid-1", { refresh: true }));
    expect(u.searchParams.get("refresh")).toBe("1");
  });

  it("adds a cache-bust token when provided", () => {
    const u = new URL(generatedOgImageUrl("grid-1", { cacheBust: 123 }));
    expect(u.searchParams.get("t")).toBe("123");
  });

  it("includes both refresh and cache-bust when regenerating with a token", () => {
    const u = new URL(
      generatedOgImageUrl("grid-1", { refresh: true, cacheBust: 123 }),
    );
    expect(u.searchParams.get("gridId")).toBe("grid-1");
    expect(u.searchParams.get("refresh")).toBe("1");
    expect(u.searchParams.get("t")).toBe("123");
  });

  it("omits the cache-bust token when it is 0 (falsy)", () => {
    const u = new URL(generatedOgImageUrl("grid-1", { cacheBust: 0 }));
    expect(u.searchParams.has("t")).toBe(false);
  });
});

describe("ogImageCheckUrl", () => {
  it("requests an existence probe without triggering generation", () => {
    const u = new URL(ogImageCheckUrl("grid-1"));
    expect(u.searchParams.get("gridId")).toBe("grid-1");
    expect(u.searchParams.get("check")).toBe("1");
    // Always cache-busted so the probe is never served a stale answer.
    expect(u.searchParams.get("t")).toBeTruthy();
    // A probe must never carry refresh — that would generate.
    expect(u.searchParams.has("refresh")).toBe(false);
  });
});

describe("defaultOgImageUrl", () => {
  it("points at the site-wide default slug on the apex fallback", () => {
    // Vitest/jsdom is not on grids.so — ogApiBase() falls back to production apex.
    expect(defaultOgImageUrl()).toBe("https://grids.so/api/og?slug=grids");
  });
});

describe("ogApiBase (via generatedOgImageUrl)", () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("uses same-origin /api/og on www.grids.so", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hostname: "www.grids.so",
        origin: "https://www.grids.so",
      },
    });

    const u = new URL(generatedOgImageUrl("grid-1"));
    expect(u.origin).toBe("https://www.grids.so");
    expect(u.pathname).toBe("/api/og");
  });
});

describe("withVersionParam", () => {
  it("appends ?v= when the url has no query string", () => {
    expect(withVersionParam("https://x.test/og.png", 7)).toBe(
      "https://x.test/og.png?v=7",
    );
  });

  it("appends &v= when the url already has a query string", () => {
    expect(withVersionParam("https://x.test/og.png?a=1", 7)).toBe(
      "https://x.test/og.png?a=1&v=7",
    );
  });
});
