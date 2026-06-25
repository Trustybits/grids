import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { UserGameDataDao } from "@grids/contracts/dao";
import type {
  UserGameData,
  LeaderboardEntry,
  DailyClickLimit,
} from "@grids/contracts/types";
import { generateSeededDisplayName } from "@/utils/NameGenerator";
import type { GameDataServiceInterface } from "./interfaces/GameDataServiceInterface";

const DAILY_CLICK_CAP = 100;

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function getDao(): UserGameDataDao {
  return getDaoFactory().getUserGameDataDao();
}

export class GameDataService implements GameDataServiceInterface {
  private handleIncrementClicksError(error: unknown): boolean {
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

  async getOrCreateUserGameData(userId: string): Promise<UserGameData> {
    const dao = getDao();
    const data = await dao.getById(userId);

    if (data) {
      return data;
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
    const lastClickDate = data.lastClickDate ?? "";

    if (lastClickDate !== today) {
      return { canClick: true, remaining: DAILY_CLICK_CAP, dailyClicks: 0 };
    }

    const dailyClicks = data.dailyClicks ?? 0;
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
        try {
          await this.getOrCreateUserGameData(userId);
          return await dao.incrementClicksTransaction(userId, amount);
        } catch (retryError) {
          return this.handleIncrementClicksError(retryError);
        }
      }

      return this.handleIncrementClicksError(error);
    }
  }

  subscribeToUserGameData(
    userId: string,
    callback: (data: UserGameData) => void,
  ): () => void {
    const dao = getDao();

    return dao.subscribe(userId, (data) => {
      if (data) {
        callback(data);
      }
    });
  }

  async getLeaderboard(topN: number = 10): Promise<LeaderboardEntry[]> {
    const dao = getDao();
    const entries = await dao.getLeaderboard(topN);
    return entries.map((entry, i) => ({ ...entry, rank: i + 1 }));
  }

  subscribeToLeaderboard(
    topN: number = 10,
    callback: (leaderboard: LeaderboardEntry[]) => void,
  ): () => void {
    const dao = getDao();

    return dao.subscribeToLeaderboard(topN, (entries) => {
      callback(entries.map((entry, i) => ({ ...entry, rank: i + 1 })));
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

    const totalClicks = data.totalClicks;
    const lastUpdate = data.updatedAt;

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
