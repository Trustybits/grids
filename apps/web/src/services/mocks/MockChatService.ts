import type { ChatMessage } from "@grids/contracts/types";
import type { IChatService } from "../interfaces/IChatService";

export class MockChatService implements IChatService {
  subscribeToMessages(
    _gridId: string,
    _tileId: string,
    _callback: (messages: ChatMessage[]) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    throw new Error("Method not implemented.");
  }

  sendMessage(
    _gridId: string,
    _tileId: string,
    _text: string,
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }

  editMessage(
    _gridId: string,
    _tileId: string,
    _messageId: string,
    _text: string,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  deleteMessage(
    _gridId: string,
    _tileId: string,
    _messageId: string,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
