import {
  type Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { UserGameDataDao } from "../interfaces/UserGameDataDao";

const COLLECTION = "userGameData";

export class FirestoreUserGameDataDao implements UserGameDataDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async getById(userId: string): Promise<Record<string, unknown> | null> {
    const docRef = doc(this.db, COLLECTION, userId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return snapshot.data() as Record<string, unknown>;
  }

  public async create(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const docRef = doc(this.db, COLLECTION, userId);
    await setDoc(docRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  public async update(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const docRef = doc(this.db, COLLECTION, userId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  public async incrementFields(
    userId: string,
    fields: Record<string, number>,
  ): Promise<void> {
    const docRef = doc(this.db, COLLECTION, userId);
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const [key, amount] of Object.entries(fields)) {
      data[key] = increment(amount);
    }
    await updateDoc(docRef, data);
  }

  public async incrementClicksTransaction(
    userId: string,
    amount: number,
  ): Promise<boolean> {
    const docRef = doc(this.db, COLLECTION, userId);

    return runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists()) {
        throw new Error("DOCUMENT_NOT_FOUND");
      }

      const data = snapshot.data();
      const today = new Date().toISOString().split("T")[0];
      const lastClickDate = (data.lastClickDate as string) || "";
      const currentDailyClicks = (data.dailyClicks as number) || 0;
      const isNewDay = lastClickDate !== today;
      const newDailyClicks = isNewDay ? amount : currentDailyClicks + amount;
      const dailyClickCap = 100;

      if (!isNewDay && newDailyClicks > dailyClickCap) {
        return false;
      }

      const updateData: Record<string, unknown> = {
        totalClicks: increment(amount),
        updatedAt: serverTimestamp(),
        lastClickDate: today,
      };

      if (isNewDay) {
        updateData.dailyClicks = amount;
      } else {
        updateData.dailyClicks = increment(amount);
      }

      transaction.update(docRef, updateData);
      return true;
    });
  }

  public subscribe(
    userId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    const docRef = doc(this.db, COLLECTION, userId);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as Record<string, unknown>);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn("Error subscribing to user game data:", error);
      },
    );
  }

  public async getLeaderboard(
    topN: number,
  ): Promise<Array<Record<string, unknown>>> {
    const q = query(
      collection(this.db, COLLECTION),
      orderBy("totalClicks", "desc"),
      limit(topN),
    );
    const snapshot = await getDocs(q);
    const entries: Array<Record<string, unknown>> = [];
    snapshot.forEach((d) => {
      entries.push({ id: d.id, ...d.data() });
    });
    return entries;
  }

  public subscribeToLeaderboard(
    topN: number,
    callback: (entries: Array<Record<string, unknown>>) => void,
  ): () => void {
    const q = query(
      collection(this.db, COLLECTION),
      orderBy("totalClicks", "desc"),
      limit(topN),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const entries: Array<Record<string, unknown>> = [];
        snapshot.forEach((d) => {
          entries.push({ id: d.id, ...d.data() });
        });
        callback(entries);
      },
      (error) => {
        console.warn("Error subscribing to leaderboard:", error);
        callback([]);
      },
    );
  }
}
