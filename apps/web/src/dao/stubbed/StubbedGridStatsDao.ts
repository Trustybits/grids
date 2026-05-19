import type { GridStatsDao } from "@/dao/interfaces/GridStatsDao";
import type { DailyGridStats, GridStats } from "@/types/Analytics";

export class StubbedGridStatsDao implements GridStatsDao {
  public getAggregate(_layoutId: string): Promise<GridStats | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public getDaily(
    _layoutId: string,
    _date: string,
  ): Promise<DailyGridStats | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public getDailyRange(
    _layoutId: string,
    _startDate: string,
    _endDate: string,
  ): Promise<DailyGridStats[]> {
    throw new Error("Stubbed DAO implementation");
  }
}
