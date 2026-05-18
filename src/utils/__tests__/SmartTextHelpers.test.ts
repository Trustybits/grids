/**
 * Tests for smartTextHelpers.ts
 *
 * Covers pure helper functions extracted from SmartTextContent.vue:
 *  - normalizeHttpUrl (URL normalization)
 *  - fontSizeLabelToPx / pxToFontSizeLabel (font size mapping)
 *  - getDefaultFont (font fallback)
 *  - filterSlashCommands (slash menu filtering)
 *  - isTallOneWide / isWideOneHigh / isOneByOne (tile dimension checks)
 */

import { describe, it, expect } from "vitest";
import {
  normalizeHttpUrl,
  fontSizeLabelToPx,
  pxToFontSizeLabel,
  getDefaultFont,
  filterSlashCommands,
  SLASH_COMMAND_DEFS,
  isTallOneWide,
  isWideOneHigh,
  isOneByOne,
} from "@/utils/smartTextHelpers";

// ── normalizeHttpUrl ────────────────────────────────────────────────────────

describe("normalizeHttpUrl", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeHttpUrl("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeHttpUrl("   ")).toBe("");
  });

  it("preserves https:// URLs", () => {
    expect(normalizeHttpUrl("https://example.com")).toBe("https://example.com");
  });

  it("preserves http:// URLs", () => {
    expect(normalizeHttpUrl("http://example.com")).toBe("http://example.com");
  });

  it("prepends https:// when no protocol", () => {
    expect(normalizeHttpUrl("example.com")).toBe("https://example.com");
  });

  it("trims whitespace before processing", () => {
    expect(normalizeHttpUrl("  https://example.com  ")).toBe(
      "https://example.com"
    );
  });

  it("prepends https:// to trimmed bare domain", () => {
    expect(normalizeHttpUrl("  example.com/path  ")).toBe(
      "https://example.com/path"
    );
  });
});

// ── fontSizeLabelToPx ───────────────────────────────────────────────────────

