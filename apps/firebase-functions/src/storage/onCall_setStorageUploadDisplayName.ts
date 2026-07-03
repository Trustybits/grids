import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";
import {
  readUploadArchiveDoc,
  uploadArchiveRef,
} from "./utils_uploadArchive.js";
import { normalizeDisplayName, normalizeHash } from "./utils_uploadPaths.js";

/**
 * Rename an archive upload's display label. This changes only the archive
 * document's `displayName`; the object path, hash, and any grid references that
 * point at the file are untouched.
 */
export const setStorageUploadDisplayName = functions.https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("setStorageUploadDisplayName")) return null;

    const uid = requireAuth(context, "Sign in required.");
    const payload = getCallableData<{ hash: unknown; displayName?: unknown }>(
      data,
    );
    const hash = normalizeHash(payload.hash);
    if (typeof payload.displayName !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "A display name is required.",
      );
    }

    const archiveDoc = await readUploadArchiveDoc(uid, hash);
    if (!archiveDoc) {
      throw new HttpsError("not-found", "Upload not found.");
    }

    const displayName = normalizeDisplayName(payload.displayName, "");
    if (!displayName) {
      throw new HttpsError(
        "invalid-argument",
        "A non-empty display name is required.",
      );
    }

    await uploadArchiveRef(uid, hash).update({
      displayName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { hash, displayName };
  },
);
