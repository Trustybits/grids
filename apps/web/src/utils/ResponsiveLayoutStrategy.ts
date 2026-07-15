import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  type ResponsiveLayoutVersion,
} from "@grids/contracts/types";

/**
 * Temporary bootstrap mapping used to verify the Griddle projection path
 * without changing geometry. The final griddle-v1 algorithm phase replaces
 * this value here and nowhere else in the app.
 */
export type GriddleResponsiveReflowStrategy = "preserve-v1";

const GRIDDLE_REFLOW_STRATEGY_BY_LAYOUT_VERSION: Partial<
  Record<ResponsiveLayoutVersion, GriddleResponsiveReflowStrategy>
> = {
  [GRIDDLE_RESPONSIVE_LAYOUT_VERSION]: "preserve-v1",
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
