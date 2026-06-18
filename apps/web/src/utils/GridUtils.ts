import { type Grid, type Tile } from "@grids/contracts/types";

// Mapper for new grids
export function createDefaultGrid(userId: string, name: string): Grid {
  if (!name) {
    name = "";
  }

  return {
    id: "", // The DAO will provide the ID later
    userId,
    name,
    colNum: 12, // Default number of columns
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
