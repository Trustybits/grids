import { describe, it, expect } from "vitest";
import {
  customOgImagePath,
  defaultOgImageUrl,
  generatedOgImageUrl,
  ogImageCheckUrl,
  withVersionParam,
} from "../OgImageUtils";

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
  it("always points at the production grids.so default", () => {
    // Independent of VITE_OG_IMAGE_ENDPOINT: the cached site-wide default only
    // exists in production.
    expect(defaultOgImageUrl()).toBe("https://grids.so/api/og?slug=grids");
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
