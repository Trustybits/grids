import type { Tile } from "./Tile";
import type { Breakpoint, TilePosition } from "./Tile";

export interface Layout {
  id: string;
  userId: string;
  name: string;
  colNum: number;
  verticalCompact: boolean;
  backgroundImageSrc: string;
  backgroundEmbed: boolean;
  tiles: Tile[];
  overrides?: Partial<Record<Breakpoint, Record<string, TilePosition>>>;
  createdAt?: any;
  updatedAt?: any;
  lastOpenedAt?: any;
}
