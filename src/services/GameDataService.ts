import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { UserGameDataDao } from "@/dao/interfaces/UserGameDataDao";
import type {
  UserGameData,
  LeaderboardEntry,
  DailyClickLimit,
} from "@/types/GameData";
import { generateSeededDisplayName } from "@/utils/NameGenerator";
import type { IGameDataService } from "./interfaces/IGameDataService";

const DAILY_CLICK_CAP = 100;

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function toUserGameData(
  userId: string,
  data: Record<string, unknown>,
): UserGameData {
  const toDate = (val: unknown): Date => {
    if (val && typeof val === "object" && "toDate" in val) {
      return (val as { toDate: () => Date }).toDate();
    }
    return new Date();
  };

  return {
    userId,
    displayName: data.displayName as string,
    totalClicks: (data.totalClicks as number) || 0,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    dailyClicks: (data.dailyClicks as number) || 0,
    lastClickDate: (data.lastClickDate as string) || getTodayDateString(),
    passiveBoost: (data.passiveBoost as number) || 0,
    totalPassiveClicks: (data.totalPassiveClicks as number) || 0,
  };
}

function toLeaderboardEntry(
  data: Record<string, unknown>,
  rank: number,
): LeaderboardEntry {
  return {
    userId: data.id as string,
    displayName: data.displayName as string,
    totalClicks: (data.totalClicks as number) || 0,
    rank,
  };
}

function getDao(): UserGameDataDao {
  return getDaoFactory().getUserGameDataDao();
}

export class GameDataService implements IGameDataService {
  async getOrCreateUserGameData(userId: string): Promise<UserGameData> {
    const dao = getDao();
    const data = await dao.getById(userId);

    if (data) {
      return toUserGameData(userId, data);
    }

    const displayName = generateSeededDisplayName(userId);
    const now = new Date();

    await dao.create(userId, {
      displayName,
      totalClicks: 0,
      dailyClicks: 0,
      lastClickDate: getTodayDateString(),
      passiveBoost: 0,
      totalPassiveClicks: 0,
    });

    return {
      userId,
      displayName,
      totalClicks: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async checkDailyClickLimit(userId: string): Promise<DailyClickLimit> {
    const dao = getDao();
    const data = await dao.getById(userId);

    if (!data) {
      return { canClick: true, remaining: DAILY_CLICK_CAP, dailyClicks: 0 };
    }

    const today = getTodayDateString();
    const lastClickDate = (data.lastClickDate as string) || "";

    if (lastClickDate !== today) {
      return { canClick: true, remaining: DAILY_CLICK_CAP, dailyClicks: 0 };
    }

    const dailyClicks = (data.dailyClicks as number) || 0;
    const remaining = Math.max(0, DAILY_CLICK_CAP - dailyClicks);

    return {
      canClick: dailyClicks < DAILY_CLICK_CAP,
      remaining,
      dailyClicks,
    };
  }

  async incrementUserClicks(
    userId: string,
    amount: number = 1,
  ): Promise<boolean> {
    const dao = getDao();

    try {
      return await dao.incrementClicksTransaction(userId, amount);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage === "DOCUMENT_NOT_FOUND") {
        await this.getOrCreateUserGameData(userId);
        return this.incrementUserClicks(userId, amount);
      }

      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "permission-denied"
      ) {
        console.warn(
          "Click rejected by security rules - likely daily cap reached",
        );
        return false;
      }

      console.error("Error incrementing user clicks:", error);
      return false;
    }
  }

  subscribeToUserGameData(
    userId: string,
    callback: (data: UserGameData) => void,
  ): () => void {
    const dao = getDao();

    return dao.subscribe(userId, (raw) => {
      if (raw) {
        callback(toUserGameData(userId, raw));
      }
    });
  }

  async getLeaderboard(topN: number = 10): Promise<LeaderboardEntry[]> {
    const dao = getDao();
    const entries = await dao.getLeaderboard(topN);
    return entries.map((entry, i) => toLeaderboardEntry(entry, i + 1));
  }

  subscribeToLeaderboard(
    topN: number = 10,
    callback: (leaderboard: LeaderboardEntry[]) => void,
  ): () => void {
    const dao = getDao();

    return dao.subscribeToLeaderboard(topN, (entries) => {
      callback(entries.map((entry, i) => toLeaderboardEntry(entry, i + 1)));
    });
  }

  async updateDisplayName(userId: string, displayName: string): Promise<void> {
    const dao = getDao();
    await dao.update(userId, { displayName });
  }

  async increasePassiveBoost(
    userId: string,
    boostAmount: number,
  ): Promise<void> {
    const dao = getDao();
    await dao.incrementFields(userId, { passiveBoost: boostAmount });
  }

  async addPassiveClicks(userId: string, amount: number): Promise<void> {
    const dao = getDao();
    await dao.incrementFields(userId, {
      totalClicks: amount,
      totalPassiveClicks: amount,
    });
  }

  getDailyClickCap(): number {
    return DAILY_CLICK_CAP;
  }

  async claimPassiveClicks(userId: string): Promise<number> {
    const dao = getDao();
    const data = await dao.getById(userId);

    if (!data) {
      return 0;
    }

    const totalClicks = (data.totalClicks as number) || 0;
    const updatedAt = data.updatedAt;
    const lastUpdate =
      updatedAt && typeof updatedAt === "object" && "toDate" in updatedAt
        ? (updatedAt as { toDate: () => Date }).toDate()
        : new Date();

    const { calculatePassiveClicks } =
      await import("@/utils/PassiveBoostCalculator");
    const passiveClicks = calculatePassiveClicks(totalClicks, lastUpdate);

    if (passiveClicks > 0) {
      await dao.incrementFields(userId, {
        totalClicks: passiveClicks,
        totalPassiveClicks: passiveClicks,
      });
    }

    return passiveClicks;
  }
}
