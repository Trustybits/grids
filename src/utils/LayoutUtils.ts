import type { Tile } from "@/types/Tile";
import { type Layout } from "@/types/Layout";

// Mapper for new layouts
export function createDefaultLayout(userId: string, name: string): Layout {
  if (!name) {
    name = "";
  }

  return {
    id: "", // Firestore will provide the ID later
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

export const updateTilePosition = (
  tiles: Tile[],
  id: string,
  x: number,
  y: number,
): Tile[] => {
  return tiles.map((tile) =>
    tile.i === id ? { ...tile, position: { x, y } } : tile,
  );
};
