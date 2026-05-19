import {
  type Firestore,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import type { BadgeDao } from "../interfaces/BadgeDao";

const COLLECTION = "userBadges";

export class FirestoreBadgeDao implements BadgeDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async getById(
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    const docRef = doc(this.db, COLLECTION, userId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return snapshot.data() as Record<string, unknown>;
  }

  public subscribe(
    userId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    const docRef = doc(this.db, COLLECTION, userId);
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as Record<string, unknown>);
      } else {
        callback(null);
      }
    });
  }
}
