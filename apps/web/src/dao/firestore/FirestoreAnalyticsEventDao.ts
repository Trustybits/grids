import {
  type Firestore,
  Timestamp,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import type {
  AnalyticsEventDao,
  GridViewEndEvent,
  LogEventInput,
} from "@/dao/interfaces/AnalyticsEventDao";
import type { AnalyticsEventType } from "@/types/Analytics";

const COLLECTION = "analyticsEvents";
const TTL_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

let warnedAboutMissingBeaconUrl = false;

export class FirestoreAnalyticsEventDao implements AnalyticsEventDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async logEvent<T extends AnalyticsEventType>(
    event: LogEventInput<T>,
  ): Promise<void> {
    // `timestamp` is set server-side via serverTimestamp(); security rules
    // pin it to request.time and require expiresAt = request.time + 90d.
    // We compute expiresAt client-side from approximate now — the rules
    // validate it's within tolerance of request.time + 90d.
    const expiresAt = Timestamp.fromMillis(Date.now() + TTL_DAYS * MS_PER_DAY);

    await addDoc(collection(this.db, COLLECTION), {
      eventType: event.eventType,
      userId: event.userId,
      layoutId: event.layoutId,
      metadata: event.metadata,
      timestamp: serverTimestamp(),
      expiresAt,
    });
  }

  public logGridViewEndEventBeacon(event: GridViewEndEvent): boolean {
    if (typeof navigator === "undefined" || !navigator.sendBeacon) return false;
    if (!event.layoutId) return false;

    const url = import.meta.env.VITE_VIEW_END_ANALYTICS_BEACON_URL;
    if (!url) {
      if (!warnedAboutMissingBeaconUrl) {
        warnedAboutMissingBeaconUrl = true;
        console.warn(
          "VITE_VIEW_END_ANALYTICS_BEACON_URL is not set — grid_view_end events on tab close/background will not be recorded.",
        );
      }
      return false;
    }

    const payload = {
      layoutId: event.layoutId,
      userId: event.userId,
      sessionId: event.metadata.sessionId,
      durationMs: event.metadata.durationMs,
    };

    try {
      // text/plain avoids a CORS preflight; the CF parses JSON from the body.
      const blob = new Blob([JSON.stringify(payload)], { type: "text/plain" });
      return navigator.sendBeacon(url, blob);
    } catch {
      return false;
    }
  }
}
