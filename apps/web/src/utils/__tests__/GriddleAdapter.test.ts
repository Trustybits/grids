import { describe, expect, it } from "vitest";
import {
  ContentType,
  type LinkContent,
  type SuggestionContent,
  type Tile,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import {
  DEFAULT_DRAG_IGNORE_FROM,
  MAX_TILE_UNITS,
  MIN_TILE_UNITS,
  buildGridConfig,
  buildGridSnapshot,
  defaultTileCaps,
  fromGriddleTile,
  fromGriddleTiles,
  toGriddleTile,
  toGriddleTiles,
  type GriddleTileCaps,
} from "../GriddleAdapter";

function layoutItem(
  i: string,
  x: number,
  y: number,
  w: number,
  h: number,
): GridLayoutItem {
  return { i, x, y, w, h };
}

function tile(
  i: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Tile {
  return {
    ...layoutItem(i, x, y, w, h),
    caption: `Caption ${i}`,
    borderEnabled: true,
    content: {
      type: ContentType.LINK,
      link: `https://${i}.example`,
      metaTitle: `Title ${i}`,
    } as LinkContent,
  };
}

function suggestionTile(i: string): Tile {
  return {
    ...layoutItem(i, 0, 0, 1, 1),
    caption: "",
    content: {
      type: ContentType.SUGGESTION,
      action: "text",
    } as SuggestionContent,
  };
}

const FULL_CAPS: GriddleTileCaps = {
  draggable: true,
  resizable: true,
  minW: MIN_TILE_UNITS,
  minH: MIN_TILE_UNITS,
  maxW: MAX_TILE_UNITS,
  maxH: MAX_TILE_UNITS,
};

describe("defaultTileCaps", () => {
  it("gates draggable/resizable on editability", () => {
    const editable = defaultTileCaps(tile("a", 0, 0, 2, 2), true);
    expect(editable.draggable).toBe(true);
    expect(editable.resizable).toBe(true);

    const locked = defaultTileCaps(tile("a", 0, 0, 2, 2), false);
    expect(locked.draggable).toBe(false);
    expect(locked.resizable).toBe(false);
  });

  it("never marks a suggestion tile resizable, even when editable", () => {
    const caps = defaultTileCaps(suggestionTile("s"), true);
    expect(caps.draggable).toBe(true);
    expect(caps.resizable).toBe(false);
  });

  it("applies the fixed min/max footprint clamps", () => {
    const caps = defaultTileCaps(tile("a", 0, 0, 2, 2), true);
    expect(caps).toMatchObject({
      minW: MIN_TILE_UNITS,
      minH: MIN_TILE_UNITS,
      maxW: MAX_TILE_UNITS,
      maxH: MAX_TILE_UNITS,
    });
  });

  it("treats a missing tile as non-suggestion", () => {
    const caps = defaultTileCaps(undefined, true);
    expect(caps.resizable).toBe(true);
  });
});

describe("toGriddleTile", () => {
  it("renames i/x/y to id/col/row and carries caps", () => {
    expect(toGriddleTile(layoutItem("a", 3, 4, 2, 5), FULL_CAPS)).toEqual({
      id: "a",
      col: 3,
      row: 4,
      w: 2,
      h: 5,
      draggable: true,
      resizable: true,
      minW: MIN_TILE_UNITS,
      minH: MIN_TILE_UNITS,
      maxW: MAX_TILE_UNITS,
      maxH: MAX_TILE_UNITS,
    });
  });
});

describe("toGriddleTiles", () => {
  const items = [layoutItem("a", 0, 0, 2, 2), layoutItem("b", 2, 0, 1, 1)];

  it("maps every item and matches caps by tile id", () => {
    const tiles = [tile("a", 0, 0, 2, 2), suggestionTile("b")];
    const result = toGriddleTiles(items, tiles, { editable: true });

    expect(result.map((t) => t.id)).toEqual(["a", "b"]);
    // "a" is a normal tile → resizable; "b" is a suggestion → not resizable.
    expect(result[0]).toMatchObject({ draggable: true, resizable: true });
    expect(result[1]).toMatchObject({ draggable: true, resizable: false });
  });

  it("defaults to non-editable (view-only) when editable is omitted", () => {
    const result = toGriddleTiles(items, [tile("a", 0, 0, 2, 2)]);
    for (const t of result) {
      expect(t.draggable).toBe(false);
      expect(t.resizable).toBe(false);
    }
  });

  it("treats an item with no matching contract tile as a plain tile", () => {
    const result = toGriddleTiles([layoutItem("ghost", 1, 1, 1, 1)], [], {
      editable: true,
    });
    expect(result[0]).toMatchObject({
      id: "ghost",
      draggable: true,
      resizable: true,
    });
  });

  it("lets resolveCaps override the derived defaults", () => {
    const result = toGriddleTiles(items, [tile("a", 0, 0, 2, 2)], {
      editable: true,
      resolveCaps: (t) =>
        t?.i === "a" ? { draggable: false, maxW: 4 } : {},
    });
    // "a" override applied over editable defaults.
    expect(result[0]).toMatchObject({
      draggable: false,
      resizable: true,
      maxW: 4,
    });
    // "b" (no matching tile, no override) keeps editable defaults.
    expect(result[1]).toMatchObject({ draggable: true, maxW: MAX_TILE_UNITS });
  });

  it("passes the derived defaults into resolveCaps", () => {
    const seen: GriddleTileCaps[] = [];
    toGriddleTiles([layoutItem("s", 0, 0, 1, 1)], [suggestionTile("s")], {
      editable: true,
      resolveCaps: (_t, defaults) => {
        seen.push(defaults);
        return {};
      },
    });
    expect(seen).toEqual([
      expect.objectContaining({ draggable: true, resizable: false }),
    ]);
  });
});

describe("fromGriddleTile / fromGriddleTiles", () => {
  it("renames id/col/row back to i/x/y and drops caps", () => {
    expect(
      fromGriddleTile({
        id: "a",
        col: 3,
        row: 4,
        w: 2,
        h: 5,
        draggable: true,
        resizable: true,
      }),
    ).toEqual({ i: "a", x: 3, y: 4, w: 2, h: 5 });
  });

  it("round-trips a layout item through to/from", () => {
    const original = layoutItem("a", 6, 7, 3, 2);
    expect(fromGriddleTile(toGriddleTile(original, FULL_CAPS))).toEqual(
      original,
    );
  });

  it("maps a full set", () => {
    const griddleTiles = [
      { id: "a", col: 0, row: 0, w: 1, h: 1 },
      { id: "b", col: 1, row: 2, w: 3, h: 4 },
    ];
    expect(fromGriddleTiles(griddleTiles)).toEqual([
      { i: "a", x: 0, y: 0, w: 1, h: 1 },
      { i: "b", x: 1, y: 2, w: 3, h: 4 },
    ]);
  });
});

describe("buildGridConfig", () => {
  it("maps the fixed-cell params to unitWidth/unitHeight/gap", () => {
    const config = buildGridConfig({ cols: 12, rowHeight: 75, margin: 48 });
    expect(config).toMatchObject({
      cols: 12,
      unitWidth: 75,
      unitHeight: 75,
      gap: 48,
    });
  });

  it("defaults rows to Infinity for unbounded vertical growth", () => {
    expect(buildGridConfig({ cols: 12, rowHeight: 75, margin: 48 }).rows).toBe(
      Infinity,
    );
  });

  it("maps verticalCompact to gravity", () => {
    expect(
      buildGridConfig({ cols: 6, rowHeight: 75, margin: 48 }).gravity,
    ).toBe("none");
    expect(
      buildGridConfig({
        cols: 6,
        rowHeight: 75,
        margin: 48,
        verticalCompact: true,
      }).gravity,
    ).toBe("top");
  });

  it("defaults dragIgnoreFrom and snapDuringDrag", () => {
    const config = buildGridConfig({ cols: 6, rowHeight: 75, margin: 48 });
    expect(config.dragIgnoreFrom).toBe(DEFAULT_DRAG_IGNORE_FROM);
    expect(config.snapDuringDrag).toBe(true);
  });

  it.each([
    ".tile-caption",
    ".tile-link-indicator",
    ".tile-title",
    ".tile-details",
    ".chat-bubble-wrapper",
    ".video-main",
    ".progress-container",
    ".track-progress",
    ".yt-video-card",
    ".avatar",
    ".map-canvas.is-interactive",
    ".image-wrapper.crop-active",
    ".video-wrapper.crop-active",
  ])("preserves the custom tile interaction surface %s", (selector) => {
    expect(DEFAULT_DRAG_IGNORE_FROM.split(", ")).toContain(selector);
  });

  it("omits resizeHandles, tileRadius, scroll, and interactive when not provided (uses Griddle defaults)", () => {
    const config = buildGridConfig({ cols: 6, rowHeight: 75, margin: 48 });
    expect(config).not.toHaveProperty("resizeHandles");
    expect(config).not.toHaveProperty("tileRadius");
    expect(config).not.toHaveProperty("scroll");
    expect(config).not.toHaveProperty("interactive");
  });

  it("passes through scroll mode", () => {
    expect(
      buildGridConfig({ cols: 6, rowHeight: 75, margin: 48, scroll: "none" })
        .scroll,
    ).toBe("none");
  });

  it("wraps drawToCreate in an interactive config", () => {
    expect(
      buildGridConfig({
        cols: 6,
        rowHeight: 75,
        margin: 48,
        drawToCreate: false,
      }).interactive,
    ).toEqual({ drawToCreate: false });
  });

  it("passes through explicit resizeHandles, tileRadius, rows, and overrides", () => {
    const config = buildGridConfig({
      cols: 3,
      rowHeight: 75,
      margin: 48,
      rows: 40,
      resizeHandles: ["se", "sw"],
      tileRadius: 12,
      dragIgnoreFrom: ".only-this",
      snapDuringDrag: false,
    });
    expect(config).toMatchObject({
      rows: 40,
      resizeHandles: ["se", "sw"],
      tileRadius: 12,
      dragIgnoreFrom: ".only-this",
      snapDuringDrag: false,
    });
  });
});

describe("buildGridSnapshot", () => {
  it("assembles a version-1 snapshot with mapped tiles and the given config", () => {
    const config = buildGridConfig({ cols: 12, rowHeight: 75, margin: 48 });
    const snapshot = buildGridSnapshot(
      [layoutItem("a", 0, 0, 2, 2)],
      [tile("a", 0, 0, 2, 2)],
      config,
      { editable: true },
    );

    expect(snapshot.version).toBe(1);
    expect(snapshot.config).toBe(config);
    expect(snapshot.tiles).toEqual([
      toGriddleTile(layoutItem("a", 0, 0, 2, 2), FULL_CAPS),
    ]);
  });
});
