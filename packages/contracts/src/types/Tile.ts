import { type TileContent } from "./TileContent.js";

export type Breakpoint = "lg" | "md" | "sm";

export interface TilePosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
