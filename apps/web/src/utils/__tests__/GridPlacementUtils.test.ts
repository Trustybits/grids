/**
 * Tests for GridPlacementUtils.ts
 *
 * Covers the grid layout/collision helpers:
 *  - calculateLowestPoint: the grid's bottom edge (max y + h)
 *  - adjustTilePosition: clamp a tile's x within the column count
 *  - pushTilesForNewItem: shove overlapping tiles below a new tile, cascading
 *  - findBestXAtRow: leftmost clean x at a fixed row
 *  - findFirstAvailableSpot: first non-overlapping (x, y), scanning from startY
 */

import { describe, it, expect } from "vitest";
import { ContentType, type Tile } from "@grids/contracts/types";
import {
  adjustTilePosition,
  calculateLowestPoint,
  findBestXAtRow,
  findFirstAvailableSpot,
  pushTilesForNewItem,
} from "../GridPlacementUtils";

/** Build a Tile occupying the given footprint. */
function tile(i: string, x: number, y: number, w: number, h: number): Tile {
  return {
    i,
    x,
    y,
    w,
    h,
    caption: "",
    content: { type: ContentType.TEXT } as Tile["content"],
  };
}

describe("calculateLowestPoint", () => {
  it("returns 0 for an empty grid", () => {
    expect(calculateLowestPoint([])).toBe(0);
  });

  it("returns the bottom edge (y + h) of a single tile", () => {
    expect(calculateLowestPoint([tile("a", 0, 2, 1, 3)])).toBe(5);
  });

  it("returns the maximum bottom edge across all tiles", () => {
    const tiles = [
      tile("a", 0, 0, 1, 2), // bottom 2
      tile("b", 1, 5, 1, 4), // bottom 9
      tile("c", 2, 3, 1, 1), // bottom 4
    ];
    expect(calculateLowestPoint(tiles)).toBe(9);
  });

  it("never returns less than 0 (seed value), even for tiles at the very top", () => {
    expect(calculateLowestPoint([tile("a", 0, 0, 1, 0)])).toBe(0);
  });
});

describe("adjustTilePosition", () => {
  it("leaves x unchanged when the tile already fits", () => {
    const t = { x: 2, w: 3 };
    adjustTilePosition(t, 12);
    expect(t.x).toBe(2);
  });

  it("leaves x unchanged when the tile ends exactly at the right edge", () => {
    const t = { x: 9, w: 3 }; // maxX = 12 - 3 = 9
    adjustTilePosition(t, 12);
    expect(t.x).toBe(9);
  });

  it("pulls x left so the tile ends at the right edge when it overflows", () => {
    const t = { x: 11, w: 3 }; // maxX = 9
    adjustTilePosition(t, 12);
    expect(t.x).toBe(9);
  });

  it("clamps x to 0 when the tile is wider than the grid", () => {
    const t = { x: 5, w: 20 }; // maxX = 12 - 20 = -8 -> max(0, -8)
    adjustTilePosition(t, 12);
    expect(t.x).toBe(0);
  });

  it("mutates the tile in place (returns nothing)", () => {
    const t = { x: 11, w: 3 };
    const ret = adjustTilePosition(t, 12);
    expect(ret).toBeUndefined();
    expect(t.x).toBe(9);
  });
});

describe("pushTilesForNewItem", () => {
  it("pushes a tile that overlaps the new footprint directly below it", () => {
    const tiles = [tile("a", 0, 0, 2, 2)];
    pushTilesForNewItem(tiles, 0, 0, 2, 2); // new tile at (0,0) 2x2
    expect(tiles[0].y).toBe(2); // newY(0) + newH(2)
  });

  it("does not move a tile that only shares an edge (adjacent, not overlapping)", () => {
    const tiles = [tile("a", 2, 0, 2, 2)]; // sits to the right, touching x=2
    pushTilesForNewItem(tiles, 0, 0, 2, 2);
    expect(tiles[0].y).toBe(0);
  });

  it("leaves a non-overlapping tile untouched", () => {
    const tiles = [tile("a", 5, 5, 2, 2)];
    pushTilesForNewItem(tiles, 0, 0, 2, 2);
    expect(tiles[0].y).toBe(5);
  });

  it("cascades: a pushed tile shoves a second tile it now overlaps", () => {
    // a at (0,0); b directly below a at (0,2). New tile lands on a.
    const a = tile("a", 0, 0, 2, 2);
    const b = tile("b", 0, 2, 2, 2);
    pushTilesForNewItem([a, b], 0, 0, 2, 2);
    // a pushed to y=2, then it overlaps b -> b pushed to y = a.y + a.h = 4
    expect(a.y).toBe(2);
    expect(b.y).toBe(4);
  });

  it("resolves a stack of three tiles into non-overlapping rows", () => {
    const a = tile("a", 0, 0, 1, 1);
    const b = tile("b", 0, 1, 1, 1);
    const c = tile("c", 0, 2, 1, 1);
    pushTilesForNewItem([a, b, c], 0, 0, 1, 1);
    const sorted = [a, b, c].sort((p, q) => p.y - q.y);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].y).toBeGreaterThanOrEqual(
        sorted[i - 1].y + sorted[i - 1].h,
      );
    }
  });

  it("leaves a horizontally-separated tile in the same row untouched", () => {
    // a overlaps the new footprint and is pushed down; b is in different
    // columns (no x overlap) and must stay put — including after the cascade.
    const a = tile("a", 0, 0, 2, 2);
    const b = tile("b", 5, 0, 2, 2);
    pushTilesForNewItem([a, b], 0, 0, 2, 2);
    expect(a.y).toBe(2);
    expect(b.y).toBe(0);
  });

  it("does nothing for an empty tile list", () => {
    const tiles: Tile[] = [];
    expect(() => pushTilesForNewItem(tiles, 0, 0, 2, 2)).not.toThrow();
    expect(tiles).toEqual([]);
  });
});

