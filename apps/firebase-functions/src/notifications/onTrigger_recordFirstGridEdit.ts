import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import {
  GRID_ENGAGEMENT_EMAILS_COLLECTION,
} from "./utils_gridEngagementEmail.js";
import {
  getMeaningfulGridChanges,
  hasUserGridContentEdit,
} from "./utils_gridChanges.js";

/**
 * Records the timestamp of a user's first grid content edit (name or tiles).
 * A scheduled function sends the engagement email after a delay (default 2 days).
 */
export const onRecordFirstGridEdit = functions.firestore
  .document("grids/{gridId}")
  .onUpdate(async (change, context) => {
    if (noopIfMaintenance("onRecordFirstGridEdit")) return null;

    const beforeData = change.before.data();
    const afterData = change.after.data();
    const gridId = context.params.gridId;
    const userId = afterData.userId as string | undefined;

    const beforeUpdatedAt =
      beforeData.updatedAt?.toMillis?.() ?? beforeData.updatedAt;
    const afterUpdatedAt =
      afterData.updatedAt?.toMillis?.() ?? afterData.updatedAt;
    if (!afterUpdatedAt || beforeUpdatedAt === afterUpdatedAt) {
      return null;
    }

    const changes = getMeaningfulGridChanges(beforeData, afterData);
    if (!hasUserGridContentEdit(changes)) {
      return null;
    }

    if (!userId) {
      return null;
    }

    const db = admin.firestore();
    const engagementRef = db.collection(GRID_ENGAGEMENT_EMAILS_COLLECTION).doc(userId);

    try {
      const existing = await engagementRef.get();
      if (existing.exists) {
        return null;
      }

      await engagementRef.set({
        userId,
        gridId,
        gridName: afterData.name || "Untitled",
        firstEditAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
      });

      logger.info("Recorded first grid edit for delayed engagement email", {
        userId,
        gridId,
      });
    } catch (error) {
      logger.error("Failed to record first grid edit for engagement email", {
        userId,
        gridId,
        error: String(error),
      });
    }

    return null;
  });
