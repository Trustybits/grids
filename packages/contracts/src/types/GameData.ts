/**
 * UserGameData — a user's game state document in the `userGameData` Firestore
 * collection. The doc ID is the user's UID; `userId` is populated by the DAO
 * when reading so consumers receive a self-contained object.
 *
 * DAO impls normalize Firestore Timestamps to native Dates before returning.
 */
export interface UserGameData {
  userId: string;
  displayName: string;
  totalClicks: number;
  createdAt: Date;
  updatedAt: Date;
  /** Clicks made today (resets daily based on `lastClickDate`). */
  dailyClicks?: number;
  /** YYYY-MM-DD of the last click, used to detect daily reset. */
  lastClickDate?: string;
  /** Multiplier for passive click generation (e.g. 1.5 = 50% boost). */
  passiveBoost?: number;
  /** Total clicks earned passively. */
  totalPassiveClicks?: number;
}

/** A single entry returned from leaderboard queries. */
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalClicks: number;
  /** Populated by the service after ordering; not stored on the document. */
  rank?: number;
}

/** Result of a daily click cap check. */
export interface DailyClickLimit {
  canClick: boolean;
  remaining: number;
  dailyClicks: number;
}
