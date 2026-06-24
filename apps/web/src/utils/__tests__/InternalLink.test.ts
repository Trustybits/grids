import { describe, it, expect } from "vitest";
import { resolveInternalGridRoute } from "../InternalLink";

const ORIGIN = "https://grids.so";

describe("resolveInternalGridRoute", () => {
  it("treats a same-origin slug link as internal", () => {
    expect(resolveInternalGridRoute("https://grids.so/matt", ORIGIN)).toBe(
      "/matt",
    );
  });

  it("treats a same-origin /grid/:id link as internal", () => {
    expect(
      resolveInternalGridRoute("https://grids.so/grid/abc123", ORIGIN),
    ).toBe("/grid/abc123");
  });

  it("preserves the query string", () => {
    expect(
      resolveInternalGridRoute("https://grids.so/matt?ref=tile", ORIGIN),
    ).toBe("/matt?ref=tile");
  });

  it("strips a trailing slash from the slug path", () => {
    expect(resolveInternalGridRoute("https://grids.so/matt/", ORIGIN)).toBe(
      "/matt",
    );
  });

  it("returns null for a different origin", () => {
    expect(resolveInternalGridRoute("https://example.com/matt", ORIGIN)).toBe(
      null,
    );
  });

  it("returns null for a www. variant of the same site", () => {
    expect(
      resolveInternalGridRoute("https://www.grids.so/matt", ORIGIN),
    ).toBe(null);
  });

  it("returns null for reserved non-grid paths", () => {
    expect(resolveInternalGridRoute("https://grids.so/pricing", ORIGIN)).toBe(
      null,
    );
    expect(resolveInternalGridRoute("https://grids.so/dashboard", ORIGIN)).toBe(
      null,
    );
    expect(resolveInternalGridRoute("https://grids.so/", ORIGIN)).toBe(null);
  });

  it("returns null for multi-segment non-grid paths", () => {
    expect(
      resolveInternalGridRoute("https://grids.so/matt/extra", ORIGIN),
    ).toBe(null);
  });

  it("returns null for mailto/tel and other non-http schemes", () => {
    expect(resolveInternalGridRoute("mailto:hi@grids.so", ORIGIN)).toBe(null);
    expect(resolveInternalGridRoute("tel:+15551234567", ORIGIN)).toBe(null);
  });

  it("returns null for empty input", () => {
    expect(resolveInternalGridRoute("", ORIGIN)).toBe(null);
  });
});
