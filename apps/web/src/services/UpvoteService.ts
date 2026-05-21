import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { UpvoteDao } from "@/dao/interfaces/UpvoteDao";
import type { IUpvoteService } from "./interfaces/IUpvoteService";

export class UpvoteService implements IUpvoteService {
  private upvoteDao: UpvoteDao;

  constructor() {
    const factory = getDaoFactory();
    this.upvoteDao = factory.getUpvoteDao();
  }

  subscribeToUserUpvotes(
    gridId: string,
    tileId: string,
    userId: string,
    callback: (votedPageIds: Set<string>) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return this.upvoteDao.subscribeToUserUpvotes(
      gridId,
      tileId,
      userId,
      callback,
      onError,
    );
  }

  async toggleUpvote(
    gridId: string,
    tileId: string,
    notionPageId: string,
  ): Promise<{ isNowUpvoted: boolean }> {
    return this.upvoteDao.toggleUpvote(gridId, tileId, notionPageId);
  }
}
