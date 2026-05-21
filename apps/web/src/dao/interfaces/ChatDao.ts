import type { ChatMessage } from "@/types/TileContent";

export interface ChatDao {
  /** Subscribe to real-time chat messages for a specific tile, ordered by createdAt asc. Returns an unsubscribe function. */
  subscribeToMessages(
    gridId: string,
    tileId: string,
    callback: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void,
  ): () => void;

  /** Add a new chat message to the tile's messages subcollection. Returns the new message ID. */
  addMessage(
    gridId: string,
    tileId: string,
    message: { text: string; createdAt: number; authorId: string },
  ): Promise<string>;

  /** Update the text of an existing chat message. */
  updateMessage(
    gridId: string,
    tileId: string,
    messageId: string,
    text: string,
  ): Promise<void>;

  /** Delete a chat message by its id. */
  deleteMessage(
    gridId: string,
    tileId: string,
    messageId: string,
  ): Promise<void>;
}
