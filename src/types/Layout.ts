import type { Tile } from "./Tile";

export interface Layout {
  id: string;
  userId: string;
  name: string;
  colNum: number;
  verticalCompact: boolean;
  backgroundImageSrc: string;
  backgroundEmbed: boolean;
  tiles: Tile[];
  createdAt?: any;
  updatedAt?: any;
  lastOpenedAt?: any;
}
