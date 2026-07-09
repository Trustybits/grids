import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";
import {
  getRecipientQuotaRemaining,
  isExpired,
  markTransferResolved,
  normalizeTransferId,
  readTransfer,
} from "./utils_gridTransfer.js";
import { buildTransferInventory } from "./utils_gridTransferAcceptance.js";

export const previewGridTransferAcceptance = functions.https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("previewGridTransferAcceptance")) return null;

    const recipientUid = requireAuth(context, "Sign in required.");
    const payload = getCallableData<{ transferId?: unknown }>(data);
    const transferId = normalizeTransferId(payload.transferId);
    const { ref: transferRef, transfer } = await readTransfer(transferId);
    if (transfer.toUserId !== recipientUid) {
      throw new HttpsError(
        "permission-denied",
        "You cannot preview this transfer.",
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

    const gridSnap = await admin
      .firestore()
      .collection("grids")
      .doc(transfer.gridId)
      .get();
    if (!gridSnap.exists || gridSnap.data()?.userId !== transfer.fromUserId) {
      await markTransferResolved(transferRef, "expired", {
        failureReason: "grid-unavailable",
      });
      throw new HttpsError(
        "failed-precondition",
        "This grid is no longer available for transfer.",
      );
    }

    const inventory = await buildTransferInventory({
      grid: gridSnap.data(),
      fromUserId: transfer.fromUserId,
      toUserId: recipientUid,
      assertQuota: false,
    });
    const quota = await getRecipientQuotaRemaining(recipientUid);

    return {
      additionalBytesRequired: inventory.copyPlan.additionalBytesRequired,
      recipientQuotaRemaining: quota.remaining,
      wouldExceedQuota:
        !quota.isDevAccount &&
        inventory.copyPlan.additionalBytesRequired > quota.remaining,
      files: inventory.files,
      nonCopiableCount: inventory.copyPlan.nonCopiableHashes.size,
    };
  },
);
