import {
  type Firestore,
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import type { ChatDao } from "../interfaces/ChatDao";
import type { ChatMessage } from "@/types/TileContent";

export class FirestoreChatDao implements ChatDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  private messagesCollection(layoutId: string, tileId: string) {
    return collection(
      this.db,
      "layouts",
      layoutId,
      "tiles",
      tileId,
      "messages",
    );
  }

  private normalizeCreatedAt(value: unknown): number {
    if (typeof value === "number") return value;
    if (value && typeof value === "object" && "toMillis" in value) {
      return (value as { toMillis: () => number }).toMillis();
    }
    return Date.now();
  }

  public subscribeToMessages(
    layoutId: string,
    tileId: string,
    callback: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const colRef = this.messagesCollection(layoutId, tileId);
    const messagesQuery = query(colRef, orderBy("createdAt", "asc"));

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messages = snapshot.docs
          .map((doc) => {
            const data = doc.data() as Record<string, unknown>;
            const text = typeof data.text === "string" ? data.text : "";
            if (!text) return null;
            return {
              id: doc.id,
              text,
              createdAt: this.normalizeCreatedAt(data.createdAt),
              authorId:
                typeof data.authorId === "string" ? data.authorId : undefined,
            } as ChatMessage;
          })
          .filter((message): message is ChatMessage => !!message);
        callback(messages);
      },
      (error) => {
        if (onError) onError(error);
      },
    );
  }

  public async addMessage(
    layoutId: string,
    tileId: string,
    message: { text: string; createdAt: number; authorId: string },
  ): Promise<void> {
    const colRef = this.messagesCollection(layoutId, tileId);
    await addDoc(colRef, message);
  }
}
