import * as logger from "firebase-functions/logger";
import admin from "../admin.js";

const X_CACHE_COLLECTION = "xCache";
// How long one caller may hold a refresh before another caller can take over.
const REFRESH_LEASE_MS = 60 * 1000;
// After a failed refresh, serve the stored copy this long before asking X again.
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;

interface XCacheEntry<T> {
  data?: T;
  // Until this time, nobody else refreshes the entry: either a refresh is in
  // flight, or the last one failed.
  retryAfter?: number;
}

export interface XCacheRequest<T extends { fetchedAt: number }> {
  key: string;
  refreshAfterMs: (data: T) => number;
  // Signed-in callers may fill an empty entry. Anonymous grid visitors may
  // only refresh entries that already exist, so they can't use this as a
  // general-purpose proxy to X.
  canSeed: boolean;
  load: () => Promise<T>;
}

/**
 * Serve X data from a shared cache, refreshing it from X once it's older than
 * `refreshAfterMs`. Each entry is refreshed by one caller at a time; everyone
 * else gets the stored copy. Returns null when an anonymous caller asks for an
 * entry nobody has filled yet.
 */
export async function readThroughXCache<T extends { fetchedAt: number }>(
  request: XCacheRequest<T>,
): Promise<T | null> {
  const db = admin.firestore();
  const ref = db.collection(X_CACHE_COLLECTION).doc(request.key);
  const now = Date.now();

  let stored: T | undefined;
  try {
    const claim = await db.runTransaction(async (tx) => {
      const entry = (await tx.get(ref)).data() as XCacheEntry<T> | undefined;
      const data = entry?.data;
      if (data && now - data.fetchedAt < request.refreshAfterMs(data)) {
        return { data, shouldLoad: false };
      }
      const isClaimed = (entry?.retryAfter ?? 0) > now;
      const shouldLoad = data ? !isClaimed : request.canSeed;
      if (shouldLoad) {
        tx.set(ref, { retryAfter: now + REFRESH_LEASE_MS }, { merge: true });
      }
      return { data, shouldLoad };
    });
    if (!claim.shouldLoad) return claim.data ?? null;
    stored = claim.data;
  } catch (error: unknown) {
    logger.warn("X cache read failed", { error: String(error), key: request.key });
    if (!request.canSeed) return null;
  }

  let fresh: T;
  try {
    fresh = await request.load();
  } catch (error: unknown) {
    await ref
      .set({ retryAfter: Date.now() + RETRY_AFTER_FAILURE_MS }, { merge: true })
      .catch(() => undefined);
    if (stored) return stored;
    throw error;
  }

  try {
    // Snapshots are plain JSON; the round trip drops undefined fields, which
    // Firestore rejects.
    await ref.set({ data: JSON.parse(JSON.stringify(fresh)) as T });
  } catch (error: unknown) {
    logger.warn("X cache write failed", { error: String(error), key: request.key });
  }
  return fresh;
}
