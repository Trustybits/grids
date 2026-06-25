import { describe, it, expect } from "vitest";
import {
  allowsOverflowScroll,
  isScrollableOverflow,
  shouldDisableTopBottomAlign,
  resolveVerticalAlignJustify,
  resolveActiveVerticalAlign,
  type VerticalAlign,
} from "@/utils/textTileAlign";

// ── allowsOverflowScroll ────────────────────────────────────────────────────

describe("allowsOverflowScroll", () => {
  it("is false for N×1 (single-row) tiles — they clip, never scroll", () => {
    expect(allowsOverflowScroll(true)).toBe(false);
  });

  it("is true for taller tiles — they scroll on overflow", () => {
    expect(allowsOverflowScroll(false)).toBe(true);
  });
});

// ── isScrollableOverflow ─────────────────────────────────────────────────────

describe("isScrollableOverflow", () => {
  it("is true only when a taller tile's text overflows", () => {
    expect(isScrollableOverflow(false, true)).toBe(true);
  });

  it("is false when a taller tile's text fits", () => {
    expect(isScrollableOverflow(false, false)).toBe(false);
  });

  it("is false on N×1 tiles even when overflowing (they clip, not scroll)", () => {
    expect(isScrollableOverflow(true, true)).toBe(false);
  });

  it("is false on N×1 tiles that fit", () => {
    expect(isScrollableOverflow(true, false)).toBe(false);
  });
});

// ── shouldDisableTopBottomAlign ──────────────────────────────────────────────

describe("shouldDisableTopBottomAlign", () => {
  it("disables top/bottom only on an N×1 tile whose text overflows", () => {
    expect(shouldDisableTopBottomAlign(true, true)).toBe(true);
  });

  it("keeps top/bottom enabled on an N×1 tile whose text fits", () => {
    expect(shouldDisableTopBottomAlign(true, false)).toBe(false);
  });

  it("never disables on taller tiles, even when overflowing", () => {
    expect(shouldDisableTopBottomAlign(false, true)).toBe(false);
    expect(shouldDisableTopBottomAlign(false, false)).toBe(false);
  });
});

// ── resolveVerticalAlignJustify ──────────────────────────────────────────────

describe("resolveVerticalAlignJustify", () => {
  describe("when text fits (no overflow)", () => {
    const cases: Array<[VerticalAlign, string]> = [
      ["top", "flex-start"],
      ["center", "center"],
      ["bottom", "flex-end"],
    ];

    it.each(cases)("maps %s → %s on a taller tile", (align, expected) => {
      expect(
        resolveVerticalAlignJustify({
          verticalAlign: align,
          isWideOneHigh: false,
          isTextOverflowing: false,
        }),
      ).toBe(expected);
    });

    it.each(cases)("maps %s → %s on an N×1 tile", (align, expected) => {
      expect(
        resolveVerticalAlignJustify({
          verticalAlign: align,
          isWideOneHigh: true,
          isTextOverflowing: false,
        }),
      ).toBe(expected);
    });
  });

  describe("when text overflows a taller (scrollable) tile", () => {
    it.each<VerticalAlign>(["top", "center", "bottom"])(
      "forces top (flex-start) regardless of stored align (%s) so the start stays reachable",
      (align) => {
        expect(
          resolveVerticalAlignJustify({
            verticalAlign: align,
            isWideOneHigh: false,
            isTextOverflowing: true,
          }),
        ).toBe("flex-start");
      },
    );
  });

  describe("when text overflows an N×1 tile", () => {
    it.each<VerticalAlign>(["top", "center", "bottom"])(
      "forces center regardless of stored align (%s) so it doesn't look inverted",
      (align) => {
        expect(
          resolveVerticalAlignJustify({
            verticalAlign: align,
            isWideOneHigh: true,
            isTextOverflowing: true,
          }),
        ).toBe("center");
      },
    );
  });
});

// ── resolveActiveVerticalAlign ───────────────────────────────────────────────

describe("resolveActiveVerticalAlign", () => {
  it("returns the stored value when the ends are enabled", () => {
    expect(resolveActiveVerticalAlign("top", false)).toBe("top");
    expect(resolveActiveVerticalAlign("center", false)).toBe("center");
    expect(resolveActiveVerticalAlign("bottom", false)).toBe("bottom");
  });

  it("reports center while the ends are disabled, regardless of stored value", () => {
    expect(resolveActiveVerticalAlign("top", true)).toBe("center");
    expect(resolveActiveVerticalAlign("bottom", true)).toBe("center");
    expect(resolveActiveVerticalAlign("center", true)).toBe("center");
  });
});
