import type { ContentType } from "@/types/TileContent";

/**
 * Discriminator values for `analyticsEvents.eventType`.
 *
 * Client-originated events are written directly from the browser; server-only
 * events are written by Cloud Functions via the admin SDK and must be excluded
 * from the client-allowed set in Firestore security rules.
 */
export enum AnalyticsEventType {
  // Client-originated
  GRID_VIEW = "grid_view",
  GRID_VIEW_END = "grid_view_end",
  TILE_ADDED = "tile_added",
  TILE_REMOVED = "tile_removed",
  OWNER_GRID_ENTER = "owner_grid_enter",
  // Server-originated (Cloud Functions only)
  GRID_CREATED = "grid_created",
  GRID_DELETED = "grid_deleted",
  USER_SIGNUP = "user_signup",
  USER_LOGIN = "user_login",
}

export type ViewerType = "authenticated" | "anonymous";

/** Per-event metadata shapes, keyed by `AnalyticsEventType`. */
export interface AnalyticsEventMetadataMap {
  [AnalyticsEventType.GRID_VIEW]: {
    viewerType: ViewerType;
    sessionId: string;
    viewerFingerprint: string;
  };
  [AnalyticsEventType.GRID_VIEW_END]: {
    sessionId: string;
    durationMs: number;
  };
  [AnalyticsEventType.TILE_ADDED]: {
    tileType: ContentType;
    tileId: string;
  };
  [AnalyticsEventType.TILE_REMOVED]: {
    tileType: ContentType;
    tileId: string;
  };
  [AnalyticsEventType.OWNER_GRID_ENTER]: Record<string, never>;
  [AnalyticsEventType.GRID_CREATED]: { gridName: string };
  [AnalyticsEventType.GRID_DELETED]: { gridName: string };
  [AnalyticsEventType.USER_SIGNUP]: { signInMethod: string };
  [AnalyticsEventType.USER_LOGIN]: { signInMethod: string };
}

/**
 * One document in the `analyticsEvents` collection.
 *
 * `timestamp` and `expiresAt` are pinned to server time by security rules
 * (`request.time` and `request.time + 90d`). The TTL policy is configured on
 * `expiresAt` so Firestore garbage-collects expired docs automatically.
 */
export interface AnalyticsEvent<
  T extends AnalyticsEventType = AnalyticsEventType,
> {
  eventType: T;
  timestamp: Date;
  expiresAt: Date;
  userId: string | null;
  layoutId: string | null;
  metadata: AnalyticsEventMetadataMap[T];
}

/** Aggregate document in `gridStats` (doc id = `{layoutId}`). */
export interface GridStats {
  layoutId: string;
  ownerId: string;
  totalViews: number;
  uniqueViewers: number;
  authenticatedViews: number;
  anonymousViews: number;
  totalTimeSpentMs: number;
  totalSessions: number;
  averageTimeSpentMs: number;
  updatedAt: Date;
}

/** Daily document in `gridStats` (doc id = `{layoutId}__{YYYY-MM-DD}`). */
export interface DailyGridStats extends GridStats {
  /** UTC date in `YYYY-MM-DD` format. */
  date: string;
}

/** Aggregate document in `businessStats` (doc id = `global`). */
export interface BusinessStats {
  totalGridsCreated: number;
  totalGridsDeleted: number;
  activeGrids: number;
  totalUsers: number;
  totalLogins: number;
  totalOwnerEdits: number;
  /** Map of `ContentType` → count. */
  tileAdds: Record<string, number>;
  /** Map of `ContentType` → count. */
  tileDeletes: Record<string, number>;
  updatedAt: Date;
}

/** Daily document in `businessStats` (doc id = `daily__{YYYY-MM-DD}`). */
export interface DailyBusinessStats extends BusinessStats {
  /** UTC date in `YYYY-MM-DD` format. */
  date: string;
}
