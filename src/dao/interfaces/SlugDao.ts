export interface SlugDao {
  /** Look up a slug document to get the associated userId and metadata. */
  getBySlug(slug: string): Promise<Record<string, unknown> | null>;

  /** Check if a slug is available. */
  checkAvailability(
    slug: string,
  ): Promise<{ available: boolean; reason: string; message: string }>;

  /** Claim a slug for the current user. */
  claim(slug: string): Promise<{ success: boolean; message: string }>;

  /** Update the default grid for the current user's slug. */
  updateDefaultGrid(gridId: string | null): Promise<{ success: boolean }>;
}
