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
  gridId: string | null;
  metadata: AnalyticsEventMetadataMap[T];
}

/**
 * Write-only DAO for the `analyticsEvents` collection.
 *
 * Clients cannot read `analyticsEvents` per security rules — aggregation runs
 * server-side in a Cloud Function via the admin SDK, so no query methods
 * belong on this interface.
 */
export type GridViewEndEvent = LogEventInput<AnalyticsEventType.GRID_VIEW_END>;

export interface AnalyticsEventDao {
  /** Append a single event to `analyticsEvents`. */
  logEvent<T extends AnalyticsEventType>(
    event: LogEventInput<T>,
  ): Promise<void>;

  /**
   * Synchronously enqueue a `grid_view_end` event via `navigator.sendBeacon`
   * to a Cloud Function HTTP endpoint. Used on `visibilitychange → hidden` and
   * `pagehide` where the page may be tearing down and a Firestore client write
   * isn't reliable. Returns `true` if the browser accepted the beacon for
   * delivery, `false` otherwise (no-op in stubbed/SSR contexts, or when the
   * beacon URL isn't configured).
   */
  logGridViewEndEventBeacon(event: GridViewEndEvent): boolean;
}
