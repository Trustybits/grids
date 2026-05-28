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
} from "@grids/contracts/dao";
import type { AnalyticsEventType } from "@grids/contracts/types";

const COLLECTION = "analyticsEvents";
const TTL_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

let warnedAboutMissingBeaconUrl = false;

export class FirebaseAnalyticsEventDao implements AnalyticsEventDao {
  private db: Firestore;
  private beaconUrl: string | null;

  public constructor(db: Firestore, beaconUrl: string | null) {
    this.db = db;
    this.beaconUrl = beaconUrl;
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
      gridId: event.gridId,
      metadata: event.metadata,
      timestamp: serverTimestamp(),
      expiresAt,
    });
  }

  public logGridViewEndEventBeacon(event: GridViewEndEvent): boolean {
    if (typeof navigator === "undefined" || !navigator.sendBeacon) return false;
    if (!event.gridId) return false;

    const url = this.beaconUrl;
    if (!url) {
      if (!warnedAboutMissingBeaconUrl) {
        warnedAboutMissingBeaconUrl = true;
        console.warn(
          "View-end analytics beacon URL is not configured — grid_view_end events on tab close/background will not be recorded.",
        );
      }
      return false;
    }

    const payload = {
      gridId: event.gridId,
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
