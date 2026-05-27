import * as logger from "firebase-functions/logger";
import admin from "../admin.js";

type StorageObjectLike = {
  name?: string;
  size?: string;
};

type ParseOptions = {
  sanitizeInvalidSize?: boolean;
};

export type UserStorageObjectInfo = {
  filePath: string;
  fileSize: number;
  userId: string;
};

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

  const pathParts = filePath.split("/");
  if (pathParts.length < 2 || pathParts[0] !== "users") {
    logger.debug(
      "File is not in a user directory, skipping storage tracking",
      { filePath },
    );
    return null;
  }

  return {
    filePath,
    fileSize,
    userId: pathParts[1],
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
