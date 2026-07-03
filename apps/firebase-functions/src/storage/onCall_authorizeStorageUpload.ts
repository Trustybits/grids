import * as functions from "firebase-functions/v1";
import { noopIfMaintenance } from "../maintenance.js";
import { requireAuth } from "../shared/utils_callable.js";
import { authorizeUploadReservation } from "./utils_uploadArchive.js";
import { normalizeUploadMetadata } from "./utils_uploadPaths.js";

export const authorizeStorageUpload = functions.https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("authorizeStorageUpload")) return null;

    const uid = requireAuth(context, "Sign in required.");
    const metadata = normalizeUploadMetadata(data);

    return authorizeUploadReservation(uid, metadata);
  },
);
