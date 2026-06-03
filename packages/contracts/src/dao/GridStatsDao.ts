import type { DailyGridStats, GridStats } from "../types/Analytics.js";

/**
 * Read-only DAO for the `gridStats` collection.
 *
 * Only Cloud Functions write to `gridStats` (via the admin SDK in
 * `functions/`); clients are read-only per security rules.
 */
export interface GridStatsDao {
  /** Lifetime aggregate doc for a grid. Returns `null` if no stats yet. */
  getAggregate(gridId: string): Promise<GridStats | null>;

  /** Daily doc for a grid on a UTC date (`YYYY-MM-DD`). */
  getDaily(gridId: string, date: string): Promise<DailyGridStats | null>;

  /** Inclusive range of daily docs between two UTC dates (`YYYY-MM-DD`). */
  getDailyRange(
    gridId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyGridStats[]>;
}
