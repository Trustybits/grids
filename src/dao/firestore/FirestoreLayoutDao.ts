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
import type { Layout } from "@/types/Layout";
import type { LayoutDao } from "../interfaces/LayoutDao";
import { mapFirestoreToLayout } from "./FirestoreUtils";

const COLLECTION = "layouts";

export class FirestoreLayoutDao implements LayoutDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async getById(id: string): Promise<Layout | null> {
    const docRef = doc(this.db, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return mapFirestoreToLayout(snapshot);
  }

  public async findByUserId(userId: string): Promise<Layout[]> {
    const q = query(
      collection(this.db, COLLECTION),
      where("userId", "==", userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapFirestoreToLayout(d));
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
