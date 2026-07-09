import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";

/**
 * Firebase function that triggers when a grid document is deleted and reclaims
 * the whole grid subtree.
 *
 * Firestore does not cascade deletes: removing `grids/{gridId}` leaves every
 * descendant subcollection orphaned — most notably each chat tile's
 * `tiles/{tileId}/messages` (tiles are not real documents, so those
 * subcollections hang off phantom parents). The Admin SDK's `recursiveDelete`
 * traverses and deletes all descendants of the grid ref even though the grid
 * doc itself is already gone.
 *
 * This is intentionally a standalone trigger, separate from the grid-deletion
 * Discord/analytics notification (onTrigger_gridDeleted.ts). Data cleanup is a
 * core operation and must not be gated behind — or short-circuited by —
 * notification side-effects. Multiple onDelete triggers on the same path are
 * allowed.
 *
 * IRREVERSIBLE: grid deletion is a hard delete today (no undo, no trash), so
 * firing on the initial onDelete and wiping the subtree is safe — nothing can
 * bring the grid back. If grid deletion ever becomes soft-delete / trash-restore,
 * this must move to fire on *permanent* deletion (trash purge / TTL) instead;
 * otherwise it would destroy subcollections of a grid the user could restore.
 */
export const cleanupGridSubcollectionsOnDelete = functions.firestore
  .document("grids/{gridId}")
  .onDelete(async (snapshot, context) => {
    if (noopIfMaintenance("cleanupGridSubcollectionsOnDelete")) return null;

    const gridId = context.params.gridId;

    try {
      const pendingTransfers = await admin
        .firestore()
        .collection("gridTransfers")
        .where("gridId", "==", gridId)
        .where("status", "==", "pending")
        .get();
      await Promise.all(
        pendingTransfers.docs.map((doc) =>
          doc.ref.update({
            status: "expired",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            failureReason: "grid-deleted",
          }),
        ),
      );
      await admin.firestore().recursiveDelete(snapshot.ref);
      logger.info("Recursively deleted grid subcollections", { gridId });
    } catch (error) {
      logger.error("Failed to delete grid subcollections", {
        error: String(error),
        gridId,
      });
    }

    return null;
  });
