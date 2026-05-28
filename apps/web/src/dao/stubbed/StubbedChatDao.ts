import type { ChatDao } from "@grids/contracts/dao";
import type { ChatMessage } from "@grids/contracts/types";

export class StubbedChatDao implements ChatDao {
  public subscribeToMessages(
    _gridId: string,
    _tileId: string,
    _callback: (messages: ChatMessage[]) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }

  public addMessage(
    _gridId: string,
    _tileId: string,
    _message: { text: string; createdAt: number; authorId: string },
  ): Promise<string> {
    throw new Error("Stubbed DAO implementation");
  }

  public updateMessage(
    _gridId: string,
    _tileId: string,
    _messageId: string,
    _text: string,
  ): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public deleteMessage(
    _gridId: string,
    _tileId: string,
    _messageId: string,
  ): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }
}
