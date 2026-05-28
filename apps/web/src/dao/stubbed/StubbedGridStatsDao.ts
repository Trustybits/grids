import type { GridStatsDao } from "@grids/contracts/dao";
import type { DailyGridStats, GridStats } from "@grids/contracts/types";
import { cloneValue, memoryDatabase } from "./StubbedMemoryDatabase";

export class StubbedGridStatsDao implements GridStatsDao {
  public async getAggregate(gridId: string): Promise<GridStats | null> {
    const stats = memoryDatabase.gridStats.get(gridId);
    return stats ? cloneValue(stats) : null;
  }

  public async getDaily(
    gridId: string,
    date: string,
  ): Promise<DailyGridStats | null> {
    const stats = memoryDatabase.gridDailyStats.get(`${gridId}__${date}`);
    return stats ? cloneValue(stats) : null;
  }

  public async getDailyRange(
    gridId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyGridStats[]> {
    return Array.from(memoryDatabase.gridDailyStats.values())
      .filter(
        (stats) =>
          stats.gridId === gridId &&
          stats.date >= startDate &&
          stats.date <= endDate,
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((stats) => cloneValue(stats));
  }
}
