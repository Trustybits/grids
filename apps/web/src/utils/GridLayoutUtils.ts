import type {
  Breakpoint,
  Tile,
  TilePosition,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";

const BREAKPOINT_COLUMNS: Record<Breakpoint, number> = {
  lg: 12,
  md: 8,
  sm: 4,
};

const VIEWPORT_COLUMN_CANDIDATES = [12, 8, 4] as const;

type GridPosition = Pick<GridLayoutItem, "x" | "y" | "w" | "h">;

export interface GridLayoutProjectionInput {
  tiles: readonly Tile[];
  breakpoint: Breakpoint;
  columns: number;
  overrides?: Partial<Record<Breakpoint, Record<string, TilePosition>>>;
}

export interface ViewportColumnCountInput {
  baseColumnCount: number;
  viewportWidth: number;
  rowHeight: number;
  margin: number;
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function toLayoutItem(tile: Tile): GridLayoutItem {
  return {
    i: tile.i,
    x: tile.x,
    y: tile.y,
    w: tile.w,
    h: tile.h,
  };
}

function hasSamePosition(
  left: GridPosition,
  right: GridPosition,
): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.w === right.w &&
    left.h === right.h
  );
}

export function gridItemsOverlap(
  left: GridPosition,
  right: GridPosition,
): boolean {
  return (
    left.x < right.x + right.w &&
    left.x + left.w > right.x &&
    left.y < right.y + right.h &&
    left.y + left.h > right.y
  );
}

export function findFirstAvailableLayoutSpot(
  placed: readonly GridLayoutItem[],
  width: number,
  height: number,
  columns: number,
  startY = 0,
): { x: number; y: number } {
  assertPositiveInteger(columns, "columns");
  assertPositiveInteger(width, "width");
  assertPositiveInteger(height, "height");

  if (width > columns) {
    throw new RangeError("width cannot exceed columns");
  }

  const candidate = { x: 0, y: Math.max(0, startY), w: width, h: height };

  while (true) {
    for (let x = 0; x <= columns - width; x += 1) {
      candidate.x = x;
      if (!placed.some((item) => gridItemsOverlap(item, candidate))) {
        return { x, y: candidate.y };
      }
    }
    candidate.y += 1;
  }
}

export function scaleLayoutItemToFit(
  item: GridLayoutItem,
  columns: number,
): GridLayoutItem {
  assertPositiveInteger(columns, "columns");

  const width = Number.isFinite(item.w)
    ? Math.max(1, Math.round(item.w))
    : 1;
  const height = Number.isFinite(item.h)
    ? Math.max(1, Math.round(item.h))
    : 1;
  const normalized = {
    ...item,
    x: Number.isFinite(item.x) ? Math.round(item.x) : 0,
    y: Number.isFinite(item.y) ? Math.round(item.y) : 0,
    w: width,
    h: height,
  };

  if (width <= columns) {
    return normalized;
  }

  const scale = columns / width;
  return {
    ...normalized,
    w: columns,
    h: Math.max(1, Math.round(height * scale)),
  };
}

export function packGridLayout(
  items: readonly GridLayoutItem[],
  columns: number,
): GridLayoutItem[] {
  assertPositiveInteger(columns, "columns");

  const ordered = [...items].sort((left, right) => {
    if (left.y !== right.y) return left.y - right.y;
    if (left.x !== right.x) return left.x - right.x;
    return left.i.localeCompare(right.i);
  });
  const placed: GridLayoutItem[] = [];

  for (const item of ordered) {
    const scaledItem = scaleLayoutItemToFit(item, columns);
    const withinBounds =
      scaledItem.x >= 0 &&
      scaledItem.y >= 0 &&
      scaledItem.x + scaledItem.w <= columns;
    const canKeepPosition =
      withinBounds &&
      !placed.some((placedItem) =>
        gridItemsOverlap(placedItem, scaledItem),
      );

    if (canKeepPosition) {
      placed.push(scaledItem);
      continue;
    }

    const position = findFirstAvailableLayoutSpot(
      placed,
      scaledItem.w,
      scaledItem.h,
      columns,
      withinBounds ? scaledItem.y : 0,
    );
    placed.push({ ...scaledItem, ...position });
  }

  const placedById = new Map(placed.map((item) => [item.i, item]));
  return items.map((item) => placedById.get(item.i) ?? { ...item });
}

