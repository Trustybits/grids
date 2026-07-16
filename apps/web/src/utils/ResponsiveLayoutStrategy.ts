import {
  type ResponsiveLayoutVersion,
} from "@grids/contracts/types";

/** Griddle's immutable product reflow strategy for persisted griddle-v1 grids. */
export type GriddleResponsiveReflowStrategy = "griddle-v1";

/**
 * Return the Griddle strategy for the current responsive layout version.
 * This adapter remains temporarily while the Step 4 render-path cleanup lands.
 */
export function getGriddleResponsiveReflowStrategy(
  _version: ResponsiveLayoutVersion,
): GriddleResponsiveReflowStrategy {
  return "griddle-v1";
}
