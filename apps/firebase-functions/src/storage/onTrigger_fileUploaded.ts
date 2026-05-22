import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";

/**
 * Cloud Function that triggers when a file is uploaded to Firebase Storage.
 * Updates the user's storage usage in Firestore.
 */
export const onFileUploaded = functions.storage
  .object()
  .onFinalize(async (object) => {
    if (noopIfMaintenance("onFileUploaded")) return null;

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

    logger.info("File uploaded, updating storage usage", {
      userId,
      filePath,
      fileSize,
    });

    try {
      const userRef = admin.firestore().collection("users").doc(userId);

      // Use a transaction to safely increment the storage usage
      await admin.firestore().runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);

        // Initialize storageUsed if it doesn't exist
        const currentUsage =
          userDoc.exists && userDoc.data()?.storageUsed
            ? (userDoc.data()?.storageUsed as number)
            : 0;

        const newUsage = currentUsage + fileSize;

        // Update or create the user document with the new storage usage
        if (userDoc.exists) {
          transaction.update(userRef, { storageUsed: newUsage });
        } else {
          transaction.set(userRef, { storageUsed: newUsage }, { merge: true });
        }

        logger.info("Storage usage updated", {
          userId,
          previousUsage: currentUsage,
          newUsage,
          fileSize,
        });
      });

      return null;
    } catch (error) {
      logger.error("Failed to update storage usage on upload", {
        error: String(error),
        userId,
        filePath,
        fileSize,
      });
      return null;
    }
  });
