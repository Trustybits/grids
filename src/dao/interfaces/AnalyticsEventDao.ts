import type {
  AnalyticsEventType,
  AnalyticsEventMetadataMap,
} from "@/types/Analytics";

/**
 * Payload accepted by `logEvent`. `timestamp` and `expiresAt` are set
 * server-side via Firestore security rules, so callers do not provide them.
 */
export interface LogEventInput<
  T extends AnalyticsEventType = AnalyticsEventType,
> {
  eventType: T;
  userId: string | null;
  layoutId: string | null;
  metadata: AnalyticsEventMetadataMap[T];
}

/**
 * Write-only DAO for the `analyticsEvents` collection.
 *
 * Clients cannot read `analyticsEvents` per security rules — aggregation runs
 * server-side in a Cloud Function via the admin SDK, so no query methods
 * belong on this interface.
 */
export interface AnalyticsEventDao {
  /** Append a single event to `analyticsEvents`. */
  logEvent<T extends AnalyticsEventType>(event: LogEventInput<T>): Promise<void>;
}
