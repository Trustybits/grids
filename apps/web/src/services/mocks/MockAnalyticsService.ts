import type { GridViewEndEvent, LogEventInput } from "@grids/contracts/dao";
import type {
  AnalyticsEventType,
  BusinessStats,
  DailyBusinessStats,
  DailyGridStats,
  GridStats,
} from "@grids/contracts/types";
import type { AnalyticsServiceInterface } from "../interfaces/AnalyticsServiceInterface";

export class MockAnalyticsService implements AnalyticsServiceInterface {
  logEvent<T extends AnalyticsEventType>(
    _event: LogEventInput<T>,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  logGridViewEndEventBeacon(_event: GridViewEndEvent): boolean {
    throw new Error("Method not implemented.");
  }
  getGridStats(_gridId: string): Promise<GridStats | null> {
    throw new Error("Method not implemented.");
  }
  getGridStatsForDate(
    _gridId: string,
    _date: string,
  ): Promise<DailyGridStats | null> {
    throw new Error("Method not implemented.");
  }
  getGridStatsDailyRange(
    _gridId: string,
    _startDate: string,
    _endDate: string,
  ): Promise<DailyGridStats[]> {
    throw new Error("Method not implemented.");
  }
  getBusinessStats(): Promise<BusinessStats | null> {
    throw new Error("Method not implemented.");
  }
  getBusinessStatsDailyRange(
    _startDate: string,
    _endDate: string,
  ): Promise<DailyBusinessStats[]> {
    throw new Error("Method not implemented.");
  }
}
