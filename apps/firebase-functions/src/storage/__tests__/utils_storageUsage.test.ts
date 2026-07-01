import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";

const { firestoreState } = vi.hoisted(() => ({
  firestoreState: {
    docs: new Map<string, Record<string, unknown>>(),
    transactionShouldThrow: false,
    txGetCalls: [] as string[],
    txSetCalls: [] as Array<{
      path: string;
      data: Record<string, unknown>;
      options?: Record<string, unknown>;
    }>,
    txUpdateCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
    directSetCalls: [] as Array<{
      path: string;
      data: Record<string, unknown>;
      options?: Record<string, unknown>;
    }>,
  },
}));

vi.mock("firebase-functions/logger", () => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
      collection: (collectionName: string) => ({
        doc: (docId: string) => ({
          path: `${collectionName}/${docId}`,
          set: (
            data: Record<string, unknown>,
            options?: Record<string, unknown>,
          ) => {
            firestoreState.directSetCalls.push({
              path: `${collectionName}/${docId}`,
              data,
              options,
            });
          },
        }),
      }),
      runTransaction: async (
        callback: (transaction: unknown) => Promise<unknown>,
      ) => {
        if (firestoreState.transactionShouldThrow) {
          throw new Error("transaction failed");
        }

        const transaction = {
          get: async (ref: { path: string }) => {
            firestoreState.txGetCalls.push(ref.path);
            const data = firestoreState.docs.get(ref.path);
            return {
              exists: data !== undefined,
              data: () => data,
            };
          },
          set: (
            ref: { path: string },
            data: Record<string, unknown>,
            options?: Record<string, unknown>,
          ) => {
            firestoreState.txSetCalls.push({ path: ref.path, data, options });
          },
          update: (ref: { path: string }, data: Record<string, unknown>) => {
            firestoreState.txUpdateCalls.push({ path: ref.path, data });
          },
        };

        return callback(transaction);
      },
    }),
  },
}));

import {
  decrementUserStorageUsage,
  incrementUserStorageUsage,
  parseUserStorageObject,
  setUserStorageUsed,
} from "../utils_storageUsage.js";

const HASH = "a".repeat(64);
const CANONICAL_IMAGE_PATH = `users/user-1/images/${HASH}.png`;

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.transactionShouldThrow = false;
  firestoreState.txGetCalls = [];
  firestoreState.txSetCalls = [];
  firestoreState.txUpdateCalls = [];
  firestoreState.directSetCalls = [];
  vi.mocked(logger.debug).mockClear();
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
  vi.mocked(logger.warn).mockClear();
});

describe("parseUserStorageObject", () => {
  it("extracts user id, file path, and parsed byte size for user files", () => {
    expect(
      parseUserStorageObject({
        name: CANONICAL_IMAGE_PATH,
        size: "25",
      }),
    ).toEqual({
      filePath: CANONICAL_IMAGE_PATH,
      fileSize: 25,
      hash: HASH,
      userId: "user-1",
    });
  });

  it("treats missing size as zero bytes", () => {
    expect(
      parseUserStorageObject({
        name: CANONICAL_IMAGE_PATH,
      }),
    ).toMatchObject({ fileSize: 0 });
  });

  it("sanitizes unparsable size when requested", () => {
    expect(
      parseUserStorageObject(
        {
          name: CANONICAL_IMAGE_PATH,
          size: "not-a-number",
        },
        { sanitizeInvalidSize: true },
      ),
    ).toMatchObject({ fileSize: 0 });
  });

  it("skips objects with no file path", () => {
    expect(parseUserStorageObject({ size: "10" })).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith("File path is undefined");
  });

  it("skips objects outside the users directory", () => {
    expect(
      parseUserStorageObject({
        name: "public/file.png",
        size: "10",
      }),
    ).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      "File is not a canonical user upload, skipping storage tracking",
      { filePath: "public/file.png" },
    );
  });

  it("skips legacy user subfolders that are not canonical archive paths", () => {
    expect(
      parseUserStorageObject({
        name: "users/user-1/link-images/image-1.png",
        size: "40",
      }),
    ).toBeNull();
  });

  it("skips migration-tagged objects", () => {
    expect(
      parseUserStorageObject({
        name: CANONICAL_IMAGE_PATH,
        size: "40",
        metadata: { gridsStorageMigration: "true" },
      }),
    ).toBeNull();
  });
});

describe("incrementUserStorageUsage", () => {
  it("increments storageUsed for an existing user", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });

    await incrementUserStorageUsage("user-1", 25);

    expect(firestoreState.txGetCalls).toEqual(["users/user-1"]);
    expect(firestoreState.txUpdateCalls).toEqual([
      { path: "users/user-1", data: { storageUsed: 125 } },
    ]);
    expect(firestoreState.txSetCalls).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith("Storage usage updated", {
      userId: "user-1",
      previousUsage: 100,
      newUsage: 125,
      fileSize: 25,
    });
  });

  it("creates a merged storage counter when the user document is missing", async () => {
    await incrementUserStorageUsage("user-1", 25);

    expect(firestoreState.txSetCalls).toEqual([
      {
        path: "users/user-1",
        data: { storageUsed: 25 },
        options: { merge: true },
      },
    ]);
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });
});

describe("decrementUserStorageUsage", () => {
  it("decrements storageUsed for an existing user", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });

    await decrementUserStorageUsage("user-1", 25);

    expect(firestoreState.txGetCalls).toEqual(["users/user-1"]);
    expect(firestoreState.txUpdateCalls).toEqual([
      { path: "users/user-1", data: { storageUsed: 75 } },
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      "Storage usage updated after deletion",
      {
        userId: "user-1",
        previousUsage: 100,
        newUsage: 75,
        fileSize: 25,
      },
    );
  });

  it("clamps decremented storageUsed to zero", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 10 });

    await decrementUserStorageUsage("user-1", 25);

    expect(firestoreState.txUpdateCalls).toEqual([
      { path: "users/user-1", data: { storageUsed: 0 } },
    ]);
  });

  it("does not update when the user document is missing", async () => {
    await decrementUserStorageUsage("user-1", 25);

    expect(logger.warn).toHaveBeenCalledWith(
      "User document does not exist, cannot decrement storage",
      { userId: "user-1" },
    );
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });
});

describe("setUserStorageUsed", () => {
  it("sets a clamped authoritative storageUsed value", async () => {
    await setUserStorageUsed("user-1", -25);

    expect(firestoreState.directSetCalls).toEqual([
      {
        path: "users/user-1",
        data: { storageUsed: 0 },
        options: { merge: true },
      },
    ]);
  });
});
