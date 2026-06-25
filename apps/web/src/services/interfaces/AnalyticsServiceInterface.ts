import type { GridViewEndEvent, LogEventInput } from "@grids/contracts/dao";
import type {
  AnalyticsEventType,
  BusinessStats,
  DailyBusinessStats,
  DailyGridStats,
  GridStats,
} from "@grids/contracts/types";

export interface AnalyticsServiceInterface {
  /**
   * Log a single analytics event. Writes to Firestore (`analyticsEvents`) and
   * mirrors to PostHog with the same `eventType` so both stores stay in sync.
   */
  logEvent<T extends AnalyticsEventType>(
    event: LogEventInput<T>,
  ): Promise<void>;

  /**
   * Synchronously enqueue a `grid_view_end` event via the beacon transport.
   * Used during page teardown (`visibilitychange → hidden`, `pagehide`) where
   * an async Firestore write may not complete. Mirrors the event to PostHog
   * the same way `logEvent` does. Returns whatever `navigator.sendBeacon`
   * returned, or `false` if the transport isn't available.
   */
  logGridViewEndEventBeacon(event: GridViewEndEvent): boolean;

  /** Lifetime aggregate stats for a grid. */
  getGridStats(gridId: string): Promise<GridStats | null>;

  /** Daily stats for a grid on a UTC date (`YYYY-MM-DD`). */
  getGridStatsForDate(
    gridId: string,
    date: string,
  ): Promise<DailyGridStats | null>;

  /** Inclusive range of daily stats for a grid. */
  getGridStatsDailyRange(
    gridId: string,
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
