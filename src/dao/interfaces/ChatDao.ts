import type { ChatMessage } from "@/types/TileContent";

export interface ChatDao {
  /** Subscribe to real-time chat messages for a specific tile, ordered by createdAt asc. Returns an unsubscribe function. */
  subscribeToMessages(
    layoutId: string,
    tileId: string,
    callback: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void,
  ): () => void;

  /** Add a new chat message to the tile's messages subcollection. */
  addMessage(
    layoutId: string,
    tileId: string,
    message: { text: string; createdAt: number; authorId: string },
  ): Promise<void>;

  /** Delete a chat message by its id. */
  deleteMessage(
    layoutId: string,
    tileId: string,
    messageId: string,
  ): Promise<void>;
}
