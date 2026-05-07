import type { ChatDao } from "@/dao/interfaces/ChatDao";
import type { ChatMessage } from "@/types/TileContent";

export class StubbedChatDao implements ChatDao {
  public subscribeToMessages(
    _layoutId: string,
    _tileId: string,
    _callback: (messages: ChatMessage[]) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }

  public addMessage(
    _layoutId: string,
    _tileId: string,
    _message: { text: string; createdAt: number; authorId: string },
  ): Promise<string> {
    throw new Error("Stubbed DAO implementation");
  }

  public updateMessage(
    _layoutId: string,
    _tileId: string,
    _messageId: string,
    _text: string,
  ): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public deleteMessage(
    _layoutId: string,
    _tileId: string,
    _messageId: string,
  ): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }
}
