import type { Tile } from "./Tile";
import type { Breakpoint, TilePosition } from "./Tile";

// Controls how much content is carried over when duplicating a grid.
//   'full'      — clone all tile content (media URLs kept, chat cleared)
//   'structure' — keep tile type/size/position only, reset content to defaults
export type CopyDepth = 'full' | 'structure';

export interface Layout {
  id: string;
  userId: string;
  name: string;
  colNum: number;
  verticalCompact: boolean;
  backgroundImageSrc: string;
  backgroundEmbed: boolean;
  themeId?: string;
  tiles: Tile[];
  overrides?: Partial<Record<Breakpoint, Record<string, TilePosition>>>;
  // When true, non-owners can duplicate this grid as a template.
  duplicatable?: boolean;
  createdAt?: any;
  updatedAt?: any;
  lastOpenedAt?: any;
}
