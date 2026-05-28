import type {
  AnalyticsEventDao,
  GridViewEndEvent,
  LogEventInput,
} from "@grids/contracts/dao";
import type { AnalyticsEventType } from "@grids/contracts/types";

export class StubbedAnalyticsEventDao implements AnalyticsEventDao {
  public logEvent<T extends AnalyticsEventType>(
    _event: LogEventInput<T>,
  ): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public logGridViewEndEventBeacon(_event: GridViewEndEvent): boolean {
    return false;
  }
}
