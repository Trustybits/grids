import type { UserBadges } from "@/types/Badge";

/**
 * Read-only badge service. Badges are granted server-side only — there are
 * no `grant`/`revoke` methods on the client API. See `@/types/Badge.ts`.
 */
export interface IBadgeService {
  /** Fetch a user's badges, or null if they have no badges document. */
  getBadges(userId: string): Promise<UserBadges | null>;

  /**
   * Subscribe to real-time badge changes for a user. Fires immediately with
   * the current value (or null) and again on every change. Returns an
   * unsubscribe function.
   */
  subscribeToBadges(
    userId: string,
    callback: (badges: UserBadges | null) => void,
  ): () => void;
}
