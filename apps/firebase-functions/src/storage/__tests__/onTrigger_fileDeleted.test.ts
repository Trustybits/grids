import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const HASH = "a".repeat(64);
const CANONICAL_IMAGE_PATH = `users/user-1/images/${HASH}.png`;

const { firestoreState } = vi.hoisted(() => ({
  firestoreState: {
    docs: new Map<string, Record<string, unknown>>(),
    transactionShouldThrow: false,
    txGetCalls: [] as string[],
    txUpdateCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  },
}));

vi.mock("firebase-functions/v1", () => ({
  storage: {
    object: () => ({
      onDelete: (handler: unknown) => handler,
    }),
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
        doc: (docId: string) => ({ path: `${collectionName}/${docId}` }),
      }),
      runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) => {
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
          update: (ref: { path: string }, data: Record<string, unknown>) => {
            firestoreState.txUpdateCalls.push({ path: ref.path, data });
          },
        };
        return callback(transaction);
      },
    }),
  },
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

import { onFileDeleted as handlerExport } from "../onTrigger_fileDeleted.js";

const onFileDeleted = handlerExport as unknown as (object: {
  name?: string;
  size?: string;
  metadata?: Record<string, string>;
}) => Promise<unknown>;

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.transactionShouldThrow = false;
  firestoreState.txGetCalls = [];
  firestoreState.txUpdateCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.debug).mockClear();
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
  vi.mocked(logger.warn).mockClear();
});

describe("onFileDeleted", () => {
  it("returns null without reading object data when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(onFileDeleted({ name: "users/user-1/file.png", size: "10" })).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("onFileDeleted");
    expect(firestoreState.txGetCalls).toEqual([]);
  });

  it("skips objects with no file path or outside the users directory", async () => {
    await onFileDeleted({ size: "10" });
    expect(logger.warn).toHaveBeenCalledWith("File path is undefined");

    await onFileDeleted({ name: "public/file.png", size: "10" });
    expect(logger.debug).toHaveBeenCalledWith(
      "File is not a canonical user upload, skipping storage tracking",
      { filePath: "public/file.png" },
    );
    expect(firestoreState.txGetCalls).toEqual([]);
  });

  it("skips objects tagged to bypass storage accounting", async () => {
    await onFileDeleted({
      name: CANONICAL_IMAGE_PATH,
      size: "25",
      metadata: { gridsStorageSkipAccounting: "true" },
    });

    expect(firestoreState.txGetCalls).toEqual([]);
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });

  it("decrements storageUsed for an existing user", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });

    await onFileDeleted({ name: CANONICAL_IMAGE_PATH, size: "25" });

    expect(firestoreState.txUpdateCalls).toEqual([
      { path: "users/user-1", data: { storageUsed: 75 } },
    ]);
  });

  it("does not decrement below zero", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 10 });

    await onFileDeleted({ name: CANONICAL_IMAGE_PATH, size: "25" });

    expect(firestoreState.txUpdateCalls).toEqual([
      { path: "users/user-1", data: { storageUsed: 0 } },
    ]);
  });

  it("does not corrupt storageUsed to NaN when the size is unparsable", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });

    await onFileDeleted({
      name: CANONICAL_IMAGE_PATH,
      size: "not-a-number",
    });

    const written = firestoreState.txUpdateCalls[0]?.data.storageUsed;
    expect(Number.isFinite(written as number)).toBe(true);
    expect(written).toBe(100);
  });

  it("does not update when the user document is missing", async () => {
    await onFileDeleted({ name: CANONICAL_IMAGE_PATH, size: "25" });

    expect(logger.warn).toHaveBeenCalledWith(
      "User document does not exist, cannot decrement storage",
      { userId: "user-1" },
    );
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });

  it("logs and returns null when the transaction fails", async () => {
    firestoreState.transactionShouldThrow = true;

    await expect(onFileDeleted({ name: CANONICAL_IMAGE_PATH, size: "10" })).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalledWith("Failed to update storage usage on deletion", {
      error: "Error: transaction failed",
      userId: "user-1",
      filePath: CANONICAL_IMAGE_PATH,
      fileSize: 10,
    });
  });
});
