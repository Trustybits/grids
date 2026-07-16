import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  type ResponsiveLayoutVersion,
} from "@grids/contracts/types";

/** Griddle's immutable product reflow strategy for persisted griddle-v1 grids. */
export type GriddleResponsiveReflowStrategy = "griddle-v1";

const GRIDDLE_REFLOW_STRATEGY_BY_LAYOUT_VERSION: Partial<
  Record<ResponsiveLayoutVersion, GriddleResponsiveReflowStrategy>
> = {
  [GRIDDLE_RESPONSIVE_LAYOUT_VERSION]: "griddle-v1",
};

/**
 * Return the Griddle strategy for an already-resolved responsive layout
 * version. Undefined means the app-owned legacy projection must be used.
 */
export function getGriddleResponsiveReflowStrategy(
  version: ResponsiveLayoutVersion,
): GriddleResponsiveReflowStrategy | undefined {
  return GRIDDLE_REFLOW_STRATEGY_BY_LAYOUT_VERSION[version];
}
