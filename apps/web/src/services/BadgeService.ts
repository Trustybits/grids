import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { BadgeDao } from "@/dao/interfaces/BadgeDao";
import type { BadgeId, UserBadge, UserBadges } from "@/types/Badge";
import { BADGE_IDS } from "@/types/Badge";
import type { IBadgeService } from "./interfaces/IBadgeService";

/**
 * Coerce raw Firestore data into our typed `UserBadges` shape.
 *
 * Firestore returns timestamps as objects with a `.toDate()` method; we
 * normalize to native Dates here so consumers can treat dates uniformly.
 * Unknown badge keys are dropped so future-rolled-back badge IDs can't
 * leak into the UI.
 */
function normalizeBadges(raw: Record<string, unknown> | null): UserBadges {
  if (!raw) return {};

  const out: UserBadges = {};
  for (const id of BADGE_IDS) {
    const value = raw[id];
    const earnedAt = extractEarnedAt(value);
    if (earnedAt) {
      out[id as BadgeId] = { earnedAt } satisfies UserBadge;
    }
  }
  return out;
}

function extractEarnedAt(value: unknown): Date | null {
  if (!value || typeof value !== "object") return null;
  const earnedAtRaw = (value as { earnedAt?: unknown }).earnedAt;
  if (!earnedAtRaw) return null;

  if (earnedAtRaw instanceof Date) return earnedAtRaw;
  if (
    typeof earnedAtRaw === "object" &&
    "toDate" in earnedAtRaw &&
    typeof (earnedAtRaw as { toDate: unknown }).toDate === "function"
  ) {
    return (earnedAtRaw as { toDate: () => Date }).toDate();
  }
  if (typeof earnedAtRaw === "string") {
    const d = new Date(earnedAtRaw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export class BadgeService implements IBadgeService {
  private badgeDao: BadgeDao;

  constructor() {
    this.badgeDao = getDaoFactory().getBadgeDao();
  }

  async getBadges(userId: string): Promise<UserBadges | null> {
    try {
      const data = await this.badgeDao.getById(userId);
      return data ? normalizeBadges(data) : null;
    } catch (error) {
      console.error("Error fetching user badges:", error);
      throw error;
    }
  }

  subscribeToBadges(
    userId: string,
    callback: (badges: UserBadges | null) => void,
  ): () => void {
    return this.badgeDao.subscribe(userId, (data) => {
      callback(data ? normalizeBadges(data) : null);
    });
  }
}
