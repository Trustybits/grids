import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";

/**
 * Cloud Function that triggers when a file is deleted from Firebase Storage.
 * Decrements the user's storage usage in Firestore.
 */
export const onFileDeleted = functions.storage
  .object()
  .onDelete(async (object) => {
    if (noopIfMaintenance("onFileDeleted")) return null;

    const filePath = object.name;
    const fileSize = parseInt(object.size || "0", 10);

    if (!filePath) {
      logger.warn("File path is undefined");
      return null;
    }

    // Extract userId from the file path (e.g., users/{userId}/images/{imageId})
    const pathParts = filePath.split("/");
    if (pathParts.length < 2 || pathParts[0] !== "users") {
      logger.debug(
        "File is not in a user directory, skipping storage tracking",
        { filePath },
      );
      return null;
    }

    const userId = pathParts[1];

    logger.info("File deleted, updating storage usage", {
      userId,
      filePath,
      fileSize,
    });

    try {
      const userRef = admin.firestore().collection("users").doc(userId);

      // Use a transaction to safely decrement the storage usage
      await admin.firestore().runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          logger.warn(
            "User document does not exist, cannot decrement storage",
            { userId },
          );
          return;
        }

        const currentUsage = userDoc.data()?.storageUsed || 0;
        const newUsage = Math.max(0, currentUsage - fileSize); // Ensure we don't go negative

        transaction.update(userRef, { storageUsed: newUsage });

        logger.info("Storage usage updated after deletion", {
          userId,
          previousUsage: currentUsage,
          newUsage,
          fileSize,
        });
      });

      return null;
    } catch (error) {
      logger.error("Failed to update storage usage on deletion", {
        error: String(error),
        userId,
        filePath,
        fileSize,
      });
      return null;
    }
  });
