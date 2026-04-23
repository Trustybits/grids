import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { ChatDao } from "@/dao/interfaces/ChatDao";
import type { ChatMessage } from "@/types/TileContent";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import type { IChatService } from "./interfaces/IChatService";

export class ChatService implements IChatService {
  private chatDao: ChatDao;

  constructor() {
    const factory = getDaoFactory();
    this.chatDao = factory.getChatDao();
  }

  subscribeToMessages(
    layoutId: string,
    tileId: string,
    callback: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return this.chatDao.subscribeToMessages(layoutId, tileId, callback, onError);
  }

  async sendMessage(
    layoutId: string,
    tileId: string,
    text: string,
  ): Promise<void> {
    const authProvider = getAuthProvider();
    const authorId = authProvider.getCurrentUserId() ?? "visitor";
    await this.chatDao.addMessage(layoutId, tileId, {
      text,
      createdAt: Date.now(),
      authorId,
    });
  }
}
