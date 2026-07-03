import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../maintenance.js";
import {
  decrementUserStorageUsage,
  parseUserStorageObject,
} from "./utils_storageUsage.js";

/**
 * Cloud Function that triggers when a file is deleted from Firebase Storage.
 * Decrements the user's storage usage in Firestore.
 */
export const onFileDeleted = functions.storage
  .object()
  .onDelete(async (object) => {
    if (noopIfMaintenance("onFileDeleted")) return null;

    const storageObject = parseUserStorageObject(object, {
      sanitizeInvalidSize: true,
    });
    if (!storageObject) {
      return null;
    }

    const { filePath, fileSize, userId } = storageObject;

    logger.info("Canonical file deleted, updating storage usage", {
      userId,
      filePath,
      fileSize,
    });

    try {
      await decrementUserStorageUsage(userId, fileSize);

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
