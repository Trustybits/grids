import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import {
  incrementUserStorageUsage,
  parseUserStorageObject,
  SKIP_STORAGE_ACCOUNTING_METADATA_KEY,
} from "./utils_storageUsage.js";
import {
  ensureDownloadToken,
  finalizeUploadArchiveDoc,
  markUploadFailed,
} from "./utils_uploadArchive.js";
import { hashStorageObject } from "./utils_storageHash.js";
import { parseCanonicalUploadPath } from "./utils_uploadPaths.js";

/**
 * Cloud Function that triggers when a file is uploaded to Firebase Storage.
 * Updates the user's storage usage in Firestore.
 */
export const onFileUploaded = functions
  .runWith({ minInstances: 1 })
  .storage.object()
  .onFinalize(async (object) => {
    if (noopIfMaintenance("onFileUploaded")) return null;

    const storageObject = parseUserStorageObject(object, {
      sanitizeInvalidSize: true,
    });
    if (!storageObject) {
      return null;
    }

    const { filePath, fileSize, userId } = storageObject;
    const parsedPath = parseCanonicalUploadPath(filePath);
    if (!parsedPath) return null;

    logger.info("Canonical file uploaded, verifying archive upload", {
      userId,
      filePath,
      fileSize,
    });

    try {
      const actualHash = await hashStorageObject(filePath, object.bucket);
      if (actualHash !== parsedPath.hash) {
        await markUploadFailed(userId, parsedPath.hash, "hash-mismatch");
        await deleteWithoutStorageAccounting(object.bucket, filePath);
        logger.warn("Uploaded object hash did not match canonical path", {
          userId,
          filePath,
          expectedHash: parsedPath.hash,
          actualHash,
        });
        return null;
      }

      const bucket = admin.storage().bucket(object.bucket);
      const token = ensureDownloadToken(object.metadata);
      await bucket.file(filePath).setMetadata({
        contentType: object.contentType,
        metadata: {
          ...(object.metadata ?? {}),
          published: "true",
          firebaseStorageDownloadTokens: token,
        },
      });

      const finalized = await finalizeUploadArchiveDoc({
        uid: userId,
        metadata: {
          kind: parsedPath.kind,
          hash: parsedPath.hash,
          ext: parsedPath.ext,
          size: fileSize,
          contentType: (object.contentType ?? "").toLowerCase(),
        },
        bucketName: object.bucket,
        token,
      });

      if (!finalized.activated) {
        if (finalized.reason === "missing-reservation") {
          await markUploadFailed(userId, parsedPath.hash, "missing-reservation");
        }
        if (
          finalized.reason === "missing-reservation" ||
          finalized.reason === "metadata-mismatch"
        ) {
          await deleteWithoutStorageAccounting(object.bucket, filePath);
        }
        return null;
      }

      await incrementUserStorageUsage(userId, fileSize);

      return null;
    } catch (error) {
      logger.error("Failed to verify archived upload", {
        error: String(error),
        userId,
        filePath,
        fileSize,
      });
      return null;
    }
  });

async function deleteWithoutStorageAccounting(
  bucketName: string,
  filePath: string,
): Promise<void> {
  const file = admin.storage().bucket(bucketName).file(filePath);
  await file.setMetadata({
    metadata: {
      [SKIP_STORAGE_ACCOUNTING_METADATA_KEY]: "true",
    },
  });
  await file.delete({ ignoreNotFound: true });
}
