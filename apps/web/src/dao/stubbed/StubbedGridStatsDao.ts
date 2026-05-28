import type { GridStatsDao } from "@grids/contracts/dao";
import type { DailyGridStats, GridStats } from "@grids/contracts/types";

export class StubbedGridStatsDao implements GridStatsDao {
  public getAggregate(_gridId: string): Promise<GridStats | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public getDaily(
    _gridId: string,
    _date: string,
  ): Promise<DailyGridStats | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public getDailyRange(
    _gridId: string,
    _startDate: string,
    _endDate: string,
  ): Promise<DailyGridStats[]> {
    throw new Error("Stubbed DAO implementation");
  }
}
