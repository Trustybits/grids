export interface UserDao {
  /** Get a user document by user ID. */
  getById(userId: string): Promise<Record<string, unknown> | null>;

  /** Create or merge-update fields on a user document. */
  save(userId: string, data: Record<string, unknown>): Promise<void>;

  /** Update specific fields on an existing user document (fails if doc doesn't exist). */
  update(userId: string, data: Record<string, unknown>): Promise<void>;

  /** Subscribe to real-time changes on a user document. Returns an unsubscribe function. */
  subscribe(
    userId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void;
}
