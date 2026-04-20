import type { IUpvoteService } from "../interfaces/IUpvoteService";

export class MockUpvoteService implements IUpvoteService {
  subscribeToUserUpvotes(
    _layoutId: string,
    _tileId: string,
    _userId: string,
    _callback: (votedPageIds: Set<string>) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    throw new Error("Method not implemented.");
  }

  toggleUpvote(
    _layoutId: string,
    _tileId: string,
    _notionPageId: string,
  ): Promise<{ isNowUpvoted: boolean }> {
    throw new Error("Method not implemented.");
  }
}
