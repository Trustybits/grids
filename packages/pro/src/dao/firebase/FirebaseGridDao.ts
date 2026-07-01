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
import { mapFirestoreToGrid } from "./FirebaseUtils.js";

const COLLECTION = "grids";

export class FirebaseGridDao implements GridDao {
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
    // Deleting the grid doc is what fires the server-side
    // `cleanupGridSubcollectionsOnDelete` trigger
    // (apps/firebase-functions/src/grids/onTrigger_gridDeleted_cleanupSubcollections.ts),
    // which `recursiveDelete`s the whole grid subtree (tiles/*/messages, etc.)
    // since Firestore does not cascade deletes. This is IRREVERSIBLE — grid
    // deletion is a hard delete today with no undo or trash/restore. If grid
    // deletion ever becomes soft-delete / trash-restore, this delete and that
    // trigger must be revisited so the subtree is only reclaimed on permanent
    // deletion.
    await deleteDoc(docRef);
  }
}
