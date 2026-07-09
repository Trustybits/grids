import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { hashStorageObject } from "../utils_storageHash.js";

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const CANONICAL_IMAGE_PATH = `users/user-1/images/${HASH}.png`;

const { firestoreState, storageState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
    delete: vi.fn(() => ({ __op: "delete" })),
  };
  return {
    FieldValue,
    firestoreState: {
      docs: new Map<string, Record<string, unknown>>(),
      transactionShouldThrow: false,
      txGetCalls: [] as string[],
      txSetCalls: [] as Array<{
        path: string;
        data: Record<string, unknown>;
        options?: Record<string, unknown>;
      }>,
      txUpdateCalls: [] as Array<{
        path: string;
        data: Record<string, unknown>;
      }>,
      directSetCalls: [] as Array<{
        path: string;
        data: Record<string, unknown>;
        options?: Record<string, unknown>;
      }>,
    },
    storageState: {
      setMetadataCalls: [] as Array<{ path: string; metadata: unknown }>,
      deleteCalls: [] as Array<{ path: string; options?: unknown }>,
    },
  };
});

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    storage: {
      object: () => ({
        onFinalize: (handler: unknown) => handler,
      }),
    },
  })),
}));

vi.mock("firebase-functions/logger", () => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../../admin.js", () => {
  const firestore = () => ({
    collection: (collectionName: string) => ({
      doc: (docId: string) => ({
        path: `${collectionName}/${docId}`,
        collection: (subcollectionName: string) => ({
          doc: (subDocId: string) => ({
            path: `${collectionName}/${docId}/${subcollectionName}/${subDocId}`,
            set: (
              data: Record<string, unknown>,
              options?: Record<string, unknown>,
            ) => {
              firestoreState.directSetCalls.push({
                path: `${collectionName}/${docId}/${subcollectionName}/${subDocId}`,
                data,
                options,
              });
            },
          }),
        }),
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
  });
  firestore.FieldValue = FieldValue;

  return {
    default: {
      firestore,
      storage: () => ({
        bucket: (bucketName?: string) => ({
          name: bucketName ?? "test-bucket",
          file: (path: string) => ({
            setMetadata: async (metadata: unknown) => {
              storageState.setMetadataCalls.push({ path, metadata });
            },
            delete: async (options?: unknown) => {
              storageState.deleteCalls.push({ path, options });
            },
          }),
        }),
      }),
    },
  };
});

vi.mock("../utils_storageHash.js", () => ({
  hashStorageObject: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

import { onFileUploaded as handlerExport } from "../onTrigger_fileUploaded.js";

const onFileUploaded = handlerExport as unknown as (object: {
  name?: string;
  size?: string;
  bucket: string;
  contentType?: string;
  metadata?: Record<string, string>;
}) => Promise<unknown>;

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.transactionShouldThrow = false;
  firestoreState.txGetCalls = [];
  firestoreState.txSetCalls = [];
  firestoreState.txUpdateCalls = [];
  firestoreState.directSetCalls = [];
  storageState.setMetadataCalls = [];
  storageState.deleteCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(hashStorageObject).mockReset().mockResolvedValue(HASH);
  vi.mocked(logger.debug).mockClear();
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
  vi.mocked(logger.warn).mockClear();
  FieldValue.serverTimestamp.mockClear();
  FieldValue.delete.mockClear();
});

describe("onFileUploaded", () => {
  it("returns null without reading object data when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(
      onFileUploaded({
        name: CANONICAL_IMAGE_PATH,
        size: "10",
        bucket: "test-bucket",
      }),
    ).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("onFileUploaded");
    expect(hashStorageObject).not.toHaveBeenCalled();
  });

  it("skips objects with no file path or noncanonical paths", async () => {
    await expect(onFileUploaded({ size: "10", bucket: "test-bucket" })).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith("File path is undefined");

    await expect(
      onFileUploaded({
        name: "users/user-1/images/original-name.png",
        size: "10",
        bucket: "test-bucket",
      }),
    ).resolves.toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      "File is not a canonical user upload, skipping storage tracking",
      { filePath: "users/user-1/images/original-name.png" },
    );
    expect(hashStorageObject).not.toHaveBeenCalled();
  });

  it("activates a pending archive doc and increments storageUsed once", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, {
      uid: "user-1",
      hash: HASH,
      kind: "images",
      path: CANONICAL_IMAGE_PATH,
      size: 25,
      contentType: "image/png",
      ext: "png",
      status: "pending",
      refCount: 0,
      shareable: false,
    });

    await onFileUploaded({
      name: CANONICAL_IMAGE_PATH,
      size: "25",
      bucket: "test-bucket",
      contentType: "image/png",
      metadata: { published: "true" },
    });

    expect(hashStorageObject).toHaveBeenCalledWith(
      CANONICAL_IMAGE_PATH,
      "test-bucket",
    );
    expect(storageState.setMetadataCalls).toHaveLength(1);
    expect(firestoreState.txSetCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: `users/user-1/uploads/${HASH}`,
          data: expect.objectContaining({
            status: "active",
            shareable: false,
            refCount: 0,
          }),
          options: { merge: true },
        }),
      ]),
    );
    expect(firestoreState.txUpdateCalls).toEqual([
      { path: "users/user-1", data: { storageUsed: 125 } },
    ]);
  });

  it("does not double-count an already active archive doc", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, {
      uid: "user-1",
      hash: HASH,
      kind: "images",
      path: CANONICAL_IMAGE_PATH,
      url: "https://cdn/existing.png",
      size: 25,
      contentType: "image/png",
      ext: "png",
      status: "active",
      refCount: 2,
      shareable: false,
    });

    await onFileUploaded({
      name: CANONICAL_IMAGE_PATH,
      size: "25",
      bucket: "test-bucket",
      contentType: "image/png",
    });

    expect(firestoreState.txUpdateCalls).toEqual([]);
  });

  it("marks hash mismatches failed, deletes the object, and does not increment usage", async () => {
    vi.mocked(hashStorageObject).mockResolvedValue(OTHER_HASH);

    await onFileUploaded({
      name: CANONICAL_IMAGE_PATH,
      size: "25",
      bucket: "test-bucket",
      contentType: "image/png",
    });

    expect(firestoreState.directSetCalls).toEqual([
      expect.objectContaining({
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({
          status: "failed",
          failureReason: "hash-mismatch",
        }),
        options: { merge: true },
      }),
    ]);
    expect(storageState.deleteCalls).toEqual([
      { path: CANONICAL_IMAGE_PATH, options: { ignoreNotFound: true } },
    ]);
    expect(storageState.setMetadataCalls).toEqual([
      {
        path: CANONICAL_IMAGE_PATH,
        metadata: {
          metadata: {
            gridsStorageSkipAccounting: "true",
          },
        },
      },
    ]);
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });

  it("marks metadata mismatches failed, deletes without accounting, and does not increment usage", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, {
      uid: "user-1",
      hash: HASH,
      kind: "images",
      path: CANONICAL_IMAGE_PATH,
      size: 25,
      contentType: "image/jpeg",
      ext: "png",
      status: "pending",
      refCount: 0,
      shareable: false,
    });

    await onFileUploaded({
      name: CANONICAL_IMAGE_PATH,
      size: "25",
      bucket: "test-bucket",
      contentType: "image/png",
    });

    expect(firestoreState.txSetCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: `users/user-1/uploads/${HASH}`,
          data: expect.objectContaining({
            status: "failed",
            failureReason: "metadata-mismatch",
          }),
          options: { merge: true },
        }),
      ]),
    );
    expect(storageState.deleteCalls).toEqual([
      { path: CANONICAL_IMAGE_PATH, options: { ignoreNotFound: true } },
    ]);
    expect(storageState.setMetadataCalls).toEqual([
      expect.objectContaining({ path: CANONICAL_IMAGE_PATH }),
      {
        path: CANONICAL_IMAGE_PATH,
        metadata: {
          metadata: {
            gridsStorageSkipAccounting: "true",
          },
        },
      },
    ]);
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });
});
