import type { ChatDao } from "@/dao/interfaces/ChatDao";

export class StubbedChatDao implements ChatDao {
  public subscribeToMessages(
    _layoutId: string,
    _tileId: string,
    _callback: (messages: Array<Record<string, unknown>>) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }

  public addMessage(
    _layoutId: string,
    _tileId: string,
    _message: { text: string; createdAt: number; authorId: string },
  ): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }
}
