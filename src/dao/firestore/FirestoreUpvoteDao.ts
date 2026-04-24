import {
  type Firestore,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import type { Functions } from "firebase/functions";
import { httpsCallable } from "firebase/functions";
import type { UpvoteDao } from "../interfaces/UpvoteDao";

export class FirestoreUpvoteDao implements UpvoteDao {
  private db: Firestore;
  private functions: Functions;

  public constructor(db: Firestore, functions: Functions) {
    this.db = db;
    this.functions = functions;
  }

  public subscribeToUserUpvotes(
    layoutId: string,
    tileId: string,
    userId: string,
    callback: (votedPageIds: Set<string>) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const upvotesRef = collection(
      this.db,
      "layouts",
      layoutId,
      "tiles",
      tileId,
      "upvotes",
    );
    const myVotesQuery = query(upvotesRef, where("userId", "==", userId));

    return onSnapshot(
      myVotesQuery,
      (snap) => {
        const voted = new Set<string>();
        snap.forEach((d) => {
          const data = d.data();
          if (data?.notionPageId) voted.add(data.notionPageId as string);
        });
        callback(voted);
      },
      (error) => {
        if (onError) onError(error);
      },
    );
  }

  public async toggleUpvote(
    layoutId: string,
    tileId: string,
    notionPageId: string,
  ): Promise<{ isNowUpvoted: boolean }> {
    const fn = httpsCallable<unknown, { isNowUpvoted: boolean }>(
      this.functions,
      "upvoteRoadmapItem",
    );
    const result = await fn({ layoutId, tileId, notionPageId });
    return result.data;
  }
}
