import {
  LEGACY_RESPONSIVE_LAYOUT_VERSION,
  NEW_GRID_RESPONSIVE_LAYOUT_VERSION,
  type Grid,
  type ResponsiveLayoutVersion,
  type Tile,
} from "@grids/contracts/types";

/**
 * Deployment-wide launch gate for persisted fresh-grid creation. Keep this on
 * legacy until the final griddle-v1 strategy is installed and launch-ready.
 */
export const ACTIVE_NEW_GRID_RESPONSIVE_LAYOUT_VERSION:
  ResponsiveLayoutVersion = LEGACY_RESPONSIVE_LAYOUT_VERSION;

// Mapper for new grids
export function createDefaultGrid(
  userId: string,
  name: string,
  responsiveLayoutVersion: ResponsiveLayoutVersion =
    NEW_GRID_RESPONSIVE_LAYOUT_VERSION,
): Grid {
  if (!name) {
    name = "";
  }

  return {
    id: "", // The DAO will provide the ID later
    userId,
    rev: 0,
    name,
    colNum: 12, // Default number of columns
    responsiveLayoutVersion,
    verticalCompact: true, // Default to gravity ON
    tiles: [], // Start with no tiles
    backgroundImageSrc: "",
    backgroundEmbed: false,
    duplicatable: false,
  };
}

export const findTileById = (tiles: Tile[], id: string): Tile | undefined => {
  return tiles.find((tile) => tile.i === id);
};
