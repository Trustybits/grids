import {
  type Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import type { ChatDao } from "../interfaces/ChatDao";
import type { ChatMessage } from "@/types/TileContent";

export class FirestoreChatDao implements ChatDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  private messagesCollection(gridId: string, tileId: string) {
    return collection(
      this.db,
      "grids",
      gridId,
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
    gridId: string,
    tileId: string,
    callback: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const colRef = this.messagesCollection(gridId, tileId);
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
    gridId: string,
    tileId: string,
    message: { text: string; createdAt: number; authorId: string },
  ): Promise<string> {
    const colRef = this.messagesCollection(gridId, tileId);
    const docRef = await addDoc(colRef, message);
    return docRef.id;
  }

  public async updateMessage(
    gridId: string,
    tileId: string,
    messageId: string,
    text: string,
  ): Promise<void> {
    const docRef = doc(
      this.db,
      "grids",
      gridId,
      "tiles",
      tileId,
      "messages",
      messageId,
    );
    await updateDoc(docRef, { text });
  }

  public async deleteMessage(
    gridId: string,
    tileId: string,
    messageId: string,
  ): Promise<void> {
    const docRef = doc(
      this.db,
      "grids",
      gridId,
      "tiles",
      tileId,
      "messages",
      messageId,
    );
    await deleteDoc(docRef);
  }
}