describe("findBestXAtRow", () => {
  it("returns x=0 at the target row on an empty grid", () => {
    expect(findBestXAtRow([], 12, 2, 2, 5)).toEqual({ x: 0, y: 5 });
  });

  it("finds the leftmost clean column at the target row", () => {
    // Tile occupies x:0..2 at row 5; a 2-wide tile should land at x=2.
    const tiles = [tile("a", 0, 5, 2, 2)];
    expect(findBestXAtRow(tiles, 12, 2, 2, 5)).toEqual({ x: 2, y: 5 });
  });

  it("ignores tiles on other rows when choosing the column", () => {
    const tiles = [tile("a", 0, 0, 2, 2)]; // far above target row 5
    expect(findBestXAtRow(tiles, 12, 2, 2, 5)).toEqual({ x: 0, y: 5 });
  });

  it("returns x=0 at the target row when the row is fully occupied", () => {
    // A tile spanning the full 12 columns at the target row.
    const tiles = [tile("a", 0, 5, 12, 2)];
    expect(findBestXAtRow(tiles, 12, 2, 2, 5)).toEqual({ x: 0, y: 5 });
  });

  it("respects the column count when scanning (does not exceed colNum - width)", () => {
    // Columns 0..9 occupied; only x=10 fits a width-2 tile in a 12-col grid.
    const tiles = [tile("a", 0, 5, 10, 2)];
    expect(findBestXAtRow(tiles, 12, 2, 2, 5)).toEqual({ x: 10, y: 5 });
  });
});

describe("findFirstAvailableSpot", () => {
  it("returns the top-left corner on an empty grid", () => {
    expect(findFirstAvailableSpot([], 12, 2, 2)).toEqual({ x: 0, y: 0 });
  });

  it("places the tile to the right of an existing tile when there is room", () => {
    const tiles = [tile("a", 0, 0, 2, 2)];
    expect(findFirstAvailableSpot(tiles, 12, 2, 2)).toEqual({ x: 2, y: 0 });
  });

  it("scans downward from startY when the grid is tall enough to reach it", () => {
    // A tall tile in column 0 (rows 0..20) keeps maxY above startY so the
    // downward scan actually runs. At row 5 the first clean column is x=1.
    const tiles = [tile("a", 0, 0, 1, 20)];
    expect(findFirstAvailableSpot(tiles, 12, 2, 2, 5)).toEqual({ x: 1, y: 5 });
  });

  it("ignores the viewport hint and falls back to the top when the grid is too short", () => {
    // Empty grid: maxY = 0 + height = 2, so a startY of 5 is never scanned and
    // the function falls back to {x: 0, y: lowestPoint} = {0, 0}.
    expect(findFirstAvailableSpot([], 12, 2, 2, 5)).toEqual({ x: 0, y: 0 });
  });

  it("treats a negative startY as 0", () => {
    expect(findFirstAvailableSpot([], 12, 2, 2, -10)).toEqual({ x: 0, y: 0 });
  });

  it("finds a gap on the first row before moving down", () => {
    // Left half (x:0..2) occupied at row 0; a width-2 tile fits at x=2, y=0.
    const tiles = [tile("a", 0, 0, 2, 5)];
    expect(findFirstAvailableSpot(tiles, 12, 2, 2)).toEqual({ x: 2, y: 0 });
  });

  it("returns a non-overlapping spot for a full first row", () => {
    // Entire 12-col first row blocked from y:0..1; a 2x2 tile cannot fit there.
    const tiles = [tile("a", 0, 0, 12, 1)];
    const spot = findFirstAvailableSpot(tiles, 12, 2, 2);
    const overlapsBlock =
      spot.x < 12 && spot.x + 2 > 0 && spot.y < 1 && spot.y + 2 > 0;
    expect(overlapsBlock).toBe(false);
    expect(spot.x).toBe(0);
    expect(spot.y).toBe(1);
  });
});
