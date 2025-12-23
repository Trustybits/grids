import type { Tile } from "./Tile";

export interface Layout {
  id: string;
  userId: string;
  name: string;
  colNum: number;
  backgroundImageSrc: string;
  backgroundEmbed: boolean;
  tiles: Tile[];
}
