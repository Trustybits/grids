import { describe, expect, it } from "vitest";
import { keptTileId, scrollToFit } from "../useKeepEditedTileInView";

describe("keptTileId", () => {
  it("keeps the selected tile while its toolbar, a card, the sheet or a mode is up", () => {
    expect(keptTileId({ kind: "tile", tileId: "a" })).toBe("a");
    expect(keptTileId({ kind: "popover", tileId: "a", toolId: "fill" })).toBe("a");
    expect(keptTileId({ kind: "sheet", tileId: "a" })).toBe("a");
    expect(keptTileId({ kind: "mode", tileId: "a" })).toBe("a");
  });

  it("leaves the page alone at home, while typing, arranging or picking", () => {
    expect(keptTileId({ kind: "home" })).toBeNull();
    expect(keptTileId({ kind: "typing", tileId: "a" })).toBeNull();
    expect(keptTileId({ kind: "arrange", tileId: "a" })).toBeNull();
    expect(keptTileId({ kind: "multi", tileIds: ["a", "b"] })).toBeNull();
  });

  it("keeps the latest pick in multi-edit while a card or the sheet is open", () => {
    expect(
      keptTileId({ kind: "multi-popover", tileIds: ["a", "b"], toolId: "fill" }),
    ).toBe("b");
    expect(keptTileId({ kind: "multi-sheet", tileIds: ["a", "b"] })).toBe("b");
  });
});

describe("scrollToFit", () => {
  const band = { top: 100, bottom: 400 };

  it("doesn't move a tile that already fits", () => {
    expect(scrollToFit(150, 300, band)).toBe(0);
  });

  it("scrolls down just enough for a tile under the bottom chrome", () => {
    expect(scrollToFit(350, 480, band)).toBe(80);
  });

  it("scrolls up just enough for a tile under the top chrome", () => {
    expect(scrollToFit(40, 200, band)).toBe(-60);
  });

  it("shows the top of a tile taller than the space", () => {
    expect(scrollToFit(250, 700, band)).toBe(150);
    expect(scrollToFit(20, 500, band)).toBe(-80);
  });
});
