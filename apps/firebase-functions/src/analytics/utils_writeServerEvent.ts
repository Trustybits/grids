import admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const ANALYTICS_EVENTS_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type ServerAnalyticsEventType =
  | "user_signup"
  | "user_login"
  | "grid_created"
  | "grid_deleted"
  | "grid_view_end";

interface WriteServerEventArgs {
  eventType: ServerAnalyticsEventType;
  userId: string | null;
  gridId: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Writes a server-originated event into `analyticsEvents`. Failures are logged
 * but never thrown — analytics writes must not break the caller's primary work
 * (notifications, default-grid assignment, etc.).
 */
export async function writeServerAnalyticsEvent({
  eventType,
  userId,
  gridId,
  metadata,
}: WriteServerEventArgs): Promise<void> {
  try {
    const expiresAt = Timestamp.fromMillis(Date.now() + ANALYTICS_EVENTS_TTL_MS);
    await admin.firestore().collection("analyticsEvents").add({
      eventType,
      timestamp: FieldValue.serverTimestamp(),
      expiresAt,
      userId,
      gridId,
      metadata,
    });
  } catch (error) {
    logger.error("Failed to write server analytics event", {
      eventType,
      userId,
      gridId,
      error: String(error),
    });
  }
}
