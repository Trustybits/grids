import { randomUUID } from "node:crypto";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import {
  STORAGE_QUOTA_BYTES,
  buildCanonicalUploadPath,
  type UploadMetadata,
} from "./utils_uploadPaths.js";

export type UploadArchiveStatus = "pending" | "active" | "failed";

export type UploadArchiveDoc = {
  uid: string;
  hash: string;
  kind: string;
  path: string;
  url?: string;
  displayName?: string;
  size: number;
  contentType: string;
  ext: string;
  status: UploadArchiveStatus;
  refCount: number;
  shareable: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  activatedAt?: unknown;
  failedAt?: unknown;
  failureReason?: string;
};

function fieldValue() {
  return admin.firestore.FieldValue;
}

export function uploadArchiveRef(uid: string, hash: string) {
  return admin
    .firestore()
    .collection("users")
    .doc(uid)
    .collection("uploads")
    .doc(hash);
}

export function buildDownloadUrl(
  bucketName: string,
  path: string,
  token?: string,
): string {
  const base =
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/` +
    `${encodeURIComponent(path)}?alt=media`;
  return token ? `${base}&token=${encodeURIComponent(token)}` : base;
}

export function ensureDownloadToken(metadata: Record<string, unknown> = {}) {
  const existing = metadata.firebaseStorageDownloadTokens;
  return typeof existing === "string" && existing
    ? existing.split(",")[0] ?? existing
    : randomUUID();
}

export async function assertUserHasStorageQuota(
  uid: string,
  additionalBytes: number,
): Promise<void> {
  if (additionalBytes <= 0) return;

  const userSnap = await admin.firestore().collection("users").doc(uid).get();
  const data = userSnap.data() ?? {};
  if (data.isDevAccount === true) return;

  const currentUsage =
    typeof data.storageUsed === "number" ? data.storageUsed : 0;
  if (currentUsage + additionalBytes > STORAGE_QUOTA_BYTES) {
    throw new HttpsError(
      "resource-exhausted",
      "This upload would exceed your storage quota.",
    );
  }
}

export async function authorizeUploadReservation(
  uid: string,
  metadata: UploadMetadata,
): Promise<{
  uploadRequired: boolean;
  path: string;
  hash: string;
  url?: string;
  status?: UploadArchiveStatus;
}> {
  const path = buildCanonicalUploadPath(uid, metadata);
  const ref = uploadArchiveRef(uid, metadata.hash);

  return admin.firestore().runTransaction(async (tx) => {
    const assertQuotaAvailable = async () => {
      const userSnap = await tx.get(admin.firestore().collection("users").doc(uid));
      const userData = userSnap.data() ?? {};
      if (userData.isDevAccount !== true) {
        const currentUsage =
          typeof userData.storageUsed === "number" ? userData.storageUsed : 0;
        if (currentUsage + metadata.size > STORAGE_QUOTA_BYTES) {
          throw new HttpsError(
            "resource-exhausted",
            "This upload would exceed your storage quota.",
          );
        }
      }
    };

    const snap = await tx.get(ref);
    if (snap.exists) {
      const existing = snap.data() as Partial<UploadArchiveDoc>;
      assertArchiveMetadataMatches(existing, metadata);

      if (existing.status === "active") {
        if (!existing.url) {
          throw new HttpsError(
            "failed-precondition",
            "Archived upload is missing its URL.",
          );
        }
        return {
          uploadRequired: false,
          path: existing.path ?? path,
          hash: metadata.hash,
          url: existing.url,
          status: "active" as const,
        };
      }

      await assertQuotaAvailable();

      if (existing.status === "failed") {
        tx.set(
          ref,
          {
            ...baseArchiveReservation(uid, metadata, path),
            displayName: resolveArchiveDisplayName(existing, metadata),
            createdAt: existing.createdAt ?? fieldValue().serverTimestamp(),
            updatedAt: fieldValue().serverTimestamp(),
            failedAt: fieldValue().delete(),
            failureReason: fieldValue().delete(),
          },
          { merge: true },
        );
      } else {
        tx.set(
          ref,
          { status: "pending", updatedAt: fieldValue().serverTimestamp() },
          { merge: true },
        );
      }

      return {
        uploadRequired: true,
        path,
        hash: metadata.hash,
        status: "pending" as const,
      };
    }

    await assertQuotaAvailable();
    tx.set(ref, baseArchiveReservation(uid, metadata, path));

    return {
      uploadRequired: true,
      path,
      hash: metadata.hash,
      status: "pending" as const,
    };
  });
}

export async function createPendingArchiveReservation(
  uid: string,
  metadata: UploadMetadata,
): Promise<{ path: string }> {
  const path = buildCanonicalUploadPath(uid, metadata);
  const ref = uploadArchiveRef(uid, metadata.hash);
  await ref.set(
    {
      ...baseArchiveReservation(uid, metadata, path),
      failedAt: fieldValue().delete(),
      failureReason: fieldValue().delete(),
    },
    { merge: true },
  );
  return { path };
}

export async function finalizeUploadArchiveDoc(params: {
  uid: string;
  metadata: UploadMetadata;
  bucketName: string;
  token?: string;
}): Promise<{
  activated: boolean;
  reason?: "already-active" | "missing-reservation" | "metadata-mismatch";
  url?: string;
}> {
  const path = buildCanonicalUploadPath(params.uid, params.metadata);
  const url = buildDownloadUrl(params.bucketName, path, params.token);
  const ref = uploadArchiveRef(params.uid, params.metadata.hash);

  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { activated: false, reason: "missing-reservation" as const };
    }

    const existing = snap.data() as Partial<UploadArchiveDoc>;
    if (existing.status === "active") {
      return {
        activated: false,
        reason: "already-active" as const,
        url: existing.url,
      };
    }

    if (!archiveMetadataMatches(existing, params.metadata)) {
      tx.set(
        ref,
        {
          status: "failed",
          failureReason: "metadata-mismatch",
          failedAt: fieldValue().serverTimestamp(),
          updatedAt: fieldValue().serverTimestamp(),
        },
        { merge: true },
      );
      return { activated: false, reason: "metadata-mismatch" as const };
    }

    tx.set(
      ref,
      {
        uid: params.uid,
        hash: params.metadata.hash,
        kind: params.metadata.kind,
        path,
        url,
        displayName: resolveArchiveDisplayName(existing, params.metadata),
        size: params.metadata.size,
        contentType: params.metadata.contentType,
        ext: params.metadata.ext,
        status: "active",
        refCount: typeof existing.refCount === "number" ? existing.refCount : 0,
        shareable: existing.shareable === true ? true : false,
        activatedAt: fieldValue().serverTimestamp(),
        updatedAt: fieldValue().serverTimestamp(),
        failureReason: fieldValue().delete(),
      },
      { merge: true },
    );

    return { activated: true, url };
  });
}

export async function markUploadFailed(
  uid: string,
  hash: string,
  reason: string,
): Promise<void> {
  await uploadArchiveRef(uid, hash).set(
    {
      status: "failed",
      failureReason: reason,
      failedAt: fieldValue().serverTimestamp(),
      updatedAt: fieldValue().serverTimestamp(),
    },
    { merge: true },
  );
}

export async function adjustUploadRefCounts(
  uid: string,
  deltas: Map<string, number>,
): Promise<void> {
  if (deltas.size === 0) return;

  await admin.firestore().runTransaction(async (tx) => {
    const entries = [...deltas.entries()].filter(([, delta]) => delta !== 0);
    const snaps = await Promise.all(
      entries.map(([hash]) => tx.get(uploadArchiveRef(uid, hash))),
    );

    entries.forEach(([hash, delta], index) => {
      const snap = snaps[index];
      if (!snap?.exists) {
        logger.warn(
          "Skipping upload refCount adjustment because archive doc is missing",
          { uid, hash, delta },
        );
        return;
      }
      const current = (snap.data()?.refCount as number | undefined) ?? 0;
      const next = current + delta;
      if (next < 0) {
        logger.warn("Clamping upload refCount adjustment below zero", {
          uid,
          hash,
          current,
          delta,
          attempted: next,
        });
      }
      tx.update(uploadArchiveRef(uid, hash), {
        refCount: Math.max(0, next),
        updatedAt: fieldValue().serverTimestamp(),
      });
    });
  });
}

export async function readUploadArchiveDoc(uid: string, hash: string) {
  const snap = await uploadArchiveRef(uid, hash).get();
  return snap.exists ? (snap.data() as UploadArchiveDoc) : null;
}

export function assertArchiveMetadataMatches(
  existing: Partial<UploadArchiveDoc>,
  metadata: UploadMetadata,
): void {
  if (!archiveMetadataMatches(existing, metadata)) {
    throw new HttpsError(
      "already-exists",
      "An upload with this hash already exists with different metadata.",
    );
  }
}

function archiveMetadataMatches(
  existing: Partial<UploadArchiveDoc>,
  metadata: UploadMetadata,
): boolean {
  return (
    existing.kind === metadata.kind &&
    existing.size === metadata.size &&
    existing.contentType === metadata.contentType &&
    existing.ext === metadata.ext
  );
}

function baseArchiveReservation(
  uid: string,
  metadata: UploadMetadata,
  path: string,
) {
  return {
    uid,
    hash: metadata.hash,
    kind: metadata.kind,
    path,
    displayName: metadata.displayName ?? fallbackDisplayName(metadata),
    size: metadata.size,
    contentType: metadata.contentType,
    ext: metadata.ext,
    status: "pending",
    refCount: 0,
    shareable: false,
    createdAt: fieldValue().serverTimestamp(),
    updatedAt: fieldValue().serverTimestamp(),
  };
}

function resolveArchiveDisplayName(
  existing: Partial<UploadArchiveDoc>,
  metadata: UploadMetadata,
): string {
  return typeof existing.displayName === "string" && existing.displayName.trim()
    ? existing.displayName
    : metadata.displayName ?? fallbackDisplayName(metadata);
}

function fallbackDisplayName(metadata: UploadMetadata): string {
  return `${metadata.hash}.${metadata.ext}`;
}
