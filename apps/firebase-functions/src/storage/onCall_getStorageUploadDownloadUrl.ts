import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";
import { readUploadArchiveDoc } from "./utils_uploadArchive.js";
import { normalizeHash } from "./utils_uploadPaths.js";

export const getStorageUploadDownloadUrl = functions
  .runWith({ minInstances: 1 })
  .https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("getStorageUploadDownloadUrl")) return null;

    requireAuth(context, "Sign in required.");
    const payload = getCallableData<{ ownerId?: unknown; hash?: unknown }>(
      data,
    );
    if (typeof payload.ownerId !== "string" || !payload.ownerId.trim()) {
      throw new HttpsError("invalid-argument", "ownerId is required.");
    }
    const ownerId = payload.ownerId.trim();
    const hash = normalizeHash(payload.hash);
    const archiveDoc = await readUploadArchiveDoc(ownerId, hash);

    if (!archiveDoc || archiveDoc.status !== "active") {
      throw new HttpsError("not-found", "Upload not found.");
    }
    if (archiveDoc.shareable !== true || !archiveDoc.url) {
      throw new HttpsError("permission-denied", "Upload is not shareable.");
    }

    return { hash, url: archiveDoc.url };
  },
);
