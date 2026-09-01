import type { Tile } from "./Tile.js";
import type { Breakpoint, TilePosition } from "./Tile.js";

export const GRIDDLE_RESPONSIVE_LAYOUT_VERSION = "griddle-v1" as const;

export const RESPONSIVE_LAYOUT_VERSIONS = [
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
] as const;

export type ResponsiveLayoutVersion =
  (typeof RESPONSIVE_LAYOUT_VERSIONS)[number];

/**
 * Read-time classification of the stored responsive-layout value. This is
 * transient domain metadata: persistence payloads must never write it.
 */
export type ResponsiveLayoutVersionStatus =
  | "missing"
  | "supported"
  | "unsupported";

/** Current stamp for newly created and duplicated grids. */
export const NEW_GRID_RESPONSIVE_LAYOUT_VERSION =
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION;

export function isResponsiveLayoutVersion(
  value: unknown,
): value is ResponsiveLayoutVersion {
  return value === GRIDDLE_RESPONSIVE_LAYOUT_VERSION;
}

/**
 * Resolve untrusted stored data for rendering. The stamp is forward-looking
 * compatibility metadata; every current value renders through Griddle v1.
 */
export function resolveResponsiveLayoutVersion(
  _value: unknown,
): ResponsiveLayoutVersion {
  return GRIDDLE_RESPONSIVE_LAYOUT_VERSION;
}

export function getResponsiveLayoutVersionStatus(
  value: unknown,
): ResponsiveLayoutVersionStatus {
  if (value === undefined) return "missing";
  return isResponsiveLayoutVersion(value) ? "supported" : "unsupported";
}

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

/**
 * Publish lifecycle of a grid document. A grid that is not "published" is
 * private (readable only by its owner). Absent on legacy documents — treat a
 * missing value as "published" so existing public grids stay public.
 */
export type GridStatus = "draft" | "published";

export interface Grid {
  id: string;
  userId: string;
  rev?: number;
  name: string;
  colNum: number;
  responsiveLayoutVersion?: ResponsiveLayoutVersion;
  /** Transient read metadata; never persisted to the grid document. */
  responsiveLayoutVersionStatus?: ResponsiveLayoutVersionStatus;
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
  // Publish lifecycle. Absent on legacy grids — treat missing as "published".
  // A non-"published" doc is private (owner-only) via the Firestore read rule.
  status?: GridStatus;
  // Set on a hidden draft to the id of the published grid it shadows. Distinct
  // from clonedFrom: a draft is hidden and written back on publish, whereas a
  // normal duplicate keeps clonedFrom and stays listed. Never set both.
  draftOf?: string;
  // When the grid was last published (set on publish / publish-as-copy).
  publishedAt?: Date | { toDate(): Date } | null;
  createdAt?: Date | { toDate(): Date } | null;
  updatedAt?: Date | { toDate(): Date } | null;
  lastOpenedAt?: Date | { toDate(): Date } | null;
}
