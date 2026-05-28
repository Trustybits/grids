import {
  type Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import type { Grid } from "@grids/contracts/types";
import type { GridDao } from "@grids/contracts/dao";
import { mapFirestoreToGrid } from "./FirestoreUtils";

const COLLECTION = "grids";

export class FirestoreGridDao implements GridDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async getById(id: string): Promise<Grid | null> {
    const docRef = doc(this.db, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return mapFirestoreToGrid(snapshot);
  }

  public async findByUserId(userId: string): Promise<Grid[]> {
    const q = query(
      collection(this.db, COLLECTION),
      where("userId", "==", userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapFirestoreToGrid(d));
  }

  public generateId(): string {
    return doc(collection(this.db, COLLECTION)).id;
  }

  public async save(id: string, data: Record<string, unknown>): Promise<void> {
    const docRef = doc(this.db, COLLECTION, id);
    await setDoc(docRef, data, { merge: true });
  }

  public async update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const docRef = doc(this.db, COLLECTION, id);
    await updateDoc(docRef, data);
  }

  public async updateLastOpenedAt(id: string): Promise<void> {
    const docRef = doc(this.db, COLLECTION, id);
    await updateDoc(docRef, { lastOpenedAt: serverTimestamp() });
  }

  public async delete(id: string): Promise<void> {
    const docRef = doc(this.db, COLLECTION, id);
    await deleteDoc(docRef);
  }
}
