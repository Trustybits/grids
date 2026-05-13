import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import { isSafeFirestoreDocId } from "./utils_analytics";

const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const TTL_MS = 90 * 24 * 60 * 60 * 1000;

// ── Event type constants ────────────────────────────────────────────────
// Mirror of the AnalyticsEventType enum in src/types/Analytics.ts. Kept as a
// small string-literal set here because functions/ has its own tsconfig and
// can't import from the app's src/.

const EVENT = {
  GRID_VIEW: "grid_view",
  GRID_VIEW_END: "grid_view_end",
  TILE_ADDED: "tile_added",
  TILE_REMOVED: "tile_removed",
  OWNER_GRID_ENTER: "owner_grid_enter",
  GRID_CREATED: "grid_created",
  GRID_DELETED: "grid_deleted",
  USER_SIGNUP: "user_signup",
  USER_LOGIN: "user_login",
} as const;

type EventType = (typeof EVENT)[keyof typeof EVENT];

interface AnalyticsEventDoc {
  eventType: EventType;
  timestamp: FirebaseFirestore.Timestamp;
  userId: string | null;
  layoutId: string | null;
  metadata: Record<string, unknown>;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** UTC date in YYYY-MM-DD for a Firestore Timestamp. */
function toUtcDateString(ts: FirebaseFirestore.Timestamp): string {
  return ts.toDate().toISOString().slice(0, 10);
}

function gridDailyId(layoutId: string, date: string): string {
  return `${layoutId}__${date}`;
}

function businessDailyId(date: string): string {
  return `daily__${date}`;
}

/**
 * Look up the layout owner for first-time creation of a gridStats doc. Returns
 * null if the layout no longer exists (e.g. deleted before the trigger fired).
 */
async function getOwnerId(
  db: FirebaseFirestore.Firestore,
  layoutId: string,
): Promise<string | null> {
  const snap = await db.collection("layouts").doc(layoutId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return (data?.userId as string) ?? null;
}

// ── Per-event handlers ──────────────────────────────────────────────────

async function handleGridView(
  db: FirebaseFirestore.Firestore,
  event: AnalyticsEventDoc,
): Promise<void> {
  const { layoutId, metadata } = event;
  if (!layoutId) {
    logger.warn("grid_view event missing layoutId");
    return;
  }
  if (!isSafeFirestoreDocId(layoutId)) {
    logger.warn("grid_view event has invalid layoutId", { layoutId });
    return;
  }

  const viewerType = metadata?.viewerType as
    | "authenticated"
    | "anonymous"
    | undefined;
  const viewerFingerprint = metadata?.viewerFingerprint as string | undefined;
  if (viewerFingerprint && !isSafeFirestoreDocId(viewerFingerprint)) {
    logger.warn("grid_view event has invalid viewerFingerprint", { layoutId });
    return;
  }
  const date = toUtcDateString(event.timestamp);

  const ownerId = await getOwnerId(db, layoutId);

  // Build the per-view counter delta.
  const viewDelta: Record<string, unknown> = {
    layoutId,
    totalViews: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (ownerId) viewDelta.ownerId = ownerId;
  if (viewerType === "authenticated") {
    viewDelta.authenticatedViews = FieldValue.increment(1);
  } else if (viewerType === "anonymous") {
    viewDelta.anonymousViews = FieldValue.increment(1);
  }

  const aggregateRef = db.collection("gridStats").doc(layoutId);
  const dailyRef = db.collection("gridStats").doc(gridDailyId(layoutId, date));

  const batch = db.batch();
  batch.set(aggregateRef, viewDelta, { merge: true });
  batch.set(dailyRef, { ...viewDelta, date }, { merge: true });

  // Business stats: count this view at the platform level too. (Optional —
  // omit if you'd rather keep businessStats focused on creator/owner actions.)
  // Currently no business-stats field tracks views; skipping until you add one.

  await batch.commit();

  // Unique-viewer dedup. A single marker doc per fingerprint lives under the
  // lifetime aggregate. If the marker is created (didn't exist before), this
  // viewer is a brand-new lifetime visitor — bump uniqueViewers on the
  // aggregate AND bump uniqueViewers on today's daily doc, which we interpret
  // as "new unique viewers today" (i.e. first-time visitors today).
  if (viewerFingerprint) {
    await maybeIncrementUnique(db, aggregateRef, dailyRef, viewerFingerprint);
  }
}

/**
 * Atomically: if the lifetime marker doesn't exist, create it and increment
 * `uniqueViewers` on both the aggregate doc (lifetime uniques) and the daily
 * doc (new uniques today). If the marker already exists, no-op.
 */
async function maybeIncrementUnique(
  db: FirebaseFirestore.Firestore,
  aggregateRef: FirebaseFirestore.DocumentReference,
  dailyRef: FirebaseFirestore.DocumentReference,
  fingerprint: string,
): Promise<void> {
  const markerRef = aggregateRef.collection("viewers").doc(fingerprint);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(markerRef);
    if (existing.exists) return;
    tx.set(markerRef, { firstSeenAt: FieldValue.serverTimestamp() });
    tx.set(
      aggregateRef,
      { uniqueViewers: FieldValue.increment(1) },
      { merge: true },
    );
    tx.set(
      dailyRef,
      { uniqueViewers: FieldValue.increment(1) },
      { merge: true },
    );
  });
}

async function handleGridViewEnd(
  db: FirebaseFirestore.Firestore,
  event: AnalyticsEventDoc,
): Promise<void> {
  const { layoutId, metadata } = event;
  if (!layoutId) {
    logger.warn("grid_view_end event missing layoutId");
    return;
  }
  if (!isSafeFirestoreDocId(layoutId)) {
    logger.warn("grid_view_end event has invalid layoutId", { layoutId });
    return;
  }
  const sessionId = metadata?.sessionId;
  if (!sessionId) {
    logger.warn("grid_view_end event missing sessionId", { layoutId });
    return;
  }
  if (!isSafeFirestoreDocId(sessionId)) {
    logger.warn("grid_view_end event has invalid sessionId", {
      layoutId,
      sessionId,
    });
    return;
  }
  const durationMs = Number(metadata?.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    logger.warn("grid_view_end event has invalid durationMs", {
      layoutId,
      durationMs,
    });
    return;
  }

  // Gate on the layout existing. If the grid has been deleted between the
  // view start and view end, skip aggregation entirely — writing without an
  // ownerId would produce a stats doc the owner can't read (security rules
  // gate on resource.data.ownerId), and there's no owner to attribute it to.
  const ownerId = await getOwnerId(db, layoutId);
  if (!ownerId) {
    logger.warn("grid_view_end skipped: layout no longer exists", { layoutId });
    return;
  }

  const date = toUtcDateString(event.timestamp);
  const aggregateRef = db.collection("gridStats").doc(layoutId);
  const dailyRef = db.collection("gridStats").doc(gridDailyId(layoutId, date));
  const sessionMarkerRef = aggregateRef
    .collection("endedSessions")
    .doc(sessionId);

  // Idempotency + read-modify-write across multiple docs must all live in one
  // transaction. The session marker doc gates aggregation: if it already
  // exists, this grid_view_end has been processed before (the trigger can
  // fire multiple times for the same source event, or the client can resend)
  // and we skip. If it doesn't exist, we create it AND apply the aggregate +
  // daily updates atomically — so a Firebase retry after a partial failure
  // can't double-apply durationMs / totalSessions to the side that already
  // committed.
  await db.runTransaction(async (tx) => {
    const [markerSnap, aggSnap, dailySnap] = await Promise.all([
      tx.get(sessionMarkerRef),
      tx.get(aggregateRef),
      tx.get(dailyRef),
    ]);

    if (markerSnap.exists) {
      logger.info("grid_view_end skipped: session already aggregated", {
        layoutId,
        sessionId,
      });
      return;
    }

    const expiresAt = Timestamp.fromMillis(event.timestamp.toMillis() + TTL_MS);
    tx.set(sessionMarkerRef, {
      sessionId,
      durationMs,
      endedAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    const aggPrev = aggSnap.exists ? (aggSnap.data() ?? {}) : {};
    const dailyPrev = dailySnap.exists ? (dailySnap.data() ?? {}) : {};

    const aggTotalTime = (aggPrev.totalTimeSpentMs ?? 0) + durationMs;
    const aggSessions = (aggPrev.totalSessions ?? 0) + 1;
    const dailyTotalTime = (dailyPrev.totalTimeSpentMs ?? 0) + durationMs;
    const dailySessions = (dailyPrev.totalSessions ?? 0) + 1;

    tx.set(
      aggregateRef,
      {
        layoutId,
        ownerId,
        totalTimeSpentMs: aggTotalTime,
        totalSessions: aggSessions,
        averageTimeSpentMs: Math.round(aggTotalTime / aggSessions),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(
      dailyRef,
      {
        layoutId,
        ownerId,
        date,
        totalTimeSpentMs: dailyTotalTime,
        totalSessions: dailySessions,
        averageTimeSpentMs: Math.round(dailyTotalTime / dailySessions),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

async function handleTileChange(
  db: FirebaseFirestore.Firestore,
  event: AnalyticsEventDoc,
  field: "tileAdds" | "tileDeletes",
): Promise<void> {
  const tileType = event.metadata?.tileType as string | undefined;
  if (!tileType) {
    logger.warn(`${event.eventType} event missing tileType`);
    return;
  }
  const date = toUtcDateString(event.timestamp);

  const update = {
    [`${field}.${tileType}`]: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await applyBusinessStats(db, date, update);
}

async function handleGridCreated(
  db: FirebaseFirestore.Firestore,
  event: AnalyticsEventDoc,
): Promise<void> {
  const date = toUtcDateString(event.timestamp);
  await applyBusinessStats(db, date, {
    totalGridsCreated: FieldValue.increment(1),
    activeGrids: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function handleGridDeleted(
  db: FirebaseFirestore.Firestore,
  event: AnalyticsEventDoc,
): Promise<void> {
  const date = toUtcDateString(event.timestamp);
  await applyBusinessStats(db, date, {
    totalGridsDeleted: FieldValue.increment(1),
    activeGrids: FieldValue.increment(-1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function handleUserSignup(
  db: FirebaseFirestore.Firestore,
  event: AnalyticsEventDoc,
): Promise<void> {
  const date = toUtcDateString(event.timestamp);
  await applyBusinessStats(db, date, {
    totalUsers: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function handleUserLogin(
  db: FirebaseFirestore.Firestore,
  event: AnalyticsEventDoc,
): Promise<void> {
  const date = toUtcDateString(event.timestamp);
  await applyBusinessStats(db, date, {
    totalLogins: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function handleOwnerGridEnter(
  db: FirebaseFirestore.Firestore,
  event: AnalyticsEventDoc,
): Promise<void> {
  const date = toUtcDateString(event.timestamp);
  await applyBusinessStats(db, date, {
    totalOwnerVisits: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Applies the same delta to both the global businessStats aggregate doc and
 * the daily doc for the event's date.
 */
async function applyBusinessStats(
  db: FirebaseFirestore.Firestore,
  date: string,
  delta: Record<string, unknown>,
): Promise<void> {
  const aggregateRef = db.collection("businessStats").doc("global");
  const dailyRef = db.collection("businessStats").doc(businessDailyId(date));

  const batch = db.batch();
  batch.set(aggregateRef, delta, { merge: true });
  batch.set(dailyRef, { ...delta, date }, { merge: true });
  await batch.commit();
}

// ── Trigger ─────────────────────────────────────────────────────────────

export const onAnalyticsEventCreated = functions.firestore
  .document("analyticsEvents/{docId}")
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data() as Partial<AnalyticsEventDoc> | undefined;
    if (!data || !data.eventType || !data.timestamp) {
      logger.warn("Malformed analytics event", { docId: context.params.docId });
      return null;
    }
    const event = data as AnalyticsEventDoc;
    const db = admin.firestore();

    try {
      switch (event.eventType) {
        case EVENT.GRID_VIEW:
          await handleGridView(db, event);
          break;
        case EVENT.GRID_VIEW_END:
          await handleGridViewEnd(db, event);
          break;
        case EVENT.TILE_ADDED:
          await handleTileChange(db, event, "tileAdds");
          break;
        case EVENT.TILE_REMOVED:
          await handleTileChange(db, event, "tileDeletes");
          break;
        case EVENT.OWNER_GRID_ENTER:
          await handleOwnerGridEnter(db, event);
          break;
        case EVENT.GRID_CREATED:
          await handleGridCreated(db, event);
          break;
        case EVENT.GRID_DELETED:
          await handleGridDeleted(db, event);
          break;
        case EVENT.USER_SIGNUP:
          await handleUserSignup(db, event);
          break;
        case EVENT.USER_LOGIN:
          await handleUserLogin(db, event);
          break;
        default:
          logger.warn("Unknown analytics eventType", {
            eventType: (event as { eventType: string }).eventType,
          });
      }
    } catch (error) {
      logger.error("Failed to aggregate analytics event", {
        docId: context.params.docId,
        eventType: event.eventType,
        error,
      });
      // Re-throw so Firebase retries on transient failures.
      throw error;
    }

    return null;
  });
