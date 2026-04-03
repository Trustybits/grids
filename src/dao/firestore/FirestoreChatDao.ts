import type { Firestore } from "firebase/firestore";
import type { ChatDao } from "../interfaces/ChatDao";

export class FirestoreChatDao implements ChatDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public subscribeToMessages(
    _layoutId: string,
    _tileId: string,
    _callback: (messages: Array<Record<string, unknown>>) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    throw new Error("FirestoreChatDao.subscribeToMessages not implemented");
  }

  public addMessage(
    _layoutId: string,
    _tileId: string,
    _message: { text: string; createdAt: number; authorId: string },
  ): Promise<void> {
    throw new Error("FirestoreChatDao.addMessage not implemented");
  }
}
