import { describe, it, expect } from "vitest";
import {
  areEquivalentGridOrigins,
  resolveInternalGridRoute,
} from "../InternalLink";

const PROD_ORIGIN = "https://grids.so";
const LOCAL_ORIGIN = "http://localhost:5173";

describe("areEquivalentGridOrigins", () => {
  it("treats grids.so and www.grids.so as equivalent", () => {
    expect(
      areEquivalentGridOrigins("https://www.grids.so", "https://grids.so"),
    ).toBe(true);
    expect(
      areEquivalentGridOrigins("https://grids.so", "https://www.grids.so"),
    ).toBe(true);
  });

  it("treats localhost and 127.0.0.1 as equivalent on the same port", () => {
    expect(
      areEquivalentGridOrigins(
        "https://127.0.0.1:5173",
        "http://localhost:5173",
      ),
    ).toBe(true);
    expect(
      areEquivalentGridOrigins(
        "https://localhost:5173",
        "http://127.0.0.1:5173",
      ),
    ).toBe(true);
  });

  it("ignores http vs https within the same host group and port", () => {
    expect(
      areEquivalentGridOrigins(
        "https://localhost:5173",
        "http://localhost:5173",
      ),
    ).toBe(true);
  });

  it("does not treat different ports on local hosts as equivalent", () => {
    expect(
      areEquivalentGridOrigins("https://localhost", "http://localhost:5173"),
    ).toBe(false);
    expect(
      areEquivalentGridOrigins("https://127.0.0.1", "https://127.0.0.1:5173"),
    ).toBe(false);
  });

  it("does not treat production and local hosts as equivalent", () => {
    expect(
      areEquivalentGridOrigins("https://grids.so", "http://localhost:5173"),
    ).toBe(false);
  });
});

describe("resolveInternalGridRoute", () => {
  it("treats a same-origin slug link as internal", () => {
    expect(resolveInternalGridRoute("https://grids.so/matt", PROD_ORIGIN)).toBe(
      "/matt",
    );
  });

  it("treats a same-origin /grid/:id link as internal", () => {
    expect(
      resolveInternalGridRoute("https://grids.so/grid/abc123", PROD_ORIGIN),
    ).toBe("/grid/abc123");
  });

  it("preserves the query string", () => {
    expect(
      resolveInternalGridRoute("https://grids.so/matt?ref=tile", PROD_ORIGIN),
    ).toBe("/matt?ref=tile");
  });

  it("strips a trailing slash from the slug path", () => {
    expect(resolveInternalGridRoute("https://grids.so/matt/", PROD_ORIGIN)).toBe(
      "/matt",
    );
  });

  it("returns null for a different origin", () => {
    expect(resolveInternalGridRoute("https://example.com/matt", PROD_ORIGIN)).toBe(
      null,
    );
  });

  it("treats www.grids.so href as internal when the page is grids.so", () => {
    expect(
      resolveInternalGridRoute("https://www.grids.so/matt", PROD_ORIGIN),
    ).toBe("/matt");
  });

  it("treats grids.so href as internal when the page is www.grids.so", () => {
    expect(
      resolveInternalGridRoute(
        "https://grids.so/matt",
        "https://www.grids.so",
      ),
    ).toBe("/matt");
  });

  it("treats local alias hosts as internal on the same port", () => {
    expect(
      resolveInternalGridRoute(
        "https://127.0.0.1:5173/matt",
        LOCAL_ORIGIN,
      ),
    ).toBe("/matt");
    expect(
      resolveInternalGridRoute(
        "https://localhost:5173/grid/abc",
        LOCAL_ORIGIN,
      ),
    ).toBe("/grid/abc");
    expect(
      resolveInternalGridRoute(
        "https://127.0.0.1:5173/matt",
        "https://localhost:5173",
      ),
    ).toBe("/matt");
  });

  it("returns null for local default-port URLs when the dev server uses another port", () => {
    expect(
      resolveInternalGridRoute("https://localhost/matt", LOCAL_ORIGIN),
    ).toBe(null);
    expect(
      resolveInternalGridRoute("https://127.0.0.1/matt", LOCAL_ORIGIN),
    ).toBe(null);
  });

  it("treats default-port local URLs as internal when the page uses that port", () => {
    expect(
      resolveInternalGridRoute(
        "https://127.0.0.1/matt",
        "https://localhost",
      ),
    ).toBe("/matt");
    expect(
      resolveInternalGridRoute(
        "https://localhost/matt",
        "https://127.0.0.1",
      ),
    ).toBe("/matt");
  });

  it("does not treat production URLs as internal on localhost", () => {
    expect(
      resolveInternalGridRoute("https://grids.so/matt", LOCAL_ORIGIN),
    ).toBe(null);
  });

  it("returns null for reserved non-grid paths", () => {
    expect(resolveInternalGridRoute("https://grids.so/pricing", PROD_ORIGIN)).toBe(
      null,
    );
    expect(resolveInternalGridRoute("https://grids.so/dashboard", PROD_ORIGIN)).toBe(
      null,
    );
    expect(resolveInternalGridRoute("https://grids.so/", PROD_ORIGIN)).toBe(null);
  });

  it("returns null for multi-segment non-grid paths", () => {
    expect(
      resolveInternalGridRoute("https://grids.so/matt/extra", PROD_ORIGIN),
    ).toBe(null);
  });

  it("returns null for mailto/tel and other non-http schemes", () => {
    expect(resolveInternalGridRoute("mailto:hi@grids.so", PROD_ORIGIN)).toBe(null);
    expect(resolveInternalGridRoute("tel:+15551234567", PROD_ORIGIN)).toBe(null);
  });

  it("returns null for empty input", () => {
    expect(resolveInternalGridRoute("", PROD_ORIGIN)).toBe(null);
  });
});
