import { describe, expect, it } from "vitest";
import {
  ContentType,
  type Breakpoint,
  type LinkContent,
  type Tile,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import {
  breakpointToColumnCount,
  calculateViewportColumnCount,
  columnCountToBreakpoint,
  findFirstAvailableLayoutSpot,
  gridItemsOverlap,
  packGridLayout,
  projectGridLayout,
  reconcileGridLayout,
  scaleLayoutItemToFit,
} from "../GridLayoutUtils";

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

describe("gridItemsOverlap", () => {
  it("detects intersecting rectangles", () => {
    expect(
      gridItemsOverlap(
        layoutItem("a", 0, 0, 2, 2),
        layoutItem("b", 1, 1, 2, 2),
      ),
    ).toBe(true);
  });

  it("does not treat touching edges as overlap", () => {
    expect(
      gridItemsOverlap(
        layoutItem("a", 0, 0, 2, 2),
        layoutItem("b", 2, 0, 2, 2),
      ),
    ).toBe(false);
  });
});

describe("findFirstAvailableLayoutSpot", () => {
  it("finds the first open position from the requested row", () => {
    const placed = [
      layoutItem("a", 0, 3, 2, 2),
      layoutItem("b", 2, 3, 2, 2),
    ];

    expect(findFirstAvailableLayoutSpot(placed, 2, 2, 6, 3)).toEqual({
      x: 4,
      y: 3,
    });
  });

  it("clamps a negative starting row to zero", () => {
    expect(findFirstAvailableLayoutSpot([], 2, 2, 4, -5)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("rejects a width that cannot fit in the grid", () => {
    expect(() =>
      findFirstAvailableLayoutSpot([], 5, 2, 4),
    ).toThrowError("width cannot exceed columns");
  });
});

describe("scaleLayoutItemToFit", () => {
  it("returns a copy when the item already fits", () => {
    const item = layoutItem("a", 1, 2, 4, 3);

    const result = scaleLayoutItemToFit(item, 4);

    expect(result).toEqual(item);
    expect(result).not.toBe(item);
  });

  it("scales width and height proportionally when the item is too wide", () => {
    expect(
      scaleLayoutItemToFit(layoutItem("a", 2, 3, 8, 6), 4),
    ).toEqual(layoutItem("a", 2, 3, 4, 3));
  });

  it("keeps the scaled height at least one row", () => {
    expect(
      scaleLayoutItemToFit(layoutItem("a", 0, 0, 12, 1), 4).h,
    ).toBe(1);
  });
});

describe("packGridLayout", () => {
  it("keeps valid non-overlapping positions", () => {
    const items = [
      layoutItem("a", 0, 0, 2, 2),
      layoutItem("b", 2, 0, 2, 2),
    ];

    expect(packGridLayout(items, 4)).toEqual(items);
  });

  it("repositions overlaps deterministically while returning input order", () => {
    const items = [
      layoutItem("b", 0, 0, 2, 2),
      layoutItem("a", 0, 0, 2, 2),
    ];

    expect(packGridLayout(items, 4)).toEqual([
      layoutItem("b", 2, 0, 2, 2),
      layoutItem("a", 0, 0, 2, 2),
    ]);
  });

  it("scales and repositions out-of-bounds items", () => {
    expect(
      packGridLayout([layoutItem("a", 10, 4, 8, 6)], 4),
    ).toEqual([layoutItem("a", 0, 0, 4, 3)]);
  });

  it("does not mutate the supplied items", () => {
    const items = [
      layoutItem("a", 0, 0, 2, 2),
      layoutItem("b", 0, 0, 2, 2),
    ];
    const original = structuredClone(items);

    packGridLayout(items, 4);

    expect(items).toEqual(original);
  });
});

describe("breakpoint and viewport column mapping", () => {
  it.each([
    ["sm", 12, 4],
    ["md", 12, 8],
    ["lg", 12, 12],
    ["md", 6, 6],
  ] satisfies Array<[Breakpoint, number, number]>)(
    "maps %s against a %i-column grid to %i columns",
    (breakpoint, baseColumnCount, expected) => {
      expect(
        breakpointToColumnCount(breakpoint, baseColumnCount),
      ).toBe(expected);
    },
  );

  it.each([
    [1, "sm"],
    [4, "sm"],
    [5, "md"],
    [8, "md"],
    [9, "lg"],
    [12, "lg"],
  ] satisfies Array<[number, Breakpoint]>)(
    "maps %i columns to %s",
    (columns, expected) => {
      expect(columnCountToBreakpoint(columns)).toBe(expected);
    },
  );

  it("selects the largest supported column count that fits the viewport", () => {
    expect(
      calculateViewportColumnCount({
        baseColumnCount: 12,
        viewportWidth: 1052,
        rowHeight: 75,
        margin: 48,
      }),
    ).toBe(8);
  });

  it("falls back to the smallest supported count when none fit", () => {
    expect(
      calculateViewportColumnCount({
        baseColumnCount: 12,
        viewportWidth: 100,
        rowHeight: 75,
        margin: 48,
      }),
    ).toBe(4);
  });

  it("does not exceed a grid's base column count", () => {
    expect(
      calculateViewportColumnCount({
        baseColumnCount: 3,
        viewportWidth: 2000,
        rowHeight: 75,
        margin: 48,
      }),
    ).toBe(3);
  });
});

describe("projectGridLayout", () => {
  it("projects a valid desktop grid to position-only objects", () => {
    const tiles = [tile("a", 0, 0, 2, 2)];

    const result = projectGridLayout({
      tiles,
      breakpoint: "lg",
      columns: 12,
    });

    expect(result).toEqual([layoutItem("a", 0, 0, 2, 2)]);
    expect(result[0]).not.toHaveProperty("content");
    expect(result[0]).not.toHaveProperty("caption");
  });

  it("repacks a desktop grid containing out-of-bounds positions", () => {
    const tiles = [
      tile("a", 11, 2, 3, 2),
      tile("b", 0, 0, 2, 2),
    ];

    expect(
      projectGridLayout({
        tiles,
        breakpoint: "lg",
        columns: 12,
      }),
    ).toEqual([
      layoutItem("a", 2, 0, 3, 2),
      layoutItem("b", 0, 0, 2, 2),
    ]);
  });

  it("uses saved non-desktop overrides", () => {
    expect(
      projectGridLayout({
        tiles: [tile("a", 0, 0, 2, 2)],
        breakpoint: "md",
        columns: 8,
        overrides: {
          md: {
            a: { x: 3, y: 4, w: 5, h: 6 },
          },
        },
      }),
    ).toEqual([layoutItem("a", 3, 4, 5, 6)]);
  });

  it("places tiles missing from a partial override around customized tiles", () => {
    expect(
      projectGridLayout({
        tiles: [
          tile("custom", 0, 0, 2, 2),
          tile("missing", 0, 0, 10, 5),
        ],
        breakpoint: "md",
        columns: 8,
        overrides: {
          md: {
            custom: { x: 0, y: 0, w: 4, h: 4 },
          },
        },
      }),
    ).toEqual([
      layoutItem("custom", 0, 0, 4, 4),
      layoutItem("missing", 0, 4, 8, 4),
    ]);
  });

  it("automatically scales and packs a non-desktop layout without overrides", () => {
    expect(
      projectGridLayout({
        tiles: [
          tile("a", 0, 0, 8, 4),
          tile("b", 0, 0, 2, 2),
        ],
        breakpoint: "sm",
        columns: 4,
      }),
    ).toEqual([
      layoutItem("a", 0, 0, 4, 2),
      layoutItem("b", 0, 2, 2, 2),
    ]);
  });

  it("does not mutate canonical tiles or overrides", () => {
    const tiles = [tile("a", 0, 0, 8, 4)];
    const overrides = {
      sm: {
        a: { x: 1, y: 2, w: 3, h: 4 },
      },
    };
    const originalTiles = structuredClone(tiles);
    const originalOverrides = structuredClone(overrides);

    projectGridLayout({
      tiles,
      breakpoint: "sm",
      columns: 4,
      overrides,
    });

    expect(tiles).toEqual(originalTiles);
    expect(overrides).toEqual(originalOverrides);
  });
});

describe("reconcileGridLayout", () => {
  it("retains object identity when an item's position is unchanged", () => {
    const current = [layoutItem("a", 0, 0, 2, 2)];

    const result = reconcileGridLayout(current, [
      layoutItem("a", 0, 0, 2, 2),
    ]);

    expect(result[0]).toBe(current[0]);
  });

  it("creates a new item when its position changed", () => {
    const current = [layoutItem("a", 0, 0, 2, 2)];

    const result = reconcileGridLayout(current, [
      layoutItem("a", 1, 0, 2, 2),
    ]);

    expect(result[0]).toEqual(layoutItem("a", 1, 0, 2, 2));
    expect(result[0]).not.toBe(current[0]);
  });

  it("uses projected ordering and removes obsolete items", () => {
    const current = [
      layoutItem("obsolete", 0, 0, 1, 1),
      layoutItem("a", 0, 0, 2, 2),
    ];

    const result = reconcileGridLayout(current, [
      layoutItem("b", 2, 0, 2, 2),
      layoutItem("a", 0, 0, 2, 2),
    ]);

    expect(result).toEqual([
      layoutItem("b", 2, 0, 2, 2),
      layoutItem("a", 0, 0, 2, 2),
    ]);
    expect(result[1]).toBe(current[1]);
  });
});
