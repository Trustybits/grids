import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import { createHash } from "node:crypto";
import { isSafeFirestoreDocId } from "./AnalyticsUtils";
import { writeServerAnalyticsEvent } from "./writeServerEvent";

const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const MAX_DURATION_MS = 24 * 60 * 60 * 1000; // sanity cap: 24h
const MAX_BODY_BYTES = 2048; // payload is tiny; reject anything larger
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_PER_WINDOW = 20; // per IP + layoutId per minute
const RATE_LIMIT_TTL_MS = 24 * 60 * 60 * 1000; // 1 day for the rate limit ttl

interface BeaconPayload {
  layoutId: string;
  userId: string | null;
  sessionId: string;
  durationMs: number;
}

/**
 * Parse the request body. `navigator.sendBeacon` typically sends the payload
 * as a Blob with type `application/json`, but Firebase v1 onRequest already
 * runs body-parser, so JSON arrives as `req.body` (object) and text/plain
 * arrives as a string we still need to JSON.parse.
 */
function parseBody(body: unknown): unknown {
  if (body == null) return null;
  if (typeof body === "string") {
    if (body.length === 0) return null;
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(body)) {
    const text = body.toString("utf8");
    if (text.length === 0) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (typeof body === "object") return body;
  return null;
}

/**
 * Best-effort byte-size of an already-parsed body. Express's body-parser may
 * have decoded the request before we see it; we reconstruct an upper bound
 * by re-serializing. Falls back to Content-Length when present.
 */
function bodyByteSize(req: functions.https.Request): number {
  const headerLen = Number(req.headers["content-length"]);
  if (Number.isFinite(headerLen) && headerLen > 0) return headerLen;

  const body = req.body;
  if (body == null) return 0;
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  if (Buffer.isBuffer(body)) return body.length;
  try {
    return Buffer.byteLength(JSON.stringify(body), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function validate(raw: unknown): BeaconPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const layoutId = obj.layoutId;
  if (!isSafeFirestoreDocId(layoutId)) return null;

  const sessionId = obj.sessionId;
  if (!isSafeFirestoreDocId(sessionId)) return null;

  const durationMs = Number(obj.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  if (durationMs > MAX_DURATION_MS) return null;

  let userId: string | null = null;
  if (typeof obj.userId === "string" && obj.userId.length > 0) {
    userId = obj.userId;
  } else if (obj.userId != null && obj.userId !== "") {
    return null;
  }

  return {
    layoutId,
    userId,
    sessionId,
    durationMs: Math.round(durationMs),
  };
}

/**
 * Pull the client IP from the platform-populated request field. Only fall back
 * to X-Forwarded-For when req.ip is unavailable, since user-supplied XFF can be
 * spoofed on public endpoints.
 */
function getClientIp(req: functions.https.Request): string {
  if (req.ip) return req.ip;

  const fwd = req.headers["x-forwarded-for"];
  const fwdStr = Array.isArray(fwd) ? fwd[0] : fwd;
  if (typeof fwdStr === "string" && fwdStr.length > 0) {
    const first = fwdStr.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * Hash the IP+layoutId tuple so rate-limit doc IDs stay compact, path-safe, and
 * collision-resistant without exposing client IPs in document paths.
 */
function rateLimitKey(ip: string, layoutId: string): string {
  return createHash("sha256").update(`${ip}\0${layoutId}`).digest("hex");
}

/**
 * Fixed-window rate limiter keyed on (ip, layoutId). Returns true if the
 * request is allowed, false if it should be rejected. Best-effort — on a
 * Firestore error we fail open and log.
 */
async function checkRateLimit(
  db: FirebaseFirestore.Firestore,
  ip: string,
  layoutId: string,
): Promise<boolean> {
  const ref = db
    .collection("rateLimits")
    .doc("trackGridViewEndBeacon")
    .collection("gridViewEndEntries")
    .doc(rateLimitKey(ip, layoutId));

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const data = snap.exists ? snap.data() : undefined;
      const windowStart = Number(data?.windowStart) || 0;
      const count = Number(data?.count) || 0;

      if (!snap.exists || now - windowStart >= RATE_LIMIT_WINDOW_MS) {
        tx.set(ref, {
          windowStart: now,
          count: 1,
          updatedAt: FieldValue.serverTimestamp(),
          expiresAt: Timestamp.fromMillis(now + RATE_LIMIT_TTL_MS),
        });
        return true;
      }

      if (count >= RATE_LIMIT_MAX_PER_WINDOW) return false;

      tx.update(ref, {
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + RATE_LIMIT_TTL_MS),
      });
      return true;
    });
  } catch (error) {
    logger.error("trackGridViewEndBeacon: rate limit check failed", { error });
    return true; // fail open
  }
}

/**
 * sendBeacon endpoint for `grid_view_end`. The frontend's `useAnalytics()`
 * composable posts here on `beforeunload` / page hide because client Firestore
 * writes aren't reliable during page teardown. The handler validates the
 * payload and writes a `grid_view_end` document into `analyticsEvents`; the
 * `onAnalyticsEventCreated` trigger then handles aggregation.
 */
export const trackGridViewEndBeacon = functions.https.onRequest(
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (bodyByteSize(req) > MAX_BODY_BYTES) {
      logger.warn("trackGridViewEndBeacon: payload too large");
      res.status(413).json({ error: "Payload too large" });
      return;
    }

    const parsed = parseBody(req.body);
    const payload = validate(parsed);
    if (!payload) {
      logger.warn("trackGridViewEndBeacon: invalid payload");
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const db = admin.firestore();

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(db, ip, payload.layoutId);
    if (!allowed) {
      logger.warn("trackGridViewEndBeacon: rate limit exceeded", {
        ip,
        layoutId: payload.layoutId,
      });
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    // Idempotency short-circuit: if the aggregation function has already
    // processed this session (marker doc exists), skip the write entirely.
    // Avoids piling up duplicate analyticsEvents docs when the browser fires
    // both visibilitychange-driven and unload-driven beacons for the same
    // session. The aggregation transaction is the source of truth — this is
    // an optimization, not a correctness gate.
    const sessionMarkerRef = db
      .collection("gridStats")
      .doc(payload.layoutId)
      .collection("endedSessions")
      .doc(payload.sessionId);

    try {
      const markerSnap = await sessionMarkerRef.get();
      if (markerSnap.exists) {
        logger.info("trackGridViewEndBeacon: session already ended, skipping", {
          layoutId: payload.layoutId,
          sessionId: payload.sessionId,
        });
        res.status(204).send("");
        return;
      }
    } catch (error) {
      logger.error(
        "trackGridViewEndBeacon: failed to check session marker",
        { error },
      );
      res.status(500).json({ error: "Failed to record event" });
      return;
    }

    await writeServerAnalyticsEvent({
      eventType: "grid_view_end",
      userId: payload.userId,
      layoutId: payload.layoutId,
      metadata: {
        sessionId: payload.sessionId,
        durationMs: payload.durationMs,
      },
    });

    res.status(204).send("");
  },
);
