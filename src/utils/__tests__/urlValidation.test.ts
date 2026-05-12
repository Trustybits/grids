import { describe, expect, it } from "vitest";
import {
  extractIframeSrc,
  isValidEmbed,
  isValidLink,
} from "@/utils/urlValidation";

describe("extractIframeSrc", () => {
  it("returns the src for an iframe with double-quoted src", () => {
    const html = '<iframe src="https://example.com/embed"></iframe>';
    expect(extractIframeSrc(html)).toBe("https://example.com/embed");
  });

  it("returns the src for an iframe with single-quoted src", () => {
    const html = "<iframe src='https://example.com/embed'></iframe>";
    expect(extractIframeSrc(html)).toBe("https://example.com/embed");
  });

  it("matches an uppercase IFRAME tag (case-insensitive)", () => {
    const html = '<IFRAME SRC="https://example.com/embed"></IFRAME>';
    expect(extractIframeSrc(html)).toBe("https://example.com/embed");
  });

  it("returns the src when other attributes appear before src", () => {
    const html =
      '<iframe width="560" height="315" src="https://example.com/embed" frameborder="0"></iframe>';
    expect(extractIframeSrc(html)).toBe("https://example.com/embed");
  });

  it("returns null when the iframe has no src attribute", () => {
    const html = "<iframe></iframe>";
    expect(extractIframeSrc(html)).toBeNull();
  });

  it("returns null for input that contains no iframe tag", () => {
    expect(extractIframeSrc("just a string of text")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractIframeSrc("")).toBeNull();
  });

  it("returns null when src has no closing quote", () => {
    // Regex requires a matching closing quote; unterminated src should not match.
    const html = '<iframe src="https://example.com/embed></iframe>';
    expect(extractIframeSrc(html)).toBeNull();
  });
});

describe("isValidLink", () => {
  // Empty / whitespace
  it("returns false for an empty string", () => {
    expect(isValidLink("")).toBe(false);
  });

  it("returns false for whitespace-only input", () => {
    expect(isValidLink("   \t\n")).toBe(false);
  });

  // http(s) URLs
  it("accepts an http URL", () => {
    expect(isValidLink("http://example.com")).toBe(true);
  });

  it("accepts an https URL", () => {
    expect(isValidLink("https://example.com/path?query=1")).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidLink("   https://example.com   ")).toBe(true);
  });

  // mailto: / tel:
  it("accepts a mailto: URL", () => {
    expect(isValidLink("mailto:user@example.com")).toBe(true);
  });

  it("accepts a tel: URL", () => {
    expect(isValidLink("tel:+15551234567")).toBe(true);
  });

  it("accepts MAILTO: in uppercase (case-insensitive scheme)", () => {
    expect(isValidLink("MAILTO:user@example.com")).toBe(true);
  });

  // Bare domain
  it("accepts a bare domain that contains a dot", () => {
    expect(isValidLink("example.com")).toBe(true);
  });

  it("accepts a subdomain.bare domain", () => {
    expect(isValidLink("sub.example.com/path")).toBe(true);
  });

  it("rejects a bare token with no dot", () => {
    expect(isValidLink("example")).toBe(false);
  });

  // Malformed
  it("rejects http:// with no host", () => {
    expect(isValidLink("http://")).toBe(false);
  });

  it("rejects a stray scheme separator", () => {
    expect(isValidLink("://")).toBe(false);
  });
});

describe("isValidEmbed", () => {
  // Empty / whitespace
  it("returns false for an empty string", () => {
    expect(isValidEmbed("")).toBe(false);
  });

  it("returns false for whitespace-only input", () => {
    expect(isValidEmbed("   ")).toBe(false);
  });

  // iframe snippets
  it("accepts an iframe snippet with a valid src", () => {
    expect(
      isValidEmbed('<iframe src="https://example.com/embed"></iframe>'),
    ).toBe(true);
  });

  it("accepts an uppercase IFRAME snippet with a valid src", () => {
    expect(
      isValidEmbed('<IFRAME SRC="https://example.com/embed"></IFRAME>'),
    ).toBe(true);
  });

  it("rejects an iframe snippet that has no src attribute", () => {
    expect(isValidEmbed("<iframe></iframe>")).toBe(false);
  });

  // URLs
  it("accepts an https URL", () => {
    expect(isValidEmbed("https://example.com/watch?v=abc")).toBe(true);
  });

  it("accepts an http URL", () => {
    expect(isValidEmbed("http://example.com")).toBe(true);
  });

  it("accepts a bare domain that contains a dot", () => {
    expect(isValidEmbed("example.com")).toBe(true);
  });

  it("rejects a bare token with no dot", () => {
    expect(isValidEmbed("example")).toBe(false);
  });

  // mailto/tel are NOT valid embeds (intentional difference vs. isValidLink)
  it("rejects mailto: schemes (embeds disallow them)", () => {
    // No leading "<iframe", not http(s), and "mailto:user" has no dot →
    // bare-domain branch is skipped → falls through to false.
    expect(isValidEmbed("mailto:user")).toBe(false);
  });

  it("rejects tel: schemes (embeds disallow them)", () => {
    expect(isValidEmbed("tel:+15551234567")).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidEmbed("   https://example.com   ")).toBe(true);
  });
});
