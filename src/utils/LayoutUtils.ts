import type { Tile } from '@/types/Tile';
import { type Layout } from '@/types/Layout';


export const findTileById = (tiles: Tile[], id: string): Tile | undefined => {
  return tiles.find(tile => tile.i === id);
};

export const updateTilePosition = (tiles: Tile[], id: string, x: number, y: number): Tile[] => {
  return tiles.map(tile =>
    tile.i === id ? { ...tile, position: { x, y } } : tile
  );
};
