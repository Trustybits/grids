import {
  type Firestore,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import type { BadgeDao } from "@grids/contracts/dao";
import type { UserBadge, UserBadges } from "@grids/contracts/types";

const COLLECTION = "userBadges";

function normalizeBadges(raw: Record<string, unknown>): UserBadges {
  const out: UserBadges = {};
  for (const [id, value] of Object.entries(raw)) {
    const earnedAt = extractDate((value as { earnedAt?: unknown })?.earnedAt);
    if (earnedAt) {
      (out as Record<string, UserBadge>)[id] = { earnedAt };
    }
  }
  return out;
}

function extractDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export class FirestoreBadgeDao implements BadgeDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async getById(userId: string): Promise<UserBadges | null> {
    const docRef = doc(this.db, COLLECTION, userId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return normalizeBadges(snapshot.data());
  }

  public subscribe(
    userId: string,
    callback: (data: UserBadges | null) => void,
  ): () => void {
    const docRef = doc(this.db, COLLECTION, userId);
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(normalizeBadges(snapshot.data()));
      } else {
        callback(null);
      }
    });
  }
}
