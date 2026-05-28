import type { BusinessStatsDao } from "@grids/contracts/dao";
import type { BusinessStats, DailyBusinessStats } from "@grids/contracts/types";
import { cloneValue, memoryDatabase } from "./StubbedMemoryDatabase";

export class StubbedBusinessStatsDao implements BusinessStatsDao {
  public async getAggregate(): Promise<BusinessStats | null> {
    return memoryDatabase.businessStats
      ? cloneValue(memoryDatabase.businessStats)
      : null;
  }

  public async getDaily(date: string): Promise<DailyBusinessStats | null> {
    const stats = memoryDatabase.businessDailyStats.get(date);
    return stats ? cloneValue(stats) : null;
  }

  public async getDailyRange(
    startDate: string,
    endDate: string,
  ): Promise<DailyBusinessStats[]> {
    return Array.from(memoryDatabase.businessDailyStats.values())
      .filter((stats) => stats.date >= startDate && stats.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((stats) => cloneValue(stats));
  }
}
