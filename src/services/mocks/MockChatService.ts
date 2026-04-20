import type { ChatMessage } from "@/types/TileContent";
import type { IChatService } from "../interfaces/IChatService";

export class MockChatService implements IChatService {
  subscribeToMessages(
    _layoutId: string,
    _tileId: string,
    _callback: (messages: ChatMessage[]) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    throw new Error("Method not implemented.");
  }

  sendMessage(
    _layoutId: string,
    _tileId: string,
    _text: string,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
