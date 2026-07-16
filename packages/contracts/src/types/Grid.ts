import type { Tile } from "./Tile.js";
import type { Breakpoint, TilePosition } from "./Tile.js";

// Controls how much content is carried over when duplicating a grid.
//   'full'      — clone all tile content (media URLs kept, chat cleared)
//   'structure' — keep tile type/size/position only, reset content to defaults
export type CopyDepth = "full" | "structure";

/**
 * Which background source is currently rendered. A grid can retain BOTH an
 * uploaded image and a custom color at once; this flag decides which one wins
 * so the user can toggle between them without losing the other. When absent
 * (legacy grids), the renderer falls back to presence-based precedence
 * (color over image over none).
 */
export type BackgroundActiveSource = "image" | "color" | "default";

export interface Grid {
  id: string;
  userId: string;
  rev?: number;
  name: string;
  colNum: number;
  verticalCompact: boolean;
  backgroundImageSrc: string;
  backgroundImageHash?: string;
  backgroundEmbed: boolean;
  backgroundColor?: string;
  // Which retained background source (image vs. color) is active. Absent on
  // legacy grids — see BackgroundActiveSource.
  backgroundActiveSource?: BackgroundActiveSource;
  // User-uploaded social share (Open Graph) image URL. When set, it is used
  // as the page's og:image instead of the auto-generated screenshot.
  ogImageSrc?: string;
  themeId?: string;
  tiles: Tile[];
  overrides?: Partial<Record<Breakpoint, Record<string, TilePosition>>>;
  // When true, non-owners can duplicate this grid as a template.
  duplicatable?: boolean;
  // Set to the source grid's id when this grid was created by duplicating
  // another. Used to prevent duplicates from auto-becoming the user's default
  // grid (only fresh grids should).
  clonedFrom?: string;
  createdAt?: Date | { toDate(): Date } | null;
  updatedAt?: Date | { toDate(): Date } | null;
  lastOpenedAt?: Date | { toDate(): Date } | null;
}
