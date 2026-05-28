import {
  type Firestore,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import type { Functions } from "firebase/functions";
import { httpsCallable } from "firebase/functions";
import type { UpvoteDao } from "@grids/contracts/dao";

export class FirebaseUpvoteDao implements UpvoteDao {
  private db: Firestore;
  private functions: Functions;

  public constructor(db: Firestore, functions: Functions) {
    this.db = db;
    this.functions = functions;
  }

  public subscribeToUserUpvotes(
    gridId: string,
    tileId: string,
    userId: string,
    callback: (votedPageIds: Set<string>) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const upvotesRef = collection(
      this.db,
      "grids",
      gridId,
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
    gridId: string,
    tileId: string,
    notionPageId: string,
  ): Promise<{ isNowUpvoted: boolean }> {
    const fn = httpsCallable<unknown, { isNowUpvoted: boolean }>(
      this.functions,
      "upvoteRoadmapItem",
    );
    const result = await fn({ gridId, tileId, notionPageId });
    return result.data;
  }
}
