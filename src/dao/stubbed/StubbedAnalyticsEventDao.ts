import type {
  AnalyticsEventDao,
  LogEventInput,
} from "@/dao/interfaces/AnalyticsEventDao";
import type { AnalyticsEventType } from "@/types/Analytics";

export class StubbedAnalyticsEventDao implements AnalyticsEventDao {
  public logEvent<T extends AnalyticsEventType>(
    _event: LogEventInput<T>,
  ): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }
}
