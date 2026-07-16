import type { Breakpoint } from "@grids/contracts/types";

const BREAKPOINT_COLUMNS: Record<Breakpoint, number> = {
  lg: 12,
  md: 8,
  sm: 4,
};

const VIEWPORT_COLUMN_CANDIDATES = [12, 8, 4] as const;

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
