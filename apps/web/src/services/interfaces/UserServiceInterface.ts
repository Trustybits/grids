import type {
  SlugAvailabilityResponse,
  SlugClaimResponse,
  SlugData,
  UserProfile,
} from "@grids/contracts/types";

export interface UserServiceInterface {
  // ── Profile (users collection) ──────────────────────────────────────

  /** Fetch a user's profile by ID, or null if no document exists. */
  getUserProfile(userId: string): Promise<UserProfile | null>;

  /** Merge-update arbitrary fields on a user's profile document. */
  updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void>;

  /**
   * Subscribe to real-time changes on a user's profile document.
   * Returns an unsubscribe function.
   */
  subscribeToUserProfile(
    userId: string,
    callback: (profile: UserProfile | null) => void,
  ): () => void;

  /**
   * Record a user login — sets `email` and `lastLogin` (server timestamp).
   * Creates the document via merge if it doesn't exist.
   */
  recordLogin(userId: string, email: string | null): Promise<void>;

  // ── Slug (slugs collection / cloud functions) ───────────────────────

  /** Resolve a public slug to its owning userId, or null if the slug is not claimed. */
  getUserIdBySlug(slug: string): Promise<string | null>;

  /**
   * Fetch the full slug record (userId + defaultGridId) for a public slug.
   * Used by the public slug page to resolve the default grid without needing
   * access to the owner's private user document.
   */
  getSlugData(slug: string): Promise<SlugData | null>;

  /** Check whether a slug is available. */
  checkSlugAvailability(slug: string): Promise<SlugAvailabilityResponse>;

  /** Claim a slug for the currently authenticated user. */
  claimSlug(slug: string): Promise<SlugClaimResponse>;

  /**
   * Set (or clear) the current user's default grid. The cloud function
   * infers the userId from auth; `userId` is accepted for API symmetry.
   */
  setDefaultGrid(userId: string, gridId: string | null): Promise<void>;
}
