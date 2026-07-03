import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { parseCanonicalUploadPath } from "./utils_uploadPaths.js";

type StorageObjectLike = {
  name?: string;
  size?: string;
  metadata?: Record<string, string | undefined>;
};

type ParseOptions = {
  sanitizeInvalidSize?: boolean;
};

export type UserStorageObjectInfo = {
  filePath: string;
  fileSize: number;
  userId: string;
  hash: string;
};

export const SKIP_STORAGE_ACCOUNTING_METADATA_KEY =
  "gridsStorageSkipAccounting";

export function isMigrationTaggedObject(object: StorageObjectLike): boolean {
  const metadata = object.metadata ?? {};
  return (
    metadata.gridsStorageMigration === "true" ||
    metadata.storageMigration === "true" ||
    metadata[SKIP_STORAGE_ACCOUNTING_METADATA_KEY] === "true"
  );
}

export function parseUserStorageObject(
  object: StorageObjectLike,
  options: ParseOptions = {},
): UserStorageObjectInfo | null {
  const filePath = object.name;
  const parsedSize = parseInt(object.size || "0", 10);
  const fileSize =
    options.sanitizeInvalidSize && !Number.isFinite(parsedSize)
      ? 0
      : parsedSize;

  if (!filePath) {
    logger.warn("File path is undefined");
    return null;
  }

  if (isMigrationTaggedObject(object)) {
    logger.debug("Migration-tagged storage object skipped", { filePath });
    return null;
  }

  const parsedPath = parseCanonicalUploadPath(filePath);
  if (!parsedPath) {
    logger.debug(
      "File is not a canonical user upload, skipping storage tracking",
      { filePath },
    );
    return null;
  }

  return {
    filePath,
    fileSize,
    hash: parsedPath.hash,
    userId: parsedPath.uid,
  };
}

export async function incrementUserStorageUsage(
  userId: string,
  fileSize: number,
): Promise<void> {
  const userRef = admin.firestore().collection("users").doc(userId);

  await admin.firestore().runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    const currentUsage =
      userDoc.exists && userDoc.data()?.storageUsed
        ? (userDoc.data()?.storageUsed as number)
        : 0;

    const newUsage = currentUsage + fileSize;

    if (userDoc.exists) {
      transaction.update(userRef, { storageUsed: newUsage });
    } else {
      transaction.set(userRef, { storageUsed: newUsage }, { merge: true });
    }

    logger.info("Storage usage updated", {
      userId,
      previousUsage: currentUsage,
      newUsage,
      fileSize,
    });
  });
}

export async function decrementUserStorageUsage(
  userId: string,
  fileSize: number,
): Promise<void> {
  const userRef = admin.firestore().collection("users").doc(userId);

  await admin.firestore().runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      logger.warn(
        "User document does not exist, cannot decrement storage",
        { userId },
      );
      return;
    }

    const currentUsage = userDoc.data()?.storageUsed || 0;
    const newUsage = Math.max(0, currentUsage - fileSize);

    transaction.update(userRef, { storageUsed: newUsage });

    logger.info("Storage usage updated after deletion", {
      userId,
      previousUsage: currentUsage,
      newUsage,
      fileSize,
    });
  });
}

export async function setUserStorageUsed(
  userId: string,
  bytes: number,
): Promise<void> {
  const storageUsed = Math.max(0, bytes);
  await admin.firestore().collection("users").doc(userId).set(
    { storageUsed },
    { merge: true },
  );
  logger.info("Storage usage set authoritatively", {
    userId,
    storageUsed,
  });
}
