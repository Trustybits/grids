import type { Breakpoint } from "@grids/contracts/types";

/** Desktop (`lg`) column count for grids that never chose their own. */
export const DEFAULT_GRID_COLUMNS = 12;
/**
 * Bounds for the user-selectable desktop column count. The floor matches the
 * tablet (`md`) breakpoint so saved tablet/mobile layouts keep their column
 * space; the ceiling keeps a scaled-down desktop grid legible.
 */
export const MIN_GRID_COLUMNS = 8;
export const MAX_GRID_COLUMNS = 16;

const BREAKPOINT_COLUMNS: Record<Exclude<Breakpoint, "lg">, number> = {
  md: 8,
  sm: 4,
};

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

/** Clamp an arbitrary value to a legal desktop column count. */
export function clampGridColumnCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GRID_COLUMNS;
  return Math.min(
    MAX_GRID_COLUMNS,
    Math.max(MIN_GRID_COLUMNS, Math.round(value)),
  );
}

/**
 * Columns rendered at a breakpoint. Desktop (`lg`) always uses the grid's own
 * column count; tablet and mobile use their fixed counts, never exceeding it.
 */
export function breakpointToColumnCount(
  breakpoint: Breakpoint,
  baseColumnCount: number,
): number {
  assertPositiveInteger(baseColumnCount, "baseColumnCount");
  if (breakpoint === "lg") return baseColumnCount;
  return Math.min(BREAKPOINT_COLUMNS[breakpoint], baseColumnCount);
}

export function columnCountToBreakpoint(
  columns: number,
  baseColumnCount: number = DEFAULT_GRID_COLUMNS,
): Breakpoint {
  assertPositiveInteger(columns, "columns");
  if (columns >= baseColumnCount) return "lg";
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

  const fits = (columns: number): boolean =>
    columns * rowHeight + (columns + 1) * margin <= viewportWidth;

  // A viewport that fits a default-width grid is a desktop viewport. Wider
  // grids stay on their desktop layout there and are scaled down to fit,
  // rather than falling back to the tablet layout on common laptop widths.
  if (fits(Math.min(baseColumnCount, DEFAULT_GRID_COLUMNS))) {
    return baseColumnCount;
  }

  const fittingColumnCount = [BREAKPOINT_COLUMNS.md, BREAKPOINT_COLUMNS.sm]
    .filter((columns) => columns < baseColumnCount)
    .find(fits);

  return (
    fittingColumnCount ?? Math.min(BREAKPOINT_COLUMNS.sm, baseColumnCount)
  );
}