describe("fontSizeLabelToPx", () => {
  it.each([
    ["Small", "12px"],
    ["Medium", "14px"],
    ["Large", "20px"],
    ["Larger", "26px"],
  ])('maps "%s" to %s', (label, expected) => {
    expect(fontSizeLabelToPx(label)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(fontSizeLabelToPx("small")).toBe("12px");
    expect(fontSizeLabelToPx("LARGE")).toBe("20px");
    expect(fontSizeLabelToPx("  medium  ")).toBe("14px");
  });

  it('defaults to "14px" for unknown labels', () => {
    expect(fontSizeLabelToPx("huge")).toBe("14px");
    expect(fontSizeLabelToPx("")).toBe("14px");
  });
});

// ── pxToFontSizeLabel ───────────────────────────────────────────────────────

describe("pxToFontSizeLabel", () => {
  it.each([
    ["12px", "Small"],
    ["14px", "Medium"],
    ["20px", "Large"],
    ["26px", "Larger"],
  ])('maps "%s" to "%s"', (px, expected) => {
    expect(pxToFontSizeLabel(px)).toBe(expected);
  });

  it('returns "Medium" for undefined/null', () => {
    expect(pxToFontSizeLabel(undefined)).toBe("Medium");
    expect(pxToFontSizeLabel(null)).toBe("Medium");
  });

  it("returns the raw px value for unknown sizes", () => {
    expect(pxToFontSizeLabel("99px")).toBe("99px");
  });
});

// ── getDefaultFont ──────────────────────────────────────────────────────────

describe("getDefaultFont", () => {
  it('returns "Inter" when fontFamily is undefined', () => {
    expect(getDefaultFont(undefined)).toBe("Inter");
  });

  it('returns "Inter" when fontFamily is null', () => {
    expect(getDefaultFont(null)).toBe("Inter");
  });

  it('returns "Inter" when fontFamily is empty string', () => {
    expect(getDefaultFont("")).toBe("Inter");
  });

  it("returns the provided font family when set", () => {
    expect(getDefaultFont("Georgia")).toBe("Georgia");
    expect(getDefaultFont("Fira Code")).toBe("Fira Code");
  });
});

// ── filterSlashCommands ─────────────────────────────────────────────────────

describe("filterSlashCommands", () => {
  it("returns all commands when query is empty", () => {
    expect(filterSlashCommands(SLASH_COMMAND_DEFS, "")).toEqual(
      SLASH_COMMAND_DEFS
    );
  });

  it("returns all commands when query is whitespace", () => {
    expect(filterSlashCommands(SLASH_COMMAND_DEFS, "   ")).toEqual(
      SLASH_COMMAND_DEFS
    );
  });

  it('filters by keyword: "h1" returns only Heading 1', () => {
    const results = filterSlashCommands(SLASH_COMMAND_DEFS, "h1");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("h1");
  });

  it('filters by keyword: "heading" returns both heading commands', () => {
    const results = filterSlashCommands(SLASH_COMMAND_DEFS, "heading");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(["h1", "h2"]);
  });

  it('filters by keyword: "list" returns bullet list', () => {
    const results = filterSlashCommands(SLASH_COMMAND_DEFS, "list");
    expect(results.some((r) => r.id === "bullet")).toBe(true);
  });

  it('filters by keyword: "link" matches both link and button', () => {
    const results = filterSlashCommands(SLASH_COMMAND_DEFS, "link");
    expect(results.some((r) => r.id === "link")).toBe(true);
    expect(results.some((r) => r.id === "button")).toBe(true);
  });

  it("is case-insensitive", () => {
    const results = filterSlashCommands(SLASH_COMMAND_DEFS, "TABLE");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("table");
  });

  it("returns empty array for unmatched query", () => {
    const results = filterSlashCommands(SLASH_COMMAND_DEFS, "zzzzz");
    expect(results).toHaveLength(0);
  });

  it("matches partial keywords", () => {
    const results = filterSlashCommands(SLASH_COMMAND_DEFS, "quot");
    expect(results.some((r) => r.id === "quote")).toBe(true);
  });
});

// ── SLASH_COMMAND_DEFS ──────────────────────────────────────────────────────

describe("SLASH_COMMAND_DEFS", () => {
  it("has unique ids", () => {
    const ids = SLASH_COMMAND_DEFS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every command has at least one keyword", () => {
    for (const cmd of SLASH_COMMAND_DEFS) {
      expect(cmd.keywords.length).toBeGreaterThan(0);
    }
  });

  it("contains the expected set of commands", () => {
    const ids = SLASH_COMMAND_DEFS.map((c) => c.id);
    expect(ids).toContain("h1");
    expect(ids).toContain("h2");
    expect(ids).toContain("bullet");
    expect(ids).toContain("numbered");
    expect(ids).toContain("todo");
    expect(ids).toContain("quote");
    expect(ids).toContain("divider");
    expect(ids).toContain("image");
    expect(ids).toContain("link");
    expect(ids).toContain("button");
    expect(ids).toContain("table");
  });
});

// ── Tile dimension helpers ──────────────────────────────────────────────────

describe("isTallOneWide", () => {
  it("returns true for 1 wide, >1 tall", () => {
    expect(isTallOneWide({ width: 1, height: 2 })).toBe(true);
    expect(isTallOneWide({ width: 1, height: 5 })).toBe(true);
  });

  it("returns false for 1x1", () => {
    expect(isTallOneWide({ width: 1, height: 1 })).toBe(false);
  });

  it("returns false for wider tiles", () => {
    expect(isTallOneWide({ width: 2, height: 3 })).toBe(false);
  });

  it("returns false for 0 dimensions", () => {
    expect(isTallOneWide({ width: 0, height: 0 })).toBe(false);
  });
});

describe("isWideOneHigh", () => {
  it("returns true for >1 wide, 1 tall", () => {
    expect(isWideOneHigh({ width: 2, height: 1 })).toBe(true);
    expect(isWideOneHigh({ width: 5, height: 1 })).toBe(true);
  });

  it("returns false for 1x1", () => {
    expect(isWideOneHigh({ width: 1, height: 1 })).toBe(false);
  });

  it("returns false for taller tiles", () => {
    expect(isWideOneHigh({ width: 2, height: 2 })).toBe(false);
  });
});

describe("isOneByOne", () => {
  it("returns true for exactly 1x1", () => {
    expect(isOneByOne({ width: 1, height: 1 })).toBe(true);
  });

  it("returns false for wider tiles", () => {
    expect(isOneByOne({ width: 2, height: 1 })).toBe(false);
  });

  it("returns false for taller tiles", () => {
    expect(isOneByOne({ width: 1, height: 2 })).toBe(false);
  });

  it("returns false for 0x0", () => {
    expect(isOneByOne({ width: 0, height: 0 })).toBe(false);
  });
});
