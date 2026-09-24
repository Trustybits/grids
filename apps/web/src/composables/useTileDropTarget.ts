import type { TilePlacement } from "@/types/GridLayout";

/** A rectangle in viewport (client) pixels. */
export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The grid, seen as somewhere a tile type can be dropped. `Grid.vue` owns the
 * engine that makes room for the drop, and registers itself here; the Add-a-
 * Tile surface, which lives outside the grid's component tree, drives it.
 *
 * Lifecycle: `preview` on every pointer frame while dragging, which opens a
 * landing spot and moves tiles out of its way → `hold` on release, which pins
 * that spot open until the tile exists → `release` once it does (or the add is
 * abandoned), which lets the grid settle back.
 */
export interface TileDropTarget {
  /**
   * Open a landing spot for a `size`-cell tile centred on a viewport point,
   * moving tiles out of its way. Returns the spot's viewport rect, or null —
   * with any open spot closed — when the point is not over the grid.
   */
  preview(
    point: { x: number; y: number },
    size: { w: number; h: number },
  ): ViewportRect | null;
  /**
   * Rendered edge length (px) of a `size`-cell tile — the size the carried
   * card is drawn at over the grid, and so the one to find its centre with.
   */
  tileSize(size: { w: number; h: number }): number;
  /** Viewport rect of the held cell, or null when none is held. */
  slotRect(): ViewportRect | null;
  /**
   * Stop following the pointer and pin the landing spot where it is. Returns
   * the placement to create the tile at, or null when no spot is open.
   */
  hold(): TilePlacement | null;
  /** Close any open or held slot; the grid rebuilds from its saved layout. */
  release(): void;
}

let current: TileDropTarget | null = null;

/** Called by the grid; returns the unregister function. */
export const registerTileDropTarget = (target: TileDropTarget): (() => void) => {
  current = target;
  return () => {
    if (current === target) current = null;
  };
};

/** The mounted, editable grid — or null when there is nothing to drop onto. */
export const getTileDropTarget = (): TileDropTarget | null => current;
