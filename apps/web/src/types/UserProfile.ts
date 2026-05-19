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
  recentLayoutIds?: string[];
  /** Dashboard favorites; order is preserved in the Starred section */
  starredLayoutIds?: string[];
  profilePhotoUrl?: string;
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
  reason: 'available' | 'taken' | 'reserved' | 'invalid-format' | 'own-slug';
  message: string;
}

/**
 * Response from slug claim operation
 */
export interface SlugClaimResponse {
  success: boolean;
  message: string;
}
