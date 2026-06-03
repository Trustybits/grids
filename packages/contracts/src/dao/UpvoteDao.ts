export interface UpvoteDao {
  /** Subscribe to the current user's upvotes for a tile in real-time. Returns an unsubscribe function. */
  subscribeToUserUpvotes(
    gridId: string,
    tileId: string,
    userId: string,
    callback: (votedPageIds: Set<string>) => void,
    onError?: (error: Error) => void,
  ): () => void;

  /** Toggle an upvote on a roadmap item. */
  toggleUpvote(
    gridId: string,
    tileId: string,
    notionPageId: string,
  ): Promise<{ isNowUpvoted: boolean }>;
}
