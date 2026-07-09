import * as functions from "firebase-functions/v1";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import {
  fieldValue,
  gridTransfersCollection,
  timestampFromMillis,
} from "./utils_gridTransfer.js";

export const sweepExpiredGridTransfers = functions
  .pubsub
  .schedule("0 3 * * *")
  .timeZone("America/Denver")
  .onRun(async () => {
    if (noopIfMaintenance("sweepExpiredGridTransfers")) return null;

    const now = timestampFromMillis(Date.now());
    const snap = await gridTransfersCollection()
      .where("status", "==", "pending")
      .where("expiresAt", "<=", now)
      .get();

    const batch = admin.firestore().batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        status: "expired",
        updatedAt: fieldValue().serverTimestamp(),
        resolvedAt: fieldValue().serverTimestamp(),
        failureReason: "expired",
      });
    }
    await batch.commit();
    return null;
  });
