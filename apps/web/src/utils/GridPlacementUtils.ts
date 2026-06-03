import type { Tile } from "@grids/contracts/types";

/**
 * Calculate the lowest point (bottom edge) in the grid.
 */
export function calculateLowestPoint(tiles: Tile[]): number {
  if (tiles.length === 0) return 0;

  return tiles.reduce((max, tile) => {
    const bottom = tile.y + tile.h;
    return bottom > max ? bottom : max;
  }, 0);
}

/**
 * Adjust a tile's x value to ensure it doesn't extend past the column count.
 * Mutates the tile in-place.
 */
export function adjustTilePosition(
  tile: { x: number; w: number },
  colNum: number,
): void {
  const maxX = colNum - tile.w;
  if (tile.x > maxX) {
    tile.x = Math.max(0, maxX); // Ensure x doesn't go negative
  }
}

/**
 * Push existing tiles out of the way to make room for a new tile at the
 * given position. Modifies tile Y positions in-place so that by the time
 * Vue re-renders, the grid is already collision-free — no overlap flash.
 *
 * Algorithm:
 *  1. Push every tile that overlaps the new tile's footprint directly
 *     below it (tile.y = newY + newH).
 *  2. Cascade: sort all tiles top-to-bottom and resolve any secondary
 *     overlaps the same way. Repeat until the grid is stable.
 */
export function pushTilesForNewItem(
  tiles: Tile[],
  newX: number,
  newY: number,
  newW: number,
  newH: number,
): void {
  // Rectangle overlap test (strict — adjacent edges don't count)
  const overlaps = (
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
  ): boolean =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  // First pass: push tiles that directly collide with the new tile
  for (const tile of tiles) {
    if (overlaps(newX, newY, newW, newH, tile.x, tile.y, tile.w, tile.h)) {
      tile.y = newY + newH;
    }
  }

  // Cascade: repeatedly resolve tile-on-tile overlaps until stable.
  // Processing top-to-bottom ensures each tile is only pushed once per pass.
  let settled = false;
  let iterations = 0;
  while (!settled && iterations < 50) {
    settled = true;
    iterations++;

    const sorted = [...tiles].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (overlaps(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h)) {
          b.y = a.y + a.h;
          settled = false;
        }
      }
    }
  }
}

/**
 * Find the best X position at a specific row for a tile of the given size.
 * Used for viewport-based placement: the Y is already decided (viewport center),
 * so we just need the cleanest X column.
 *
 * Scans left-to-right for a non-overlapping column. If the row is fully
 * occupied, returns x=0 anyway — pushTilesForNewItem will clear the space.
 */
export function findBestXAtRow(
  tiles: Tile[],
  colNum: number,
  width: number,
  height: number,
  targetY: number,
): { x: number; y: number } {
  const hasOverlap = (x: number, y: number): boolean => {
    return tiles.some((tile) => {
      return !(
        x + width <= tile.x ||
        x >= tile.x + tile.w ||
        y + height <= tile.y ||
        y >= tile.y + tile.h
      );
    });
  };

  // Try to find a clean (non-overlapping) column at the target row
  for (let x = 0; x <= colNum - width; x++) {
    if (!hasOverlap(x, targetY)) {
      return { x, y: targetY };
    }
  }

  // Row is fully occupied — place at x=0 and let the grid engine
  // push existing tiles out of the way via collision resolution
  return { x: 0, y: targetY };
}

/**
 * Find the first available spot for a tile of the given size.
 *
 * When startY > 0 (viewport-based positioning), we first scan downward
 * from startY. If no gap is found within the existing tile bounds, the
 * tile is placed at the bottom of the grid — still near the viewport.
 * This ensures new tiles always appear close to where the user is looking.
 */
export function findFirstAvailableSpot(
  tiles: Tile[],
  colNum: number,
  width: number,
  height: number,
  startY = 0,
): { x: number; y: number } {
  const lowestPoint = calculateLowestPoint(tiles);
  // Search up to the current bottom + one new tile height
  const maxY = lowestPoint + height;

  // Helper function to check if a position overlaps with any existing tile
  const hasOverlap = (x: number, y: number): boolean => {
    return tiles.some((tile) => {
      return !(
        x + width <= tile.x || // new tile is to the left
        x >= tile.x + tile.w || // new tile is to the right
        y + height <= tile.y || // new tile is above
        y >= tile.y + tile.h // new tile is below
      );
    });
  };

  // Scan downward from startY — tiles appear where the user is looking
  for (let y = Math.max(0, startY); y <= maxY; y++) {
    for (let x = 0; x <= colNum - width; x++) {
      if (!hasOverlap(x, y)) {
        return { x, y };
      }
    }
  }

  // If no spot found, fall back to bottom of grid
  return { x: 0, y: lowestPoint };
}
