import type {
  AnalyticsEventDao,
  GridViewEndEvent,
  LogEventInput,
} from "@grids/contracts/dao";
import type { AnalyticsEventType } from "@grids/contracts/types";
import { memoryDatabase } from "./StubbedMemoryDatabase";

export class StubbedAnalyticsEventDao implements AnalyticsEventDao {
  public async logEvent<T extends AnalyticsEventType>(
    event: LogEventInput<T>,
  ): Promise<void> {
    const timestamp = new Date();
    memoryDatabase.analyticsEvents.push({
      ...event,
      timestamp,
      expiresAt: new Date(timestamp.getTime() + 90 * 24 * 60 * 60 * 1000),
    });
  }

  public logGridViewEndEventBeacon(_event: GridViewEndEvent): boolean {
    return false;
  }
}
