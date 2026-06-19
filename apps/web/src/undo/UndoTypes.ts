import type {
  Breakpoint,
  Tile,
  TilePosition,
} from "@grids/contracts/types";

export interface Snapshot {
  tiles: Tile[];
  overrides: Partial<Record<Breakpoint, Record<string, TilePosition>>>;
  verticalCompact: boolean;
  themeId: string;
  backgroundImageSrc: string;
  backgroundEmbed: boolean;
  backgroundColor: string;
  ogImageSrc: string;
  forcedBreakpoint: Breakpoint;
  actionLabel: string;
}
