/**
 * User profile data stored in the users collection
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
  /** PWYW supporter badge (set via Stripe checkout or free-badge grant) */
  hasSupporterBadge?: boolean;
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
