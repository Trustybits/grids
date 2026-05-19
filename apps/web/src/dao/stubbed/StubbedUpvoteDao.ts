import type { UpvoteDao } from "@/dao/interfaces/UpvoteDao";

export class StubbedUpvoteDao implements UpvoteDao {
  public subscribeToUserUpvotes(
    _layoutId: string,
    _tileId: string,
    _userId: string,
    _callback: (votedPageIds: Set<string>) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }

  public toggleUpvote(
    _layoutId: string,
    _tileId: string,
    _notionPageId: string,
  ): Promise<{ isNowUpvoted: boolean }> {
    throw new Error("Stubbed DAO implementation");
  }
}
