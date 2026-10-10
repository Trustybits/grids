/**
 * The grid engine, seen from app chrome.
 *
 * `Grid.vue` owns the Griddle engine, and structural changes have to go
 * through it so neighbours reflow (a delete settles the tiles below, a resize
 * displaces the ones beside). The phone toolbars and multi-edit live outside
 * the grid's component tree, and multi-edit acts on tiles that have no live
 * handle — so the grid registers this bridge and they drive it.
 *
 * Same lifecycle as `useTileDropTarget`: one mounted, editable grid at a time.
 */
import type { ViewportRect } from "@/composables/useTileDropTarget";

export interface GridEngineBridge {
  /**
   * Remove tiles through the engine, each one settling its neighbours. Wrap
   * the call in a history batch to make several removals one undo step.
   */
  removeTiles(tileIds: readonly string[]): void;
  /** Resize one tile through the engine (preset or W×H), displacing others. */
  resizeTile(tileId: string, width: number, height: number): void;
  /** The tile's rendered element, for positioning chrome against it. */
  tileElement(tileId: string): HTMLElement | null;
  /** Rendered size / layout size of the grid (≈0.72 on phones). */
  gridScale(): number;
  /**
   * Where a tile sits on screen, from the engine's geometry. Works for tiles
   * Griddle hasn't rendered — it only renders tiles near the viewport — so it
   * can bring an off-screen tile (a fresh duplicate) into view.
   */
  tileRect(tileId: string): ViewportRect | null;
}

let current: GridEngineBridge | null = null;

/** Called by the grid; returns the unregister function. */
export const registerGridEngineBridge = (
  bridge: GridEngineBridge,
): (() => void) => {
  current = bridge;
  return () => {
    if (current === bridge) current = null;
  };
};

/** The mounted grid's engine, or null when no grid is mounted. */
export const getGridEngineBridge = (): GridEngineBridge | null => current;
