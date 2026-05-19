export interface UserGameDataDao {
  /** Get game data document for a user. */
  getById(userId: string): Promise<Record<string, unknown> | null>;

  /** Create a new game data document for a user. */
  create(userId: string, data: Record<string, unknown>): Promise<void>;

  /** Update specific fields on a game data document. */
  update(userId: string, data: Record<string, unknown>): Promise<void>;

  /** Atomically increment one or more numeric fields. Keys are field names, values are the amounts to add. */
  incrementFields(userId: string, fields: Record<string, number>): Promise<void>;

  /** Atomically increment clicks within a transaction. Returns true if applied (under daily cap), false otherwise. */
  incrementClicksTransaction(userId: string, amount: number): Promise<boolean>;

  /** Subscribe to a single user's game data document in real-time. Returns an unsubscribe function. */
  subscribe(
    userId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void;

  /** Query the top N users by totalClicks (one-time fetch). */
  getLeaderboard(topN: number): Promise<Array<Record<string, unknown>>>;

  /** Subscribe to leaderboard in real-time. Returns an unsubscribe function. */
  subscribeToLeaderboard(
    topN: number,
    callback: (entries: Array<Record<string, unknown>>) => void,
  ): () => void;
}
