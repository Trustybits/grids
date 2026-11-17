import { describe, expect, it } from "vitest";
import { ContentType } from "@grids/contracts/types";
import { normalizeTileLink, supportsTileLink } from "../tileLink";

describe("normalizeTileLink", () => {
  it("adds https to bare hosts and keeps explicit schemes", () => {
    expect(normalizeTileLink(" example.com ")).toBe("https://example.com");
    expect(normalizeTileLink("http://a.io/x")).toBe("http://a.io/x");
    expect(normalizeTileLink("localhost:5173")).toBe("https://localhost:5173");
  });

  it("rejects text that isn't a link", () => {
    expect(normalizeTileLink("")).toBe("");
    expect(normalizeTileLink("not a link")).toBe("");
    expect(normalizeTileLink("hello")).toBe("");
    expect(normalizeTileLink("https://")).toBe("");
  });
});

describe("supportsTileLink", () => {
  it("covers text, smart text, image and video only", () => {
    expect(supportsTileLink(ContentType.TEXT)).toBe(true);
    expect(supportsTileLink(ContentType.VIDEO)).toBe(true);
    expect(supportsTileLink(ContentType.LINK)).toBe(false);
  });
});
