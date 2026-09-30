import type { Breakpoint } from "@grids/contracts/types";

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A cell chosen for the next tile to be added — the result of dropping a tile
 * type onto the grid. Measured in the column space of `breakpoint`, and
 * carrying the layout the engine settled into around the drop, so the add can
 * land exactly where the user let go instead of re-running auto-placement.
 */
export interface TilePlacement {
  /** Breakpoint whose column space `x`/`y`/`layout` are measured in. */
  breakpoint: Breakpoint;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Every existing tile's position with the dropped cell cleared for the new one. */
  layout: GridLayoutItem[];
}
