import type { Tile, Breakpoint, TilePosition } from '../types/Tile';

export type { Breakpoint } from '../types/Tile';

export interface Snapshot {
  tiles: Tile[];
  overrides: Partial<Record<Breakpoint, Record<string, TilePosition>>>;
  verticalCompact: boolean;
  themeId: string;
  backgroundImageSrc: string;
  backgroundEmbed: boolean;
  forcedBreakpoint: Breakpoint;
  actionLabel: string;
}