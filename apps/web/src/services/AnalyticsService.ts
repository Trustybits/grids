import posthog from "posthog-js";
import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type {
  AnalyticsEventDao,
  GridViewEndEvent,
  LogEventInput,
} from "@/dao/interfaces/AnalyticsEventDao";
import type { BusinessStatsDao } from "@/dao/interfaces/BusinessStatsDao";
import type { GridStatsDao } from "@/dao/interfaces/GridStatsDao";
import type {
  AnalyticsEventType,
  BusinessStats,
  DailyBusinessStats,
  DailyGridStats,
  GridStats,
} from "@/types/Analytics";
import type { IAnalyticsService } from "./interfaces/IAnalyticsService";

export class AnalyticsService implements IAnalyticsService {
  private analyticsEventDao: AnalyticsEventDao;
  private gridStatsDao: GridStatsDao;
  private businessStatsDao: BusinessStatsDao;

  constructor() {
    const factory = getDaoFactory();
    this.analyticsEventDao = factory.getAnalyticsEventDao();
    this.gridStatsDao = factory.getGridStatsDao();
    this.businessStatsDao = factory.getBusinessStatsDao();
  }

  async logEvent<T extends AnalyticsEventType>(
    event: LogEventInput<T>,
  ): Promise<void> {
    // Mirror to PostHog first — it's a fire-and-forget local call, so it can't
    // block or fail the Firestore write.
    this.captureToPostHog(event);

    try {
      await this.analyticsEventDao.logEvent(event);
    } catch (error) {
      // Analytics failures should never break the user-facing flow that
      // triggered the event (a tile add, a page view, etc.). Log and swallow.
      console.error("Failed to log analytics event:", event.eventType, error);
    }
  }

  logGridViewEndEventBeacon(event: GridViewEndEvent): boolean {
    // Mirror to PostHog first — same pattern as logEvent. PostHog's own
    // capture is local/queued, so it survives page teardown without a beacon.
    this.captureToPostHog(event);
    try {
      return this.analyticsEventDao.logGridViewEndEventBeacon(event);
    } catch (error) {
      console.error("Failed to send analytics beacon:", error);
      return false;
    }
  }

  async getGridStats(gridId: string): Promise<GridStats | null> {
    try {
      return await this.gridStatsDao.getAggregate(gridId);
    } catch (error) {
      console.error("Error fetching grid stats:", error);
      throw error;
    }
  }

  async getGridStatsForDate(
    gridId: string,
    date: string,
  ): Promise<DailyGridStats | null> {
    try {
      return await this.gridStatsDao.getDaily(gridId, date);
    } catch (error) {
      console.error("Error fetching daily grid stats:", error);
      throw error;
    }
  }

  async getGridStatsDailyRange(
    gridId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyGridStats[]> {
    try {
      return await this.gridStatsDao.getDailyRange(
        gridId,
        startDate,
        endDate,
      );
    } catch (error) {
      console.error("Error fetching grid stats range:", error);
      throw error;
    }
  }

  async getBusinessStats(): Promise<BusinessStats | null> {
    try {
      return await this.businessStatsDao.getAggregate();
    } catch (error) {
      console.error("Error fetching business stats:", error);
      throw error;
    }
  }

  async getBusinessStatsDailyRange(
    startDate: string,
    endDate: string,
  ): Promise<DailyBusinessStats[]> {
    try {
      return await this.businessStatsDao.getDailyRange(startDate, endDate);
    } catch (error) {
      console.error("Error fetching business stats range:", error);
      throw error;
    }
  }

  private captureToPostHog<T extends AnalyticsEventType>(
    event: LogEventInput<T>,
  ): void {
    if (!import.meta.env.VITE_POSTHOG_KEY) return;
    try {
      posthog.capture(event.eventType, {
        gridId: event.gridId,
        userId: event.userId,
        ...event.metadata,
      });
    } catch (error) {
      console.error("Failed to mirror event to PostHog:", error);
    }
  }
}
