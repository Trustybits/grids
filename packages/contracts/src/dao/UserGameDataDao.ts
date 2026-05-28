import type { LeaderboardEntry, UserGameData } from "../types/GameData.js";

/**
 * Input shape for create/update operations.
 *
 * Timestamps are managed by the DAO impl (`serverTimestamp()` on Firestore),
 * so callers omit `userId`, `createdAt`, and `updatedAt`. All remaining
 * fields are optional patches.
 */
export type UserGameDataInput = Partial<
  Omit<UserGameData, "userId" | "createdAt" | "updatedAt">
>;

export interface UserGameDataDao {
  /** Get game data document for a user, with `userId` populated. */
  getById(userId: string): Promise<UserGameData | null>;

  /** Create a new game data document for a user. */
  create(userId: string, data: UserGameDataInput): Promise<void>;

  /** Update specific fields on a game data document. */
  update(userId: string, data: UserGameDataInput): Promise<void>;

  /** Atomically increment one or more numeric fields. Keys are field names, values are the amounts to add. */
  incrementFields(userId: string, fields: Record<string, number>): Promise<void>;

  /** Atomically increment clicks within a transaction. Returns true if applied (under daily cap), false otherwise. */
  incrementClicksTransaction(userId: string, amount: number): Promise<boolean>;

  /** Subscribe to a single user's game data document in real-time. Returns an unsubscribe function. */
  subscribe(
    userId: string,
    callback: (data: UserGameData | null) => void,
  ): () => void;

  /** Query the top N users by totalClicks (one-time fetch). Entries are returned without `rank`. */
  getLeaderboard(topN: number): Promise<LeaderboardEntry[]>;

  /** Subscribe to leaderboard in real-time. Returns an unsubscribe function. */
  subscribeToLeaderboard(
    topN: number,
    callback: (entries: LeaderboardEntry[]) => void,
  ): () => void;
}
