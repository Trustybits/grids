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
import type {
  UserGameDataDao,
  UserGameDataInput,
} from "@grids/contracts/dao";
import type {
  LeaderboardEntry,
  UserGameData,
} from "@grids/contracts/types";

const COLLECTION = "userGameData";

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function snapshotToUserGameData(
  userId: string,
  data: Record<string, unknown>,
): UserGameData {
  return {
    userId,
    displayName: (data.displayName as string) ?? "",
    totalClicks: (data.totalClicks as number) ?? 0,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    dailyClicks: data.dailyClicks as number | undefined,
    lastClickDate: data.lastClickDate as string | undefined,
    passiveBoost: data.passiveBoost as number | undefined,
    totalPassiveClicks: data.totalPassiveClicks as number | undefined,
  };
}

function snapshotToLeaderboardEntry(
  userId: string,
  data: Record<string, unknown>,
): LeaderboardEntry {
  return {
    userId,
    displayName: (data.displayName as string) ?? "",
    totalClicks: (data.totalClicks as number) ?? 0,
  };
}

export class FirestoreUserGameDataDao implements UserGameDataDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async getById(userId: string): Promise<UserGameData | null> {
    const docRef = doc(this.db, COLLECTION, userId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return snapshotToUserGameData(userId, snapshot.data());
  }

  public async create(
    userId: string,
    data: UserGameDataInput,
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
    data: UserGameDataInput,
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
    callback: (data: UserGameData | null) => void,
  ): () => void {
    const docRef = doc(this.db, COLLECTION, userId);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshotToUserGameData(userId, snapshot.data()));
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn("Error subscribing to user game data:", error);
      },
    );
  }

  public async getLeaderboard(topN: number): Promise<LeaderboardEntry[]> {
    const q = query(
      collection(this.db, COLLECTION),
      orderBy("totalClicks", "desc"),
      limit(topN),
    );
    const snapshot = await getDocs(q);
    const entries: LeaderboardEntry[] = [];
    snapshot.forEach((d) => {
      entries.push(snapshotToLeaderboardEntry(d.id, d.data()));
    });
    return entries;
  }

  public subscribeToLeaderboard(
    topN: number,
    callback: (entries: LeaderboardEntry[]) => void,
  ): () => void {
    const q = query(
      collection(this.db, COLLECTION),
      orderBy("totalClicks", "desc"),
      limit(topN),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const entries: LeaderboardEntry[] = [];
        snapshot.forEach((d) => {
          entries.push(snapshotToLeaderboardEntry(d.id, d.data()));
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
