import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";

/**
 * Scheduled backstop for orphaned tile subcollections.
 *
 * Tiles are not Firestore documents — they live in an array on the grid doc —
 * so a removed chat tile's `tiles/{tileId}/messages` subcollection hangs off a
 * phantom parent and is never cascaded away. Fix 1 (client deferred cleanup)
 * and Fix 2 (recursiveDelete on grid deletion) cover the common paths; this
 * weekly sweep reclaims the residual leak they can't reach: a chat tile removed
 * on a grid that is *kept*, where the client died before any flush ran.
 *
 * For every grid it reconciles the `tiles` subcollection's phantom documents
 * (returned by `listDocuments()` even though they hold no data) against the
 * grid's live tile ids, and recursively deletes any orphan that clears two
 * guards: a 24h message-age grace and a skip for actively-edited grids.
 *
 * Per-run work is bounded two ways so the job stays safe as the collection
 * grows: grids are read one cursor page at a time (never the whole collection
 * at once), and total deletions are capped. The weekly cadence + idempotency
 * mean anything deferred by either bound is simply reclaimed on the next run.
 */

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours
const ACTIVE_GRID_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Grids read per cursor page — caps peak memory for a single run. */
export const GRIDS_PAGE_SIZE = 300;
/** Max orphan tiles reclaimed per run — caps total delete work for a single run. */
export const MAX_DELETIONS_PER_RUN = 500;

/**
 * Normalize a Firestore timestamp-ish value to epoch millis. Message
 * `createdAt` is written as a plain number (`Date.now()`); grid `updatedAt` is
 * a server `Timestamp` (has `toMillis`). Returns null when the age cannot be
 * determined, so callers can conservatively skip.
 */
function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/**
 * Whether a grid is being actively edited, based on its server-stamped
 * `updatedAt`. The comparison is a relative duration (`now − updatedAt`), so it
 * is timezone-independent. A missing/unparseable `updatedAt` reads as *not*
 * active — a live session always carries a fresh server timestamp — and the
 * per-tile 24h message grace still protects recent data.
 */
function isActivelyEdited(updatedAt: unknown, now: number): boolean {
  const millis = toMillis(updatedAt);
  if (millis === null) return false;
  return now - millis < ACTIVE_GRID_WINDOW_MS;
}

export const sweepOrphanedSubcollections = functions
  // A maintenance sweep can issue many recursive deletes; give it the v1 event
  // function ceiling (9 minutes) so a full per-run budget can complete instead
  // of being killed mid-work by the default 60s timeout.
  .runWith({ timeoutSeconds: 540 })
  .pubsub
  // Weekly, Wednesday 23:00 Mountain Time. America/Denver follows DST; swap to
  // America/Phoenix for strict UTC−7 year-round. The timezone is cosmetic — it
  // only sets the wall-clock fire time and never enters the relative-duration
  // grace/active guards below.
  .schedule("0 23 * * 3")
  .timeZone("America/Denver")
  .onRun(async () => {
    if (noopIfMaintenance("sweepOrphanedSubcollections")) return null;

    const db = admin.firestore();
    const now = Date.now();
    let deleted = 0;
    let skipped = 0;
    let reachedDeletionCap = false;

    // Order by document id so the cursor is stable across pages.
    const gridsQuery = db
      .collection("grids")
      .orderBy(admin.firestore.FieldPath.documentId());

    let pageStart: FirebaseFirestore.DocumentSnapshot | null = null;

    while (!reachedDeletionCap) {
      let pageQuery = gridsQuery.limit(GRIDS_PAGE_SIZE);
      if (pageStart) pageQuery = pageQuery.startAfter(pageStart);
      const page = await pageQuery.get();
      if (page.empty) break;

      for (const gridDoc of page.docs) {
        const gridId = gridDoc.id;
        const grid = gridDoc.data();

        try {
          // Skip grids that look like a live editing session; that client owns
          // its own deferred cleanup (Fix 1) and may yet restore a removed tile.
          if (isActivelyEdited(grid.updatedAt, now)) continue;

          const tiles = Array.isArray(grid.tiles) ? grid.tiles : [];
          const liveTileIds = new Set(
            tiles.map((tile: { i?: unknown }) => tile?.i),
          );

          // listDocuments() returns refs to *missing* tile docs that still have
          // subcollections — exactly the orphaned phantom tiles we want.
          const tileRefs = await gridDoc.ref
            .collection("tiles")
            .listDocuments();

          for (const tileRef of tileRefs) {
            if (liveTileIds.has(tileRef.id)) continue;

            const newest = await tileRef
              .collection("messages")
              .orderBy("createdAt", "desc")
              .limit(1)
              .get();
            // No messages / undeterminable age → conservative skip.
            if (newest.empty) {
              skipped++;
              continue;
            }
            const createdAt = toMillis(newest.docs[0].data().createdAt);
            if (createdAt === null || now - createdAt < GRACE_PERIOD_MS) {
              skipped++;
              continue;
            }

            // Stop once the per-run delete budget is spent; the remaining
            // orphans are reclaimed on the next scheduled run.
            if (deleted >= MAX_DELETIONS_PER_RUN) {
              reachedDeletionCap = true;
              break;
            }

            // SCOPE GUARD: the delete target is always the individual tileRef
            // (grids/{gridId}/tiles/{tileId}) — NEVER gridDoc.ref. The sweep only
            // ever reads the grid doc; recursiveDelete on the grid ref here would
            // wipe the entire grid (that is Fix 2's job, on actual grid deletion).
            await db.recursiveDelete(tileRef);
            deleted++;
            logger.info("Swept orphaned tile subcollection", {
              gridId,
              tileId: tileRef.id,
            });
          }
        } catch (error) {
          // One bad grid must not abort the whole sweep.
          logger.error("Failed sweeping grid for orphaned subcollections", {
            error: String(error),
            gridId,
          });
        }

        if (reachedDeletionCap) break;
      }

      // A short page means the collection is exhausted; otherwise advance the
      // cursor to the last doc read and fetch the next page.
      if (page.size < GRIDS_PAGE_SIZE) break;
      pageStart = page.docs[page.docs.length - 1];
    }

    if (reachedDeletionCap) {
      logger.warn(
        "Orphaned subcollection sweep hit the per-run deletion cap; remaining orphans will be reclaimed next run",
        { deleted, cap: MAX_DELETIONS_PER_RUN },
      );
    }
    logger.info("Orphaned subcollection sweep completed", {
      deleted,
      skipped,
      reachedDeletionCap,
    });
    return null;
  });
