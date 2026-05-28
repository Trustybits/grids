import type { BusinessStatsDao } from "@grids/contracts/dao";
import type { BusinessStats, DailyBusinessStats } from "@grids/contracts/types";

export class StubbedBusinessStatsDao implements BusinessStatsDao {
  public getAggregate(): Promise<BusinessStats | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public getDaily(_date: string): Promise<DailyBusinessStats | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public getDailyRange(
    _startDate: string,
    _endDate: string,
  ): Promise<DailyBusinessStats[]> {
    throw new Error("Stubbed DAO implementation");
  }
}