/**
 * Applies vertical "gravity" to a layout: every item falls upward until it
 * rests on the top of the grid or on another item. Unlike {@link packGridLayout}
 * (which only resolves overlaps and out-of-bounds items, leaving vertical gaps
 * intact), this closes the empty space above tiles. It preserves the app's
 * historical `verticalCompact` behavior, so it can reposition tiles the instant
 * gravity is toggled on. Items are returned in their original input order.
 */
export function compactGridLayout(
  items: readonly GridLayoutItem[],
  columns: number,
): GridLayoutItem[] {
  assertPositiveInteger(columns, "columns");

  const ordered = [...items].sort((left, right) => {
    if (left.y !== right.y) return left.y - right.y;
    if (left.x !== right.x) return left.x - right.x;
    return left.i.localeCompare(right.i);
  });
  const placed: GridLayoutItem[] = [];

  for (const item of ordered) {
    const settled = { ...scaleLayoutItemToFit(item, columns) };

    while (settled.y > 0) {
      const lifted = { ...settled, y: settled.y - 1 };
      if (placed.some((placedItem) => gridItemsOverlap(placedItem, lifted))) {
        break;
      }
      settled.y -= 1;
    }

    placed.push(settled);
  }

  const placedById = new Map(placed.map((item) => [item.i, item]));
  return items.map((item) => placedById.get(item.i) ?? { ...item });
}

export function breakpointToColumnCount(
  breakpoint: Breakpoint,
  baseColumnCount: number,
): number {
  assertPositiveInteger(baseColumnCount, "baseColumnCount");
  return Math.min(BREAKPOINT_COLUMNS[breakpoint], baseColumnCount);
}

export function columnCountToBreakpoint(columns: number): Breakpoint {
  assertPositiveInteger(columns, "columns");
  if (columns <= BREAKPOINT_COLUMNS.sm) return "sm";
  if (columns <= BREAKPOINT_COLUMNS.md) return "md";
  return "lg";
}

export function calculateViewportColumnCount({
  baseColumnCount,
  viewportWidth,
  rowHeight,
  margin,
}: ViewportColumnCountInput): number {
  assertPositiveInteger(baseColumnCount, "baseColumnCount");

  const candidates = VIEWPORT_COLUMN_CANDIDATES.filter(
    (columns) => columns <= baseColumnCount,
  );
  const fittingColumnCount = candidates.find(
    (columns) =>
      columns * rowHeight + (columns + 1) * margin <= viewportWidth,
  );

  return fittingColumnCount ?? Math.min(4, baseColumnCount);
}

export function projectGridLayout({
  tiles,
  breakpoint,
  columns,
  overrides,
}: GridLayoutProjectionInput): GridLayoutItem[] {
  assertPositiveInteger(columns, "columns");

  const layoutItems = tiles.map(toLayoutItem);

  if (breakpoint === "lg") {
    // Stored desktop geometry is untrusted input. Packing is identity-preserving
    // for a valid layout, while also repairing negative/out-of-bounds positions
    // and saved overlaps before Griddle renders its first frame.
    return packGridLayout(layoutItems, columns);
  }

  const breakpointOverrides = overrides?.[breakpoint];
  if (
    breakpointOverrides &&
    Object.keys(breakpointOverrides).length > 0
  ) {
    const customized: GridLayoutItem[] = [];
    const unplaced: GridLayoutItem[] = [];

    for (const item of layoutItems) {
      const position = breakpointOverrides[item.i];
      if (position) {
        customized.push({ ...item, ...position });
      } else {
        unplaced.push(scaleLayoutItemToFit(item, columns));
      }
    }

    const projected = [...customized];
    for (const item of unplaced) {
      const position = findFirstAvailableLayoutSpot(
        projected,
        item.w,
        item.h,
        columns,
      );
      projected.push({ ...item, ...position });
    }
    // Breakpoint overrides are persisted independently and may be stale or
    // internally inconsistent. Keep valid authoritative positions, but repair
    // any overlap/out-of-bounds geometry before it reaches the renderer.
    return packGridLayout(projected, columns);
  }

  return packGridLayout(
    layoutItems.map((item) => scaleLayoutItemToFit(item, columns)),
    columns,
  );
}

export function reconcileGridLayout(
  current: readonly GridLayoutItem[],
  projected: readonly GridLayoutItem[],
): GridLayoutItem[] {
  const currentById = new Map(current.map((item) => [item.i, item]));

  return projected.map((item) => {
    const existing = currentById.get(item.i);
    return existing && hasSamePosition(existing, item)
      ? existing
      : { ...item };
  });
}
