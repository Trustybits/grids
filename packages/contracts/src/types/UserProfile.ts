/**
 * User profile data stored in the users collection.
 *
 * Note: badges are NOT stored here. They live in the public `userBadges/{uid}`
 * collection so visitors can see them on profile pages — see `@/types/Badge.ts`.
 */
export interface UserProfile {
  email?: string;
  slug?: string;
  defaultGridId?: string;
  lastLogin?: Date;
  storageUsed?: number;
  isDevAccount?: boolean;
  recentGridIds?: string[];
  /** Dashboard favorites; order is preserved in the Starred section */
  starredGridIds?: string[];
  profilePhotoUrl?: string;
  /**
   * Custom colors the user saved from the color picker, newest first. Shared
   * across all of the user's grids (appended after the built-in preset swatches
   * in the mobile picker). Stored as `#RRGGBB` hex strings.
   */
  savedColors?: string[];
}

/**
 * Data stored on a slug document in the public `slugs` collection.
 * Mirrored from the user's profile for public / unauthenticated access.
 */
export interface SlugData {
  userId: string;
  defaultGridId?: string | null;
}

/**
 * Response from slug availability check
 */
export interface SlugAvailabilityResponse {
  available: boolean;
  reason: "available" | "taken" | "reserved" | "invalid-format" | "own-slug";
  message: string;
}

/**
 * Response from slug claim operation
 */
export interface SlugClaimResponse {
  success: boolean;
  message: string;
  /**
   * The canonical (normalized, lowercased) slug that was claimed. Present on
   * successful claims so callers can update UI directly without re-reading the
   * just-written profile (which is subject to read-after-write races).
   */
  slug?: string;
}
