import type {
  SlugAvailabilityResponse,
  SlugClaimResponse,
} from "@/types/UserProfile";

export interface SlugDao {
  /** Look up a slug document to get the associated userId and metadata. */
  getBySlug(slug: string): Promise<Record<string, unknown> | null>;

  /** Check if a slug is available. */
  checkAvailability(slug: string): Promise<SlugAvailabilityResponse>;

  /** Claim a slug for the current user. */
  claim(slug: string): Promise<SlugClaimResponse>;

  /** Update the default grid for the current user's slug. */
  updateDefaultGrid(gridId: string | null): Promise<{ success: boolean }>;
}
