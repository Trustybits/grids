export interface IUpvoteService {
  /**
   * Subscribe to the current user's upvoted page IDs for a tile in real-time.
   * Returns an unsubscribe function.
   */
  subscribeToUserUpvotes(
    layoutId: string,
    tileId: string,
    userId: string,
    callback: (votedPageIds: Set<string>) => void,
    onError?: (error: Error) => void,
  ): () => void;

  /** Toggle an upvote on a roadmap item. Returns the new vote state. */
  toggleUpvote(
    layoutId: string,
    tileId: string,
    notionPageId: string,
  ): Promise<{ isNowUpvoted: boolean }>;
}
