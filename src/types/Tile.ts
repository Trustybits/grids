import { type TileContent } from './TileContent';

export interface Tile {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  borderEnabled?: boolean;
  caption: string;
  content: TileContent;
}
