import posthog from "posthog-js";
import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type {
  AnalyticsEventDao,
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

  async getGridStats(layoutId: string): Promise<GridStats | null> {
    try {
      return await this.gridStatsDao.getAggregate(layoutId);
    } catch (error) {
      console.error("Error fetching grid stats:", error);
      throw error;
    }
  }

  async getGridStatsForDate(
    layoutId: string,
    date: string,
  ): Promise<DailyGridStats | null> {
    try {
      return await this.gridStatsDao.getDaily(layoutId, date);
    } catch (error) {
      console.error("Error fetching daily grid stats:", error);
      throw error;
    }
  }

  async getGridStatsDailyRange(
    layoutId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyGridStats[]> {
    try {
      return await this.gridStatsDao.getDailyRange(
        layoutId,
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
        layoutId: event.layoutId,
        userId: event.userId,
        ...event.metadata,
      });
    } catch (error) {
      console.error("Failed to mirror event to PostHog:", error);
    }
  }
}
