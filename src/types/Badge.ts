/**
 * Badge — a recognition awarded to a user, displayed on their public profile.
 *
 * ── Storage ───────────────────────────────────────────────────────────────
 *
 * Badges live in the top-level `userBadges/{userId}` Firestore collection.
 * The doc ID is the user's UID and the doc body is a map keyed by badge ID.
 * The collection is publicly readable and server-only writable — clients
 * (including the badge owner) can never grant themselves a badge. Granting
 * happens via Cloud Functions or admin scripts using the Admin SDK.
 *
 * ── Adding a new badge ────────────────────────────────────────────────────
 *
 *   1. Add the badge ID to `BadgeId` and `BADGE_IDS` below
 *   2. Add metadata (label, description, icon component) to `BADGE_META`
 *      in `src/composables/useBadges.ts`
 *   3. Decide how it's granted:
 *        - Event-driven   → add a Firestore/Auth trigger in `functions/src/`
 *        - Manual/curated → grant via `functions/scripts/grantBadge.ts`
 *        - Criteria-based → scheduled function in `functions/src/`
 */

export type BadgeId = "earlyAdopter" | "supporter";

/** All known badge IDs — keep in sync with the union above. */
export const BADGE_IDS: readonly BadgeId[] = ["earlyAdopter", "supporter"];

/**
 * Per-badge data stored on the userBadges document.
 *
 * `earnedAt` is set once when the badge is first granted and never updated
 * (so re-running the granting trigger is idempotent).
 */
export interface UserBadge {
  /** When the user first earned this badge (Firestore Timestamp on the wire). */
  earnedAt: Date;
}

/**
 * Shape of a `userBadges/{userId}` document.
 *
 * All keys are optional — a user only has documents for badges they've earned.
 * An empty/missing document means the user has earned no badges yet.
 */
export type UserBadges = Partial<Record<BadgeId, UserBadge>>;
