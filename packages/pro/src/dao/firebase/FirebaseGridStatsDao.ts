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
import type { GridStatsDao } from "@grids/contracts/dao";
import type { DailyGridStats, GridStats } from "@grids/contracts/types";

const COLLECTION = "gridStats";

function dailyDocId(gridId: string, date: string): string {
  return `${gridId}__${date}`;
}

function toGridStats(data: DocumentData): GridStats {
  return {
    gridId: data.gridId,
    ownerId: data.ownerId,
    totalViews: data.totalViews ?? 0,
    uniqueViewers: data.uniqueViewers ?? 0,
    authenticatedViews: data.authenticatedViews ?? 0,
    anonymousViews: data.anonymousViews ?? 0,
    totalTimeSpentMs: data.totalTimeSpentMs ?? 0,
    totalSessions: data.totalSessions ?? 0,
    averageTimeSpentMs: data.averageTimeSpentMs ?? 0,
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date(0),
  };
}

function toDailyGridStats(data: DocumentData): DailyGridStats {
  return { ...toGridStats(data), date: data.date };
}

export class FirebaseGridStatsDao implements GridStatsDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async getAggregate(gridId: string): Promise<GridStats | null> {
    const snap = await getDoc(doc(this.db, COLLECTION, gridId));
    if (!snap.exists()) return null;
    return toGridStats(snap.data());
  }

  public async getDaily(
    gridId: string,
    date: string,
  ): Promise<DailyGridStats | null> {
    const snap = await getDoc(
      doc(this.db, COLLECTION, dailyDocId(gridId, date)),
    );
    if (!snap.exists()) return null;
    return toDailyGridStats(snap.data());
  }

  public async getDailyRange(
    gridId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyGridStats[]> {
    // Doc IDs sort lexicographically; `{gridId}__{YYYY-MM-DD}` keeps days
    // for one grid contiguous and ordered, so a documentId() range query
    // returns exactly the daily docs we want without an index.
    const q = query(
      collection(this.db, COLLECTION),
      where(documentId(), ">=", dailyDocId(gridId, startDate)),
      where(documentId(), "<=", dailyDocId(gridId, endDate)),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => toDailyGridStats(d.data()));
  }
}
