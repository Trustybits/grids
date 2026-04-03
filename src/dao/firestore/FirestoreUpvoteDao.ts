import type { Firestore } from "firebase/firestore";
import type { UpvoteDao } from "../interfaces/UpvoteDao";

export class FirestoreUpvoteDao implements UpvoteDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

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
