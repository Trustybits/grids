import admin from "../admin.js";
import {
  assertUserHasStorageQuota,
  buildDownloadUrl,
  createPendingArchiveReservation,
  ensureDownloadToken,
  readUploadArchiveDoc,
  type UploadArchiveDoc,
} from "./utils_uploadArchive.js";
import { buildCanonicalUploadPath, type UploadMetadata } from "./utils_uploadPaths.js";

export type ArchiveObjectCopyReference = {
  hash: string;
};

export type ArchiveObjectRewrite = {
  oldHash?: string;
  oldUrl?: string;
  newHash: string;
  newUrl: string;
};

export type ArchiveObjectCopyPlan = {
  copiable: Map<string, UploadArchiveDoc>;
  nonCopiableHashes: Set<string>;
  additionalBytesRequired: number;
  targetArchiveDocs: Map<string, UploadArchiveDoc>;
  missingForTarget: Map<string, UploadArchiveDoc>;
};

export async function prepareArchiveObjectCopyPlan(params: {
  sourceUid: string;
  targetUid: string;
  references: ArchiveObjectCopyReference[];
  requireShareable: boolean;
}): Promise<ArchiveObjectCopyPlan> {
  const uniqueHashes = [...new Set(params.references.map((ref) => ref.hash))];
  const archiveDocs = await Promise.all(
    uniqueHashes.map(async (hash) => ({
      hash,
      archiveDoc: await readUploadArchiveDoc(params.sourceUid, hash),
    })),
  );

  const copiable = new Map<string, UploadArchiveDoc>();
  const nonCopiableHashes = new Set<string>();
  for (const entry of archiveDocs) {
    if (!entry.archiveDoc) {
      nonCopiableHashes.add(entry.hash);
      continue;
    }
    if (
      !params.requireShareable ||
      params.sourceUid === params.targetUid ||
      entry.archiveDoc.shareable === true
    ) {
      copiable.set(entry.hash, entry.archiveDoc);
    } else {
      nonCopiableHashes.add(entry.hash);
    }
  }

  const targetArchiveDocs = new Map<string, UploadArchiveDoc>();
  const missingForTarget = new Map<string, UploadArchiveDoc>();
  for (const [hash, archiveDoc] of copiable) {
    const targetDoc = await readUploadArchiveDoc(params.targetUid, hash);
    if (targetDoc?.status === "active") {
      targetArchiveDocs.set(hash, targetDoc);
    } else {
      missingForTarget.set(hash, archiveDoc);
    }
  }

  const additionalBytesRequired = [...missingForTarget.values()].reduce(
    (sum, archiveDoc) => sum + archiveDoc.size,
    0,
  );
  await assertUserHasStorageQuota(params.targetUid, additionalBytesRequired);

  return {
    copiable,
    nonCopiableHashes,
    additionalBytesRequired,
    targetArchiveDocs,
    missingForTarget,
  };
}

export async function copyArchiveObjects(params: {
  targetUid: string;
  plan: ArchiveObjectCopyPlan;
}): Promise<Record<string, ArchiveObjectRewrite>> {
  const bucket = admin.storage().bucket();
  const rewriteMap: Record<string, ArchiveObjectRewrite> = {};

  for (const [hash, archiveDoc] of params.plan.copiable) {
    const targetMetadata = metadataFromArchiveDoc(archiveDoc);
    const targetPath = buildCanonicalUploadPath(params.targetUid, targetMetadata);
    const token = ensureDownloadToken();
    let targetUrl =
      params.plan.targetArchiveDocs.get(hash)?.url ??
      buildDownloadUrl(bucket.name, targetPath, token);

    if (params.plan.missingForTarget.has(hash)) {
      await createPendingArchiveReservation(params.targetUid, targetMetadata);
      await bucket.file(archiveDoc.path).copy(bucket.file(targetPath));
      await bucket.file(targetPath).setMetadata({
        contentType: archiveDoc.contentType,
        metadata: {
          published: "true",
          firebaseStorageDownloadTokens: token,
        },
      });
      targetUrl = buildDownloadUrl(bucket.name, targetPath, token);
    }

    rewriteMap[hash] = {
      oldHash: hash,
      oldUrl: archiveDoc.url,
      newHash: hash,
      newUrl: targetUrl,
    };
  }

  return rewriteMap;
}

function metadataFromArchiveDoc(doc: UploadArchiveDoc): UploadMetadata {
  return {
    kind: doc.kind as UploadMetadata["kind"],
    hash: doc.hash,
    ext: doc.ext,
    size: doc.size,
    contentType: doc.contentType,
    displayName: doc.displayName ?? `${doc.hash}.${doc.ext}`,
  };
}
