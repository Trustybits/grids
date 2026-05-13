import type { ChatMessage } from "@/types/TileContent";

export interface IChatService {
  /**
   * Subscribe to real-time chat messages for a tile, ordered by createdAt asc.
   * Returns an unsubscribe function.
   */
  subscribeToMessages(
    layoutId: string,
    tileId: string,
    callback: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void,
  ): () => void;

  /**
   * Send a chat message. Resolves the current user from the auth provider
   * internally — callers only need to provide the text. Returns the new message ID.
   */
  sendMessage(
    layoutId: string,
    tileId: string,
    text: string,
  ): Promise<string>;

  /** Edit the text of an existing chat message. */
  editMessage(
    layoutId: string,
    tileId: string,
    messageId: string,
    text: string,
  ): Promise<void>;

  /** Delete a chat message. Owners can delete any message; visitors can delete their own current-session messages. */
  deleteMessage(
    layoutId: string,
    tileId: string,
    messageId: string,
  ): Promise<void>;
}
