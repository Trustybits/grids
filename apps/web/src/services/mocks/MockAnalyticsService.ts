import type {
  GridViewEndEvent,
  LogEventInput,
} from "@/dao/interfaces/AnalyticsEventDao";
import type {
  AnalyticsEventType,
  BusinessStats,
  DailyBusinessStats,
  DailyGridStats,
  GridStats,
} from "@/types/Analytics";
import type { IAnalyticsService } from "../interfaces/IAnalyticsService";

export class MockAnalyticsService implements IAnalyticsService {
  logEvent<T extends AnalyticsEventType>(
    _event: LogEventInput<T>,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  logGridViewEndEventBeacon(_event: GridViewEndEvent): boolean {
    throw new Error("Method not implemented.");
  }
  getGridStats(_layoutId: string): Promise<GridStats | null> {
    throw new Error("Method not implemented.");
  }
  getGridStatsForDate(
    _layoutId: string,
    _date: string,
  ): Promise<DailyGridStats | null> {
    throw new Error("Method not implemented.");
  }
  getGridStatsDailyRange(
    _layoutId: string,
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
