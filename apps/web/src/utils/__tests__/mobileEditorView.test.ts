import { describe, expect, it } from "vitest";
import {
  deriveMobileEditorView,
  dimsOtherTiles,
  editedTileIds,
  type MobileEditorFacts,
} from "../mobileEditorView";

const facts = (overrides: Partial<MobileEditorFacts> = {}): MobileEditorFacts => ({
  editTileId: null,
  multiSelectIds: null,
  arrangeTileId: null,
  openToolId: null,
  sheetExpanded: false,
  isTyping: false,
  isInToolMode: false,
  ...overrides,
});

describe("deriveMobileEditorView", () => {
  it("is home with nothing selected", () => {
    expect(deriveMobileEditorView(facts())).toEqual({ kind: "home" });
  });

  it("shows the tile toolbar for a plain selection", () => {
    expect(deriveMobileEditorView(facts({ editTileId: "a" }))).toEqual({
      kind: "tile",
      tileId: "a",
    });
  });

  it("names the popover, sheet and arrange states", () => {
    expect(
      deriveMobileEditorView(facts({ editTileId: "a", openToolId: "fill" })),
    ).toEqual({ kind: "popover", tileId: "a", toolId: "fill" });
    expect(
      deriveMobileEditorView(facts({ editTileId: "a", sheetExpanded: true })),
    ).toEqual({ kind: "sheet", tileId: "a" });
    expect(
      deriveMobileEditorView(facts({ editTileId: "a", arrangeTileId: "a" })),
    ).toEqual({ kind: "arrange", tileId: "a" });
  });

  it("lets the tile's own typing and modes win over chrome state", () => {
    expect(
      deriveMobileEditorView(
        facts({ editTileId: "a", openToolId: "fill", isTyping: true }),
      ),
    ).toEqual({ kind: "typing", tileId: "a" });
    expect(
      deriveMobileEditorView(
        facts({ editTileId: "a", sheetExpanded: true, isInToolMode: true }),
      ),
    ).toEqual({ kind: "mode", tileId: "a" });
  });

  it("arranges a held tile even before it was tapped", () => {
    expect(deriveMobileEditorView(facts({ arrangeTileId: "b" }))).toEqual({
      kind: "arrange",
      tileId: "b",
    });
  });

  it("puts multi-edit above everything else", () => {
    const multi = facts({ editTileId: "a", multiSelectIds: ["a", "b"] });
    expect(deriveMobileEditorView(multi)).toEqual({
      kind: "multi",
      tileIds: ["a", "b"],
    });
    expect(
      deriveMobileEditorView({ ...multi, openToolId: "border" }),
    ).toEqual({ kind: "multi-popover", tileIds: ["a", "b"], toolId: "border" });
    expect(
      deriveMobileEditorView({ ...multi, sheetExpanded: true }),
    ).toEqual({ kind: "multi-sheet", tileIds: ["a", "b"] });
  });
});

describe("editedTileIds / dimsOtherTiles", () => {
  it("lists the tiles each view edits", () => {
    expect(editedTileIds({ kind: "home" })).toEqual([]);
    expect(editedTileIds({ kind: "tile", tileId: "a" })).toEqual(["a"]);
    expect(editedTileIds({ kind: "multi", tileIds: ["a", "b"] })).toEqual([
      "a",
      "b",
    ]);
  });

  it("never dims while arranging, so the whole grid stays in view", () => {
    expect(dimsOtherTiles({ kind: "home" })).toBe(false);
    expect(dimsOtherTiles({ kind: "arrange", tileId: "a" })).toBe(false);
    expect(dimsOtherTiles({ kind: "tile", tileId: "a" })).toBe(true);
    expect(dimsOtherTiles({ kind: "multi", tileIds: ["a"] })).toBe(true);
  });
});
