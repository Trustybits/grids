import type { ChatDao } from "@grids/contracts/dao";
import type { ChatMessage } from "@grids/contracts/types";
import {
  channel,
  cloneValue,
  createId,
  emit,
  memoryDatabase,
  subscribeToValue,
} from "./StubbedMemoryDatabase";

function messageKey(gridId: string, tileId: string): string {
  return `${gridId}/${tileId}`;
}

export class StubbedChatDao implements ChatDao {
  public subscribeToMessages(
    gridId: string,
    tileId: string,
    callback: (messages: ChatMessage[]) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    const key = messageKey(gridId, tileId);
    return subscribeToValue(
      channel("messages", key),
      () => memoryDatabase.messages.get(key) ?? [],
      callback,
    );
  }

  public async addMessage(
    gridId: string,
    tileId: string,
    message: { text: string; createdAt: number; authorId: string },
  ): Promise<string> {
    const key = messageKey(gridId, tileId);
    const id = createId("message");
    const messages = memoryDatabase.messages.get(key) ?? [];
    memoryDatabase.messages.set(key, [
      ...cloneValue(messages),
      { id, ...message },
    ]);
    emit(channel("messages", key));
    return id;
  }

  public async updateMessage(
    gridId: string,
    tileId: string,
    messageId: string,
    text: string,
  ): Promise<void> {
    const key = messageKey(gridId, tileId);
    memoryDatabase.messages.set(
      key,
      (memoryDatabase.messages.get(key) ?? []).map((message) =>
        message.id === messageId ? { ...message, text } : message,
      ),
    );
    emit(channel("messages", key));
  }

  public async deleteMessage(
    gridId: string,
    tileId: string,
    messageId: string,
  ): Promise<void> {
    const key = messageKey(gridId, tileId);
    memoryDatabase.messages.set(
      key,
      (memoryDatabase.messages.get(key) ?? []).filter(
        (message) => message.id !== messageId,
      ),
    );
    emit(channel("messages", key));
  }

  public async deleteAllMessages(
    gridId: string,
    tileId: string,
  ): Promise<void> {
    const key = messageKey(gridId, tileId);
    memoryDatabase.messages.delete(key);
    emit(channel("messages", key));
  }
}
