import type { UserGameDataDao, UserGameDataInput } from "@grids/contracts/dao";
import type { LeaderboardEntry, UserGameData } from "@grids/contracts/types";
import {
  channel,
  cloneValue,
  emit,
  leaderboardEntries,
  memoryDatabase,
  subscribeToValue,
  todayIsoDate,
} from "./StubbedMemoryDatabase";

const DAILY_CLICK_CAP = 100;

export class StubbedUserGameDataDao implements UserGameDataDao {
  public async getById(userId: string): Promise<UserGameData | null> {
    const data = memoryDatabase.userGameData.get(userId);
    return data ? cloneValue(data) : null;
  }

  public async create(userId: string, data: UserGameDataInput): Promise<void> {
    const now = new Date();
    memoryDatabase.userGameData.set(userId, {
      userId,
      displayName: data.displayName ?? "",
      totalClicks: data.totalClicks ?? 0,
      createdAt: now,
      updatedAt: now,
      dailyClicks: data.dailyClicks,
      lastClickDate: data.lastClickDate,
      passiveBoost: data.passiveBoost,
      totalPassiveClicks: data.totalPassiveClicks,
    });
    this.emitUser(userId);
  }

  public async update(userId: string, data: UserGameDataInput): Promise<void> {
    const existing = memoryDatabase.userGameData.get(userId);
    const now = new Date();
    memoryDatabase.userGameData.set(userId, {
      userId,
      displayName: data.displayName ?? existing?.displayName ?? "",
      totalClicks: data.totalClicks ?? existing?.totalClicks ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      dailyClicks: data.dailyClicks ?? existing?.dailyClicks,
      lastClickDate: data.lastClickDate ?? existing?.lastClickDate,
      passiveBoost: data.passiveBoost ?? existing?.passiveBoost,
      totalPassiveClicks:
        data.totalPassiveClicks ?? existing?.totalPassiveClicks,
    });
    this.emitUser(userId);
  }

  public async incrementFields(
    userId: string,
    fields: Record<string, number>,
  ): Promise<void> {
    const existing = this.requireData(userId);
    const next: UserGameData = {
      ...existing,
      updatedAt: new Date(),
    };
    for (const [key, amount] of Object.entries(fields)) {
      const current =
        typeof next[key as keyof UserGameData] === "number"
          ? (next[key as keyof UserGameData] as number)
          : 0;
      (next as unknown as Record<string, number>)[key] = current + amount;
    }
    memoryDatabase.userGameData.set(userId, next);
    this.emitUser(userId);
  }

  public async incrementClicksTransaction(
    userId: string,
    amount: number,
  ): Promise<boolean> {
    const existing = this.requireData(userId);
    const today = todayIsoDate();
    const isNewDay = existing.lastClickDate !== today;
    const currentDailyClicks = isNewDay ? 0 : (existing.dailyClicks ?? 0);
    const newDailyClicks = currentDailyClicks + amount;
    if (newDailyClicks > DAILY_CLICK_CAP) return false;

    memoryDatabase.userGameData.set(userId, {
      ...existing,
      totalClicks: existing.totalClicks + amount,
      dailyClicks: newDailyClicks,
      lastClickDate: today,
      updatedAt: new Date(),
    });
    this.emitUser(userId);
    return true;
  }

  public subscribe(
    userId: string,
    callback: (data: UserGameData | null) => void,
  ): () => void {
    return subscribeToValue(
      channel("gameData", userId),
      () => memoryDatabase.userGameData.get(userId) ?? null,
      callback,
    );
  }

  public async getLeaderboard(topN: number): Promise<LeaderboardEntry[]> {
    return cloneValue(leaderboardEntries(topN));
  }

  public subscribeToLeaderboard(
    topN: number,
    callback: (entries: LeaderboardEntry[]) => void,
  ): () => void {
    return subscribeToValue(
      channel("leaderboard"),
      () => leaderboardEntries(topN),
      callback,
    );
  }

  private requireData(userId: string): UserGameData {
    const data = memoryDatabase.userGameData.get(userId);
    if (!data) throw new Error("DOCUMENT_NOT_FOUND");
    return cloneValue(data);
  }

  private emitUser(userId: string): void {
    emit(channel("gameData", userId));
    emit(channel("leaderboard"));
  }
}
