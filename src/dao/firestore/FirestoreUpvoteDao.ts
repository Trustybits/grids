import type { UpvoteDao } from "../interfaces/UpvoteDao";

export class FirestoreUpvoteDao implements UpvoteDao {
  public subscribeToUserUpvotes(
    _layoutId: string,
    _tileId: string,
    _userId: string,
    _callback: (votedPageIds: Set<string>) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    throw new Error(
      "FirestoreUpvoteDao.subscribeToUserUpvotes not implemented",
    );
  }

  public toggleUpvote(
    _layoutId: string,
    _tileId: string,
    _notionPageId: string,
  ): Promise<{ isNowUpvoted: boolean }> {
    throw new Error("FirestoreUpvoteDao.toggleUpvote not implemented");
  }
}
