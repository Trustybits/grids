import type { Tile } from "./Tile.js";
import type { Breakpoint, TilePosition } from "./Tile.js";

export const LEGACY_RESPONSIVE_LAYOUT_VERSION = "legacy-v1" as const;
export const GRIDDLE_RESPONSIVE_LAYOUT_VERSION = "griddle-v1" as const;

export const RESPONSIVE_LAYOUT_VERSIONS = [
  LEGACY_RESPONSIVE_LAYOUT_VERSION,
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

/**
 * Eventual launch default for newly created grids. Production creation remains
 * separately gated until the finalized Griddle strategy is launch-ready.
 */
export const NEW_GRID_RESPONSIVE_LAYOUT_VERSION =
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION;

export function isResponsiveLayoutVersion(
  value: unknown,
): value is ResponsiveLayoutVersion {
  return (
    value === LEGACY_RESPONSIVE_LAYOUT_VERSION ||
    value === GRIDDLE_RESPONSIVE_LAYOUT_VERSION
  );
}

/**
 * Resolve untrusted stored data for rendering. Missing, malformed, and unknown
 * future values stay on the frozen legacy projection for compatibility.
 */
export function resolveResponsiveLayoutVersion(
  value: unknown,
): ResponsiveLayoutVersion {
  return isResponsiveLayoutVersion(value)
    ? value
    : LEGACY_RESPONSIVE_LAYOUT_VERSION;
}

export function getResponsiveLayoutVersionStatus(
  value: unknown,
): ResponsiveLayoutVersionStatus {
  if (value === undefined) return "missing";
  return isResponsiveLayoutVersion(value) ? "supported" : "unsupported";
}

/**
 * Only an unstamped grid or one explicitly pinned to legacy-v1 may use the
 * irreversible legacy-to-Griddle upgrade command. Unknown future versions are
 * rendered defensively as legacy but must never be overwritten automatically.
 * DAO-normalized callers must pass the accompanying read status so an
 * unsupported stored value remains distinguishable from true legacy.
 */
export function isResponsiveLayoutUpgradeEligible(
  value: unknown,
  status?: ResponsiveLayoutVersionStatus,
): boolean {
  return (
    status !== "unsupported" &&
    (value === undefined || value === LEGACY_RESPONSIVE_LAYOUT_VERSION)
  );
}

// Controls how much content is carried over when duplicating a grid.
//   'full'      — clone all tile content (media URLs kept, chat cleared)
//   'structure' — keep tile type/size/position only, reset content to defaults
export type CopyDepth = "full" | "structure";

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
