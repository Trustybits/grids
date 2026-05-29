import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../maintenance.js";
import {
  incrementUserStorageUsage,
  parseUserStorageObject,
} from "./utils_storageUsage.js";

/**
 * Cloud Function that triggers when a file is uploaded to Firebase Storage.
 * Updates the user's storage usage in Firestore.
 */
export const onFileUploaded = functions.storage
  .object()
  .onFinalize(async (object) => {
    if (noopIfMaintenance("onFileUploaded")) return null;

    const storageObject = parseUserStorageObject(object, {
      sanitizeInvalidSize: true,
    });
    if (!storageObject) {
      return null;
    }

    const { filePath, fileSize, userId } = storageObject;

    logger.info("File uploaded, updating storage usage", {
      userId,
      filePath,
      fileSize,
    });

    try {
      await incrementUserStorageUsage(userId, fileSize);

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
