import type {
  Breakpoint,
  Tile,
  TilePosition,
} from "@grids/contracts/types";

export interface Snapshot {
  tiles: Tile[];
  overrides: Partial<Record<Breakpoint, Record<string, TilePosition>>>;
  verticalCompact: boolean;
  /** Desktop column count. Optional so older in-memory snapshots still apply. */
  colNum?: number;
  themeId: string;
  backgroundImageSrc: string;
  backgroundEmbed: boolean;
  backgroundColor: string;
  ogImageSrc: string;
  forcedBreakpoint: Breakpoint;
  actionLabel: string;
}
