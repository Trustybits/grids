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

export const setStorageUploadShareable = functions.https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("setStorageUploadShareable")) return null;

    const uid = requireAuth(context, "Sign in required.");
    const payload = getCallableData<{ hash: unknown; shareable?: unknown }>(
      data,
    );
    const hash = normalizeHash(payload.hash);
    if (typeof payload.shareable !== "boolean") {
      throw new HttpsError(
        "invalid-argument",
        "A shareable boolean is required.",
      );
    }

    const archiveDoc = await readUploadArchiveDoc(uid, hash);
    if (!archiveDoc) {
      throw new HttpsError("not-found", "Upload not found.");
    }

    await uploadArchiveRef(uid, hash).update({
      shareable: payload.shareable,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { hash, shareable: payload.shareable };
  },
);
