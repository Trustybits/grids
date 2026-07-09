import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";
import {
  fieldValue,
  isExpired,
  markTransferResolved,
  normalizeTransferId,
  readTransfer,
} from "./utils_gridTransfer.js";
import {
  buildTransferInventory,
  copyTransferArchiveObjects,
  deleteNotionAndUpvoteSubcollections,
  deleteSenderOrphanedFiles,
  rewriteGridForTransfer,
} from "./utils_gridTransferAcceptance.js";

export const acceptGridTransfer = functions
  .runWith({ minInstances: 1 })
  .https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("acceptGridTransfer")) return null;

    const recipientUid = requireAuth(context, "Sign in required.");
    const payload = getCallableData<{ transferId?: unknown }>(data);
    const transferId = normalizeTransferId(payload.transferId);
    const { ref: transferRef, transfer } = await readTransfer(transferId);
    if (transfer.toUserId !== recipientUid) {
      throw new HttpsError(
        "permission-denied",
        "You cannot accept this transfer.",
      );
    }
    if (transfer.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        "This transfer is no longer pending.",
      );
    }
    if (isExpired(transfer.expiresAt)) {
      await markTransferResolved(transferRef, "expired", {
        failureReason: "expired",
      });
      throw new HttpsError("failed-precondition", "This transfer has expired.");
    }

    const db = admin.firestore();
    const gridRef = db.collection("grids").doc(transfer.gridId);
    const gridSnap = await gridRef.get();
    if (!gridSnap.exists || gridSnap.data()?.userId !== transfer.fromUserId) {
      await markTransferResolved(transferRef, "expired", {
        failureReason: "grid-unavailable",
      });
      throw new HttpsError(
        "failed-precondition",
        "This grid is no longer available for transfer.",
      );
    }

    const grid = gridSnap.data() ?? {};
    const inventory = await buildTransferInventory({
      grid,
      fromUserId: transfer.fromUserId,
      toUserId: recipientUid,
      assertQuota: true,
    });
    const rewriteMap = await copyTransferArchiveObjects({
      toUserId: recipientUid,
      copyPlan: inventory.copyPlan,
    });
    const rewrittenGrid = rewriteGridForTransfer({
      gridId: transfer.gridId,
      grid,
      toUserId: recipientUid,
      rewriteMap,
      nonCopiableHashes: inventory.copyPlan.nonCopiableHashes,
    });

    await deleteNotionAndUpvoteSubcollections(
      transfer.gridId,
      Array.isArray(grid.tiles) ? grid.tiles : [],
    );

    const senderRef = db.collection("users").doc(transfer.fromUserId);
    await db.runTransaction(async (tx) => {
      // Firestore transactions require every read before any write, so read the
      // grid, transfer, and sender docs up front, then apply all mutations.
      const latestGridSnap = await tx.get(gridRef);
      if (
        !latestGridSnap.exists ||
        latestGridSnap.data()?.userId !== transfer.fromUserId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "This grid is no longer available for transfer.",
        );
      }
      const latestTransferSnap = await tx.get(transferRef);
      if (latestTransferSnap.data()?.status !== "pending") {
        throw new HttpsError(
          "failed-precondition",
          "This transfer is no longer pending.",
        );
      }
      const senderSnap = await tx.get(senderRef);

      tx.update(gridRef, rewrittenGrid);

      if (senderSnap.data()?.defaultGridId === transfer.gridId) {
        tx.update(senderRef, { defaultGridId: null });
        const senderSlug = senderSnap.data()?.slug ?? transfer.fromSlug;
        if (typeof senderSlug === "string" && senderSlug) {
          tx.set(
            db.collection("slugs").doc(senderSlug),
            { defaultGridId: null },
            { merge: true },
          );
        }
      }

      tx.update(transferRef, {
        status: "accepted",
        updatedAt: fieldValue().serverTimestamp(),
        resolvedAt: fieldValue().serverTimestamp(),
      });
    });

    if (transfer.removeOrphanedFiles) {
      await deleteSenderOrphanedFiles({
        fromUserId: transfer.fromUserId,
        gridId: transfer.gridId,
        transferredHashes: new Set(inventory.references.map((ref) => ref.hash)),
      });
    }

    return {
      transferId,
      gridId: transfer.gridId,
      status: "accepted",
    };
  },
);
