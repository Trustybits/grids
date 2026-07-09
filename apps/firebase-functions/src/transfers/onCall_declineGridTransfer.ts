import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";
import {
  markTransferResolved,
  normalizeTransferId,
  readTransfer,
} from "./utils_gridTransfer.js";

export const declineGridTransfer = functions
  .runWith({ minInstances: 1 })
  .https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("declineGridTransfer")) return null;

    const recipientUid = requireAuth(context, "Sign in required.");
    const payload = getCallableData<{ transferId?: unknown }>(data);
    const transferId = normalizeTransferId(payload.transferId);
    const { ref, transfer } = await readTransfer(transferId);
    if (transfer.toUserId !== recipientUid) {
      throw new HttpsError(
        "permission-denied",
        "You cannot decline this transfer.",
      );
    }
    if (transfer.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        "This transfer is no longer pending.",
      );
    }

    await markTransferResolved(ref, "declined");
    return { transferId, status: "declined" };
  },
);
