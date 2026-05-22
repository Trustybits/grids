import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

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
  },
}));

vi.mock("firebase-functions/v1", () => ({
  storage: {
    object: () => ({
      onFinalize: (handler: unknown) => handler,
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

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

import { onFileUploaded as handlerExport } from "../onTrigger_fileUploaded.js";

const onFileUploaded = handlerExport as unknown as (object: {
  name?: string;
  size?: string;
}) => Promise<unknown>;

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.transactionShouldThrow = false;
  firestoreState.txGetCalls = [];
  firestoreState.txSetCalls = [];
  firestoreState.txUpdateCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.debug).mockClear();
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
  vi.mocked(logger.warn).mockClear();
});

describe("onFileUploaded", () => {
  it("returns null without reading object data when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(onFileUploaded({ name: "users/user-1/file.png", size: "10" })).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("onFileUploaded");
    expect(firestoreState.txGetCalls).toEqual([]);
  });

  it("skips objects with no file path", async () => {
    await expect(onFileUploaded({ size: "10" })).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith("File path is undefined");
    expect(firestoreState.txGetCalls).toEqual([]);
  });

  it("skips objects outside the users directory", async () => {
    await expect(onFileUploaded({ name: "public/file.png", size: "10" })).resolves.toBeNull();

    expect(logger.debug).toHaveBeenCalledWith(
      "File is not in a user directory, skipping storage tracking",
      { filePath: "public/file.png" },
    );
    expect(firestoreState.txGetCalls).toEqual([]);
  });

  it("increments storageUsed for an existing user", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });

    await expect(onFileUploaded({ name: "users/user-1/images/a.png", size: "25" })).resolves.toBeNull();

    expect(firestoreState.txUpdateCalls).toEqual([
      { path: "users/user-1", data: { storageUsed: 125 } },
    ]);
    expect(firestoreState.txSetCalls).toEqual([]);
  });

  it("creates a user storage counter when the user document is missing", async () => {
    await onFileUploaded({ name: "users/user-1/images/a.png", size: "25" });

    expect(firestoreState.txSetCalls).toEqual([
      {
        path: "users/user-1",
        data: { storageUsed: 25 },
        options: { merge: true },
      },
    ]);
  });

  it("treats a missing size as zero bytes and leaves storageUsed unchanged", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });

    await onFileUploaded({ name: "users/user-1/images/a.png" });

    expect(firestoreState.txUpdateCalls).toEqual([
      { path: "users/user-1", data: { storageUsed: 100 } },
    ]);
  });

  it("does not corrupt storageUsed to NaN when the size is unparsable", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });

    await onFileUploaded({ name: "users/user-1/images/b.png", size: "not-a-number" });

    const written = firestoreState.txUpdateCalls[0]?.data.storageUsed
      ?? (firestoreState.txSetCalls[0]?.data as { storageUsed?: number } | undefined)?.storageUsed;
    expect(Number.isFinite(written as number)).toBe(true);
    expect(written).toBe(100);
  });

  it("logs and returns null when the transaction fails", async () => {
    firestoreState.transactionShouldThrow = true;

    await expect(onFileUploaded({ name: "users/user-1/a.png", size: "10" })).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalledWith("Failed to update storage usage on upload", {
      error: "Error: transaction failed",
      userId: "user-1",
      filePath: "users/user-1/a.png",
      fileSize: 10,
    });
  });
});
