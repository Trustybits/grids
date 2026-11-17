import { describe, expect, it } from "vitest";
import { ContentType } from "@grids/contracts/types";
import {
  fillOptionsFor,
  fillPatch,
  overlayPatch,
  readPickerFill,
  readPickerOverlay,
  resolveColorMode,
  resolveOverlayColor,
  storedFillColor,
} from "../tileFill";

const media = fillOptionsFor(ContentType.IMAGE)!;
const preview = fillOptionsFor(ContentType.LINK)!;
const plain = fillOptionsFor(ContentType.TEXT)!;

describe("fillOptionsFor", () => {
  it("covers exactly the types with a fill control", () => {
    expect(fillOptionsFor(ContentType.TEXT)).toEqual({});
    expect(fillOptionsFor(ContentType.PROFILE)).toEqual({});
    expect(fillOptionsFor(ContentType.VIDEO)).toEqual(media);
    expect(fillOptionsFor(ContentType.DOCUMENT)).toEqual(preview);
    // No fill control: Roadmap's button never worked, the rest never had one.
    expect(fillOptionsFor(ContentType.ROADMAP_FEED)).toBeNull();
    expect(fillOptionsFor(ContentType.MAP)).toBeNull();
    expect(fillOptionsFor(ContentType.EMBED)).toBeNull();
  });
});

describe("legacy media tiles (tint stored in backgroundColor)", () => {
  const legacy = { backgroundColor: "var(--color-red)" };

  it("reads the chromatic background as the overlay until one is set", () => {
    expect(resolveOverlayColor(legacy, media)).toBe("var(--color-red)");
    expect(resolveColorMode(legacy, media)).toBe("overlay");
    expect(readPickerFill(legacy, media)).toBe("");
    expect(readPickerOverlay(legacy, media)).toBe("var(--color-red)");
    expect(storedFillColor(legacy, media)).toBeUndefined();
  });

  it("promotes the tint to an explicit overlay on the first fill edit", () => {
    expect(fillPatch(legacy, "var(--color-blue)", media)).toEqual({
      backgroundColor: "var(--color-blue)",
      colorMode: "fill",
      overlayColor: "var(--color-red)",
    });
  });

  it("clears the legacy tint from the fill on the first overlay edit", () => {
    expect(overlayPatch(legacy, "var(--color-blue)", media)).toEqual({
      overlayColor: "var(--color-blue)",
      colorMode: "overlay",
      backgroundColor: "",
    });
  });

  it("treats the fill as a fill once an overlay is explicit", () => {
    const settled = { backgroundColor: "var(--color-red)", overlayColor: "" };
    expect(readPickerFill(settled, media)).toBe("var(--color-red)");
    expect(resolveOverlayColor(settled, media)).toBeNull();
    expect(fillPatch(settled, "var(--color-green)", media)).toEqual({
      backgroundColor: "var(--color-green)",
      colorMode: "fill",
    });
  });
});

describe("preview tiles (fill also tints)", () => {
  it("keeps the fill while the same color drives the overlay", () => {
    const content = { backgroundColor: "var(--color-pink)" };
    expect(readPickerFill(content, preview)).toBe("var(--color-pink)");
    expect(resolveOverlayColor(content, preview)).toBe("var(--color-pink)");
    expect(fillPatch(content, "var(--color-blue)", preview)).toEqual({
      backgroundColor: "var(--color-blue)",
      colorMode: "fill",
    });
  });
});

describe("tiles without an overlay", () => {
  it("never carries a mode or overlay", () => {
    const content = { backgroundColor: "var(--color-red)" };
    expect(resolveOverlayColor(content, plain)).toBeNull();
    expect(fillPatch(content, "var(--color-blue)", plain)).toEqual({
      backgroundColor: "var(--color-blue)",
    });
  });

  it("clears an overlay when a structural color is picked", () => {
    expect(
      overlayPatch(
        { overlayColor: "var(--color-red)" },
        "var(--color-tile-background)",
        media,
      ),
    ).toEqual({ overlayColor: "", colorMode: "overlay" });
  });
});
