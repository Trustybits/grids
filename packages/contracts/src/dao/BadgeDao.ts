import type { UserBadges } from "../types/Badge.js";

/**
 * BadgeDao — read-only access to the public `userBadges/{userId}` collection.
 *
 * Writes are server-only (Cloud Functions / admin scripts via the Admin SDK)
 * to prevent clients from granting themselves badges. The DAO intentionally
 * exposes no `save`/`update` methods.
 */
export interface BadgeDao {
  /** Get a user's badges document, or null if they haven't earned any badges. */
  getById(userId: string): Promise<UserBadges | null>;

  /**
   * Subscribe to real-time changes on a user's badges document.
   * Fires immediately with the current value (or null if missing) and again
   * on every change. Returns an unsubscribe function.
   */
  subscribe(
    userId: string,
    callback: (data: UserBadges | null) => void,
  ): () => void;
}
