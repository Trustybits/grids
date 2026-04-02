/**
 * User profile data stored in Firestore users collection
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
