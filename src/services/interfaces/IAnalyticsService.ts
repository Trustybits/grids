import type { LogEventInput } from "@/dao/interfaces/AnalyticsEventDao";
import type {
  AnalyticsEventType,
  BusinessStats,
  DailyBusinessStats,
  DailyGridStats,
  GridStats,
} from "@/types/Analytics";

export interface IAnalyticsService {
  /**
   * Log a single analytics event. Writes to Firestore (`analyticsEvents`) and
   * mirrors to PostHog with the same `eventType` so both stores stay in sync.
   */
  logEvent<T extends AnalyticsEventType>(event: LogEventInput<T>): Promise<void>;

  /** Lifetime aggregate stats for a grid. */
  getGridStats(layoutId: string): Promise<GridStats | null>;

  /** Daily stats for a grid on a UTC date (`YYYY-MM-DD`). */
  getGridStatsForDate(
    layoutId: string,
    date: string,
  ): Promise<DailyGridStats | null>;

  /** Inclusive range of daily stats for a grid. */
  getGridStatsDailyRange(
    layoutId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyGridStats[]>;

  /** Global business stats aggregate. */
  getBusinessStats(): Promise<BusinessStats | null>;

  /** Inclusive range of daily business stats. */
  getBusinessStatsDailyRange(
    startDate: string,
    endDate: string,
  ): Promise<DailyBusinessStats[]>;
}
