import type { BusinessStats, DailyBusinessStats } from "@/types/Analytics";

/**
 * Read-only DAO for the `businessStats` collection.
 *
 * Only Cloud Functions write to `businessStats` (via the admin SDK in
 * `functions/`); clients are read-only and access is gated to admins per
 * security rules.
 */
export interface BusinessStatsDao {
  /** Global lifetime aggregate doc (id `global`). Returns `null` if missing. */
  getAggregate(): Promise<BusinessStats | null>;

  /** Daily doc for a UTC date (`YYYY-MM-DD`). */
  getDaily(date: string): Promise<DailyBusinessStats | null>;

  /** Inclusive range of daily docs between two UTC dates (`YYYY-MM-DD`). */
  getDailyRange(
    startDate: string,
    endDate: string,
  ): Promise<DailyBusinessStats[]>;
}
