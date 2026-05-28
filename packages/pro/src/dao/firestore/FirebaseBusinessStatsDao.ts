import {
  type DocumentData,
  type Firestore,
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
} from "firebase/firestore";
import type { BusinessStatsDao } from "@grids/contracts/dao";
import type { BusinessStats, DailyBusinessStats } from "@grids/contracts/types";

const COLLECTION = "businessStats";
const AGGREGATE_DOC_ID = "global";

function dailyDocId(date: string): string {
  return `daily__${date}`;
}

function toBusinessStats(data: DocumentData): BusinessStats {
  return {
    totalGridsCreated: data.totalGridsCreated ?? 0,
    totalGridsDeleted: data.totalGridsDeleted ?? 0,
    activeGrids: data.activeGrids ?? 0,
    totalUsers: data.totalUsers ?? 0,
    totalLogins: data.totalLogins ?? 0,
    totalOwnerVisits: data.totalOwnerVisits ?? 0,
    tileAdds: data.tileAdds ?? {},
    tileDeletes: data.tileDeletes ?? {},
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date(0),
  };
}

function toDailyBusinessStats(data: DocumentData): DailyBusinessStats {
  return { ...toBusinessStats(data), date: data.date };
}

export class FirestoreBusinessStatsDao implements BusinessStatsDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async getAggregate(): Promise<BusinessStats | null> {
    const snap = await getDoc(doc(this.db, COLLECTION, AGGREGATE_DOC_ID));
    if (!snap.exists()) return null;
    return toBusinessStats(snap.data());
  }

  public async getDaily(date: string): Promise<DailyBusinessStats | null> {
    const snap = await getDoc(doc(this.db, COLLECTION, dailyDocId(date)));
    if (!snap.exists()) return null;
    return toDailyBusinessStats(snap.data());
  }

  public async getDailyRange(
    startDate: string,
    endDate: string,
  ): Promise<DailyBusinessStats[]> {
    // `daily__{YYYY-MM-DD}` doc IDs sort lexicographically — a documentId()
    // range query returns the requested days and naturally excludes the
    // `global` aggregate doc.
    const q = query(
      collection(this.db, COLLECTION),
      where(documentId(), ">=", dailyDocId(startDate)),
      where(documentId(), "<=", dailyDocId(endDate)),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => toDailyBusinessStats(d.data()));
  }
}
