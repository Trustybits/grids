import {
  ContentType,
  type Tile,
  type TilePosition,
} from "@grids/contracts/types";
import type {
  CellRect,
  Corner,
  Gravity,
  GridConfig,
  GridSnapshot,
  Tile as GriddleTile,
} from "@griddle/core";
import type { GridLayoutItem } from "@/types/GridLayout";

/**
 * Pure mapping layer between the app's grid model and Griddle's engine model.
 *
 * The app speaks its legacy `GridLayoutItem` shape (`{ i, x, y, w, h }`),
 * while Griddle speaks `Tile` (`{ id, col, row, w, h }`).
 * Nothing here touches Vue, the DOM, or component state: it is the seam that
 * `Grid.vue` uses to (a) load canonical geometry into a Griddle engine and
 * (b) read settled or committed positions back out.
 *
 * Dynamic, per-instance capabilities that live in `Tile.vue` (touch activation,
 * editing state) are intentionally NOT modelled here. This module only knows the
 * data-derivable caps (global editability, the suggestion-tile resize lock, the
 * fixed min/max footprint). The Vue layer layers finer per-tile state on top via
 * `resolveCaps`.
 */

/** Minimum tile footprint in cells. */
export const MIN_TILE_UNITS = 1;
/** Maximum tile footprint in cells. */
export const MAX_TILE_UNITS = 10;

/**
 * App-specific `dragIgnoreFrom` selector. Unlike Griddle's built-in default,
 * this intentionally does not exclude `[contenteditable]`: rich-text tiles
 * must be draggable from their text while Griddle's movement threshold keeps
 * a stationary pointer gesture available as a native/editing click. The other
 * custom gesture surfaces remain ignored so their controls keep working.
 *
 * `.chat-messages` (the scrollable message list, which wraps the bubbles, the
 * `.messages-spacer`, and the date separators) is ignored as a whole rather
 * than just `.chat-bubble-wrapper`. On a touch device an activated chat tile
 * reports `draggable: true`, so without this a vertical scroll swipe clears
 * Griddle's 12px movement threshold and arms a tile drag — Griddle then
 * captures the pointer and the message history can never be scrolled. Ignoring
 * the container leaves the vertical pan to the browser's native scroll.
 */
export const DEFAULT_DRAG_IGNORE_FROM =
  [
    "a",
    "button",
    "input",
    "textarea",
    "select",
    ".tile-caption",
    ".tile-link-indicator",
    ".tile-title",
    ".tile-details",
    ".chat-messages",
    ".progress-container",
    ".track-progress",
    ".yt-video-card",
    ".avatar",
    ".map-canvas.is-interactive",
    ".image-wrapper.crop-active",
    ".video-wrapper.crop-active",
  ].join(", ");

/** Resolved per-tile capabilities handed to the Griddle engine. */
export interface GriddleTileCaps {
  draggable: boolean;
  resizable: boolean;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
}

export interface ToGriddleTilesOptions {
  /**
   * Global edit gate. When false, every tile is non-draggable and
   * non-resizable regardless of type. Defaults to false (view-only).
   */
  editable?: boolean;
  /**
   * Optional per-tile override. Receives the source contract tile (or
   * `undefined` if the layout item has no matching tile) and the
   * data-derived defaults, and returns a partial patch merged over them.
   * Use this from the Vue layer to fold in dynamic state (touch activation,
   * in-place editing) that this pure module cannot see.
   */
  resolveCaps?: (
    tile: Tile | undefined,
    defaults: GriddleTileCaps,
  ) => Partial<GriddleTileCaps>;
}

/** Map canonical contract tile geometry into the app's layout-only shape. */
export function toCanonicalLayoutItems(
  tiles: readonly Tile[],
): GridLayoutItem[] {
  return tiles.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
}

/**
 * Translate a breakpoint override map to Griddle's generic placement shape.
 * Undefined and empty maps stay undefined so reflow takes its automatic path.
 */
export function toGriddlePlacements(
  positions: Readonly<Record<string, TilePosition>> | undefined,
): Readonly<Record<string, CellRect>> | undefined {
  if (!positions || Object.keys(positions).length === 0) return undefined;

  return Object.fromEntries(
    Object.entries(positions).map(([id, { x, y, w, h }]) => [
      id,
      { col: x, row: y, w, h },
    ]),
  );
}

export interface BuildGridConfigInput {
  /** Column count for the active breakpoint. */
  cols: number;
  /** Cell edge length in CSS pixels (the app's `rowHeight`, e.g. 75). */
  rowHeight: number;
  /** Visual gap between cells in CSS pixels (the app's `margin`, e.g. 48). */
  margin: number;
  /** When true, compact tiles upward (maps to `gravity: 'top'`). */
  verticalCompact?: boolean;
  /**
   * Row count. Defaults to `Infinity` to match the app's unbounded vertical
   * growth. Pass a finite value if repack ever needs a hard bottom bound.
   */
  rows?: number;
  /** Corner resize handles. Omitted → Griddle default (`['se']`). */
  resizeHandles?: Corner[];
  /** Tile corner radius in CSS pixels. Omitted → Griddle default (4). */
  tileRadius?: number;
  /** Override the drag-ignore selector. Defaults to {@link DEFAULT_DRAG_IGNORE_FROM}. */
  dragIgnoreFrom?: string;
  /** Whether tiles snap to cells during drag. Defaults to true. */
  snapDuringDrag?: boolean;
  /**
   * Scroll-container mode (Griddle ≥0.1.1). `'none'` makes the grid size to its
   * content and lets the host page own scrolling/panning (no `overflow: auto`,
   * no `touch-action: none`) — which is how `grids.so` uses it (page scroll +
   * outer `transform: scale()`). Omitted → Griddle default (`'container'`).
   */
  scroll?: "container" | "none";
  /**
   * Draw-to-create gate (Griddle ≥0.1.1). `false` makes empty-space
   * pointer-downs a no-op (no draw ghost, no pointer capture, no selection
   * clear). We never handle `drawCreate`, so pass `false`. Omitted → Griddle
   * default (on).
   */
  drawToCreate?: boolean;
}

