import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";
import {
  fieldValue,
  gridTransfersCollection,
  normalizeGridId,
  normalizeRecipientRef,
  normalizeRemoveOrphanedFiles,
  resolveRecipientUid,
  transferExpiresAt,
} from "./utils_gridTransfer.js";
import { buildTransferInventory } from "./utils_gridTransferAcceptance.js";

export const createGridTransfer = functions.https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("createGridTransfer")) return null;

    const senderUid = requireAuth(context, "Sign in required.");
    const payload = getCallableData<{
      gridId?: unknown;
      recipient?: unknown;
      removeOrphanedFiles?: unknown;
    }>(data);
    const gridId = normalizeGridId(payload.gridId);
    const recipient = normalizeRecipientRef(payload.recipient);
    const removeOrphanedFiles = normalizeRemoveOrphanedFiles(
      payload.removeOrphanedFiles,
    );
    const recipientUid = await resolveRecipientUid(recipient);
    if (recipientUid === senderUid) {
      throw new HttpsError(
        "failed-precondition",
        "You cannot transfer a grid to yourself.",
      );
    }

    const db = admin.firestore();
    const gridRef = db.collection("grids").doc(gridId);
    const gridSnap = await gridRef.get();
    if (!gridSnap.exists) {
      throw new HttpsError("not-found", "Grid not found.");
    }
    const grid = gridSnap.data() ?? {};
    if (grid.userId !== senderUid) {
      throw new HttpsError(
        "permission-denied",
        "You do not own this grid.",
      );
    }

    const existing = await gridTransfersCollection()
      .where("gridId", "==", gridId)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new HttpsError(
        "failed-precondition",
        "This grid already has a pending transfer.",
      );
    }

    const senderSnap = await db.collection("users").doc(senderUid).get();
    const sender = senderSnap.data() ?? {};
    const inventory = await buildTransferInventory({
      grid,
      fromUserId: senderUid,
      toUserId: recipientUid,
      assertQuota: false,
    });

    const transferRef = gridTransfersCollection().doc();
    const transferId = transferRef.id;
    await transferRef.set({
      id: transferId,
      gridId,
      gridName: typeof grid.name === "string" ? grid.name : "Untitled",
      fromUserId: senderUid,
      fromSlug: typeof sender.slug === "string" ? sender.slug : null,
      fromEmail: typeof sender.email === "string" ? sender.email : null,
      toUserId: recipientUid,
      removeOrphanedFiles,
      status: "pending",
      createdAt: fieldValue().serverTimestamp(),
      updatedAt: fieldValue().serverTimestamp(),
      expiresAt: transferExpiresAt(),
    });

    return {
      transferId,
      status: "pending",
      estimatedBytes: inventory.copyPlan.additionalBytesRequired,
    };
  },
);
