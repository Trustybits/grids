import type { UpvoteDao } from "@grids/contracts/dao";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import {
  channel,
  cloneValue,
  emit,
  memoryDatabase,
  subscribeToValue,
} from "./StubbedMemoryDatabase";

function upvoteKey(gridId: string, tileId: string, userId: string): string {
  return `${gridId}/${tileId}/${userId}`;
}

export class StubbedUpvoteDao implements UpvoteDao {
  public subscribeToUserUpvotes(
    gridId: string,
    tileId: string,
    userId: string,
    callback: (votedPageIds: Set<string>) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    const key = upvoteKey(gridId, tileId, userId);
    return subscribeToValue(
      channel("upvotes", key),
      () => new Set(memoryDatabase.upvotes.get(key) ?? []),
      callback,
    );
  }

  public async toggleUpvote(
    gridId: string,
    tileId: string,
    notionPageId: string,
  ): Promise<{ isNowUpvoted: boolean }> {
    const userId = getAuthProvider().getCurrentUserId() ?? "visitor";
    const key = upvoteKey(gridId, tileId, userId);
    const voted = cloneValue(
      memoryDatabase.upvotes.get(key) ?? new Set<string>(),
    );
    const isNowUpvoted = !voted.has(notionPageId);
    if (isNowUpvoted) {
      voted.add(notionPageId);
    } else {
      voted.delete(notionPageId);
    }
    memoryDatabase.upvotes.set(key, voted);
    emit(channel("upvotes", key));
    return { isNowUpvoted };
  }
}
