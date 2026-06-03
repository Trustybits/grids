import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { ChatDao } from "@grids/contracts/dao";
import type { ChatMessage } from "@grids/contracts/types";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import type { IChatService } from "./interfaces/IChatService";

export class ChatService implements IChatService {
  private chatDao: ChatDao;

  constructor() {
    const factory = getDaoFactory();
    this.chatDao = factory.getChatDao();
  }

  subscribeToMessages(
    gridId: string,
    tileId: string,
    callback: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return this.chatDao.subscribeToMessages(gridId, tileId, callback, onError);
  }

  async sendMessage(
    gridId: string,
    tileId: string,
    text: string,
  ): Promise<string> {
    const authProvider = getAuthProvider();
    const authorId = authProvider.getCurrentUserId() ?? "visitor";
    return this.chatDao.addMessage(gridId, tileId, {
      text,
      createdAt: Date.now(),
      authorId,
    });
  }

  async editMessage(
    gridId: string,
    tileId: string,
    messageId: string,
    text: string,
  ): Promise<void> {
    await this.chatDao.updateMessage(gridId, tileId, messageId, text);
  }

  async deleteMessage(
    gridId: string,
    tileId: string,
    messageId: string,
  ): Promise<void> {
    await this.chatDao.deleteMessage(gridId, tileId, messageId);
  }
}
