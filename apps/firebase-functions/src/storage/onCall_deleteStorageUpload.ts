import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";
import {
  deleteUploadArchiveAndDecrementUsage,
  readUploadArchiveDoc,
} from "./utils_uploadArchive.js";
import { normalizeHash } from "./utils_uploadPaths.js";
import { SKIP_STORAGE_ACCOUNTING_METADATA_KEY } from "./utils_storageUsage.js";

export const deleteStorageUpload = functions
  .runWith({ minInstances: 1 })
  .https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("deleteStorageUpload")) return null;

    const uid = requireAuth(context, "Sign in required.");
    const payload = getCallableData<{ hash: unknown; force?: unknown }>(data);
    const hash = normalizeHash(payload.hash);
    const force = payload.force === true;

    const archiveDoc = await readUploadArchiveDoc(uid, hash);
    if (!archiveDoc) {
      throw new HttpsError("not-found", "Upload not found.");
    }
    if (archiveDoc.uid !== uid) {
      throw new HttpsError("permission-denied", "You do not own this upload.");
    }
    if ((archiveDoc.refCount ?? 0) > 0 && !force) {
      throw new HttpsError(
        "failed-precondition",
        "This upload is still referenced. Pass force to permanently delete it.",
      );
    }

    // Cloud Storage soft delete defers (or omits) the OBJECT_DELETE event that
    // backs the onFileDeleted trigger, so we cannot rely on that trigger to
    // decrement storageUsed. Decrement here instead, atomically with the
    // archive-doc delete (see deleteUploadArchiveAndDecrementUsage).
    //
    // Stamp the skip-accounting tag BEFORE deleting the object so that if
    // OBJECT_DELETE ever does fire (e.g. when the soft-delete retention window
    // purges the object), onFileDeleted treats it as skip-accounting and never
    // double-decrements. This mirrors the storageMigration gc path. We refuse
    // to delete an object we could not tag, to keep that guarantee intact.
    const file = admin.storage().bucket().file(archiveDoc.path);
    try {
      await file.setMetadata({
        metadata: { [SKIP_STORAGE_ACCOUNTING_METADATA_KEY]: "true" },
      });
    } catch (err) {
      if (!isNotFoundError(err)) {
        logger.error("Failed to tag upload before permanent delete", {
          uid,
          hash,
          path: archiveDoc.path,
          error: String(err),
        });
        throw new HttpsError(
          "internal",
          "Could not delete this file. Please try again.",
        );
      }
      // Object already gone: nothing to tag, safe to continue.
    }

    await file.delete({ ignoreNotFound: true });
    await deleteUploadArchiveAndDecrementUsage(uid, hash);

    return { deleted: true, hash };
  },
);

/** Google Cloud Storage surfaces a missing object as an error with code 404. */
function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === 404
  );
}
