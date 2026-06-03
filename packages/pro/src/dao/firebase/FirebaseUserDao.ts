import {
  type Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import type { UserDao } from "@grids/contracts/dao";

const COLLECTION = "users";

export class FirebaseUserDao implements UserDao {
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

  public async save(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const docRef = doc(this.db, COLLECTION, userId);
    await setDoc(docRef, data, { merge: true });
  }

  public async update(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const docRef = doc(this.db, COLLECTION, userId);
    await updateDoc(docRef, data);
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
