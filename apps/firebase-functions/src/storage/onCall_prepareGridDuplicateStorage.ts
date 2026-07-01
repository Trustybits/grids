import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";
import {
  assertUserHasStorageQuota,
  buildDownloadUrl,
  createPendingArchiveReservation,
  ensureDownloadToken,
  readUploadArchiveDoc,
  type UploadArchiveDoc,
} from "./utils_uploadArchive.js";
import { extractGridStorageReferencesFromRecord } from "@grids/contracts/storage";
import { buildCanonicalUploadPath, type UploadMetadata } from "./utils_uploadPaths.js";

type GridDuplicateStorageRequest = {
  sourceGridId?: unknown;
  copyDepth?: unknown;
  confirmed?: unknown;
};

type ReferencePlan = {
  hash: string;
  archiveDoc: UploadArchiveDoc;
};

export const prepareGridDuplicateStorage = functions.https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("prepareGridDuplicateStorage")) return null;

    const targetUid = requireAuth(context, "Sign in required.");
    const payload = getCallableData<GridDuplicateStorageRequest>(data);
    if (typeof payload.sourceGridId !== "string" || !payload.sourceGridId) {
      throw new HttpsError("invalid-argument", "sourceGridId is required.");
    }
    if (payload.copyDepth !== "full" && payload.copyDepth !== "structure") {
      throw new HttpsError("invalid-argument", "copyDepth is required.");
    }

    if (payload.copyDepth === "structure") {
      return {
        additionalBytesRequired: 0,
        copiableCount: 0,
        nonCopiableCount: 0,
        replacementTileIds: [],
      };
    }

    const db = admin.firestore();
    const sourceSnap = await db.collection("grids").doc(payload.sourceGridId).get();
    if (!sourceSnap.exists) {
      throw new HttpsError("not-found", "Source grid not found.");
    }
    const sourceGrid = sourceSnap.data();
    const sourceUid = typeof sourceGrid?.userId === "string"
      ? sourceGrid.userId
      : null;
    if (!sourceUid) {
      throw new HttpsError("failed-precondition", "Source grid has no owner.");
    }

    const references = extractGridStorageReferencesFromRecord(sourceGrid);
    const uniqueHashes = [...new Set(references.map((ref) => ref.hash))];
    const archiveDocs = await Promise.all(
      uniqueHashes.map(async (hash) => ({
        hash,
        archiveDoc: await readUploadArchiveDoc(sourceUid, hash),
      })),
    );

    const copiable = new Map<string, ReferencePlan>();
    const nonCopiableHashes = new Set<string>();
    for (const entry of archiveDocs) {
      if (!entry.archiveDoc) {
        nonCopiableHashes.add(entry.hash);
        continue;
      }
      if (sourceUid === targetUid || entry.archiveDoc.shareable === true) {
        copiable.set(entry.hash, {
          hash: entry.hash,
          archiveDoc: entry.archiveDoc,
        });
      } else {
        nonCopiableHashes.add(entry.hash);
      }
    }

    const replacementTileIds = [
      ...new Set(
        references
          .filter((ref) => nonCopiableHashes.has(ref.hash) && ref.tileId)
          .map((ref) => ref.tileId as string),
      ),
    ];

    const targetArchiveDocs = new Map<string, UploadArchiveDoc>();
    const missingForTarget = new Map<string, ReferencePlan>();
    for (const [hash, plan] of copiable) {
      const targetDoc = await readUploadArchiveDoc(targetUid, hash);
      if (targetDoc?.status === "active") {
        targetArchiveDocs.set(hash, targetDoc);
      } else {
        missingForTarget.set(hash, plan);
      }
    }

    const additionalBytesRequired = [...missingForTarget.values()].reduce(
      (sum, plan) => sum + plan.archiveDoc.size,
      0,
    );
    await assertUserHasStorageQuota(targetUid, additionalBytesRequired);

    if (payload.confirmed !== true) {
      return {
        additionalBytesRequired,
        copiableCount: copiable.size,
        nonCopiableCount: replacementTileIds.length,
        replacementTileIds,
      };
    }

    const bucket = admin.storage().bucket();
    const rewriteMap: Record<
      string,
      { oldHash?: string; oldUrl?: string; newHash: string; newUrl: string }
    > = {};

    for (const [hash, plan] of copiable) {
      const targetMetadata = metadataFromArchiveDoc(plan.archiveDoc);
      const targetPath = buildCanonicalUploadPath(targetUid, targetMetadata);
      const token = ensureDownloadToken();
      let targetUrl =
        targetArchiveDocs.get(hash)?.url ??
        buildDownloadUrl(bucket.name, targetPath, token);

      if (missingForTarget.has(hash)) {
        await createPendingArchiveReservation(targetUid, targetMetadata);
        await bucket.file(plan.archiveDoc.path).copy(bucket.file(targetPath));
        await bucket.file(targetPath).setMetadata({
          contentType: plan.archiveDoc.contentType,
          metadata: {
            published: "true",
            firebaseStorageDownloadTokens: token,
          },
        });
        targetUrl = buildDownloadUrl(bucket.name, targetPath, token);
      }

      rewriteMap[hash] = {
        oldHash: hash,
        oldUrl: plan.archiveDoc.url,
        newHash: hash,
        newUrl: targetUrl,
      };
    }

    return {
      additionalBytesRequired,
      copiableCount: copiable.size,
      nonCopiableCount: replacementTileIds.length,
      rewriteMap,
      replacementTileIds,
    };
  },
);

function metadataFromArchiveDoc(doc: UploadArchiveDoc): UploadMetadata {
  return {
    kind: doc.kind as UploadMetadata["kind"],
    hash: doc.hash,
    ext: doc.ext,
    size: doc.size,
    contentType: doc.contentType,
  };
}
