import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";
import {
  readUploadArchiveDoc,
  uploadArchiveRef,
} from "./utils_uploadArchive.js";
import { normalizeHash } from "./utils_uploadPaths.js";

export const deleteStorageUpload = functions.https.onCall(
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

    await uploadArchiveRef(uid, hash).delete();
    await admin.storage().bucket().file(archiveDoc.path).delete({
      ignoreNotFound: true,
    });

    return { deleted: true, hash };
  },
);