/**
 * Compute the data-derivable caps for a tile before any per-tile override.
 * Suggestion tiles are never resizable; everything is gated on `editable`.
 */
/**
 * Touch-only activation gate, layered over the data-derived caps.
 *
 * Touch has no hover, so a tile is tapped once to activate before it can be
 * dragged or resized. The engine has to know: Griddle returns early from
 * `onTilePointerDown` when a tile reports `draggable: false`, and that early
 * return is what leaves a swipe to the browser instead of arming a drag on a
 * 12px movement threshold.
 *
 * Returns an empty patch on pointer devices (which activate on hover) and for
 * the activated tile itself, so the defaults stand untouched in both cases.
 */
export function touchActivationCaps(
  tileId: string | undefined,
  activatedTileId: string | null,
  isTouchDevice: boolean,
): Partial<GriddleTileCaps> {
  if (!isTouchDevice || !tileId) return {};
  if (activatedTileId === tileId) return {};
  return { draggable: false, resizable: false };
}

export function defaultTileCaps(
  tile: Tile | undefined,
  editable: boolean,
): GriddleTileCaps {
  const isSuggestion = tile?.content.type === ContentType.SUGGESTION;
  return {
    draggable: editable,
    resizable: editable && !isSuggestion,
    minW: MIN_TILE_UNITS,
    minH: MIN_TILE_UNITS,
    maxW: MAX_TILE_UNITS,
    maxH: MAX_TILE_UNITS,
  };
}

/** Map a single app layout item + resolved caps to a Griddle tile. */
export function toGriddleTile(
  item: GridLayoutItem,
  caps: GriddleTileCaps,
): GriddleTile {
  return {
    id: item.i,
    col: item.x,
    row: item.y,
    w: item.w,
    h: item.h,
    draggable: caps.draggable,
    resizable: caps.resizable,
    minW: caps.minW,
    minH: caps.minH,
    maxW: caps.maxW,
    maxH: caps.maxH,
  };
}

/**
 * Map app layout geometry to Griddle tiles, attaching caps derived from the
 * matching contract tiles (looked up by id) plus any `resolveCaps` override.
 */
export function toGriddleTiles(
  items: readonly GridLayoutItem[],
  tiles: readonly Tile[],
  options: ToGriddleTilesOptions = {},
): GriddleTile[] {
  const { editable = false, resolveCaps } = options;
  const tilesById = new Map(tiles.map((tile) => [tile.i, tile]));

  return items.map((item) => {
    const tile = tilesById.get(item.i);
    const defaults = defaultTileCaps(tile, editable);
    const caps = resolveCaps
      ? { ...defaults, ...resolveCaps(tile, defaults) }
      : defaults;
    return toGriddleTile(item, caps);
  });
}

/** Map a single Griddle tile back to an app layout item (`{ i, x, y, w, h }`). */
export function fromGriddleTile(tile: GriddleTile): GridLayoutItem {
  return {
    i: tile.id,
    x: tile.col,
    y: tile.row,
    w: tile.w,
    h: tile.h,
  };
}

/** Map committed Griddle tiles back to the app layout array. */
export function fromGriddleTiles(
  tiles: readonly GriddleTile[],
): GridLayoutItem[] {
  return tiles.map(fromGriddleTile);
}

/**
 * Build a Griddle {@link GridConfig} from the app's fixed-cell parameters. The
 * app uses a `rowHeight`×`rowHeight` square-cell model with `margin` gaps;
 * Griddle models that natively via `unitWidth`/`unitHeight`
 * (= `rowHeight`) and `gap` (= `margin`).
 */
export function buildGridConfig({
  cols,
  rowHeight,
  margin,
  verticalCompact = false,
  rows = Infinity,
  resizeHandles,
  tileRadius,
  dragIgnoreFrom = DEFAULT_DRAG_IGNORE_FROM,
  snapDuringDrag = true,
  scroll,
  drawToCreate,
}: BuildGridConfigInput): GridConfig {
  const gravity: Gravity = verticalCompact ? "top" : "none";
  return {
    cols,
    rows,
    unitWidth: rowHeight,
    unitHeight: rowHeight,
    gap: margin,
    gravity,
    snapDuringDrag,
    dragIgnoreFrom,
    ...(resizeHandles ? { resizeHandles } : {}),
    ...(tileRadius !== undefined ? { tileRadius } : {}),
    ...(scroll ? { scroll } : {}),
    ...(drawToCreate !== undefined
      ? { interactive: { drawToCreate } }
      : {}),
  };
}

/**
 * Assemble a full Griddle snapshot for `api.loadJSON(...)` by mapping app
 * layout geometry to tiles and pairing it with a freshly built config.
 */
export function buildGridSnapshot(
  items: readonly GridLayoutItem[],
  tiles: readonly Tile[],
  config: GridConfig,
  options: ToGriddleTilesOptions = {},
): GridSnapshot {
  return {
    version: 1,
    config,
    tiles: toGriddleTiles(items, tiles, options),
  };
}
