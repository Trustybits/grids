import { beforeEach, describe, expect, it, vi } from "vitest";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const HASH = "a".repeat(64);
const PATH = `users/user-1/images/${HASH}.png`;

const { firestoreState, storageState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
    delete: vi.fn(() => ({ __op: "delete" })),
  };
  return {
    FieldValue,
    firestoreState: {
      docs: new Map<string, Record<string, unknown>>(),
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
      directUpdateCalls: [] as Array<{
        path: string;
        data: Record<string, unknown>;
      }>,
      directDeleteCalls: [] as string[],
    },
    storageState: {
      deleteCalls: [] as Array<{ path: string; options?: unknown }>,
    },
  };
});

vi.mock("firebase-functions/v1", () => ({
  https: {
    onCall: (handler: unknown) => handler,
  },
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../../admin.js", () => {
  function docRef(path: string) {
    return {
      path,
      collection: (subcollectionName: string) => ({
        doc: (subDocId: string) => docRef(`${path}/${subcollectionName}/${subDocId}`),
      }),
      get: async () => {
        const data = firestoreState.docs.get(path);
        return {
          exists: data !== undefined,
          data: () => data,
        };
      },
      update: async (data: Record<string, unknown>) => {
        firestoreState.directUpdateCalls.push({ path, data });
      },
      delete: async () => {
        firestoreState.directDeleteCalls.push(path);
      },
    };
  }

  const firestore = () => ({
    collection: (collectionName: string) => ({
      doc: (docId: string) => docRef(`${collectionName}/${docId}`),
    }),
    runTransaction: async (
      callback: (transaction: unknown) => Promise<unknown>,
    ) => {
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
        bucket: () => ({
          file: (path: string) => ({
            delete: async (options?: unknown) => {
              storageState.deleteCalls.push({ path, options });
            },
          }),
        }),
      }),
    },
  };
});

import { authorizeStorageUpload } from "../onCall_authorizeStorageUpload.js";
import { deleteStorageUpload } from "../onCall_deleteStorageUpload.js";
import { setStorageUploadShareable } from "../onCall_setStorageUploadShareable.js";

type Callable = (data: unknown, context: { auth?: { uid: string } }) => Promise<unknown>;

const authorize = authorizeStorageUpload as unknown as Callable;
const remove = deleteStorageUpload as unknown as Callable;
const setShareable = setStorageUploadShareable as unknown as Callable;

function metadata(overrides: Record<string, unknown> = {}) {
  return {
    kind: "images",
    hash: HASH,
    ext: "png",
    size: 25,
    contentType: "image/png",
    displayName: "photo.png",
    ...overrides,
  };
}

function activeArchive(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user-1",
    hash: HASH,
    kind: "images",
    path: PATH,
    url: "https://cdn/file.png",
    size: 25,
    contentType: "image/png",
    ext: "png",
    displayName: "photo.png",
    status: "active",
    refCount: 0,
    shareable: false,
    ...overrides,
  };
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.txGetCalls = [];
  firestoreState.txSetCalls = [];
  firestoreState.txUpdateCalls = [];
  firestoreState.directUpdateCalls = [];
  firestoreState.directDeleteCalls = [];
  storageState.deleteCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  FieldValue.serverTimestamp.mockClear();
  FieldValue.delete.mockClear();
});

describe("storage archive callables", () => {
  it("requires auth", async () => {
    await expect(authorize(metadata(), {})).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("returns an existing active upload without changing refCount or displayName", async () => {
    firestoreState.docs.set(
      `users/user-1/uploads/${HASH}`,
      activeArchive({ displayName: "original.png" }),
    );

    await expect(
      authorize(metadata({ displayName: "renamed.png" }), {
        auth: { uid: "user-1" },
      }),
    ).resolves.toMatchObject({
      uploadRequired: false,
      hash: HASH,
      path: PATH,
      url: "https://cdn/file.png",
    });

    expect(firestoreState.txUpdateCalls).toEqual([]);
    expect(firestoreState.txSetCalls).toEqual([]);
  });

  it("rejects a hash collision whose metadata does not match", async () => {
    firestoreState.docs.set(
      `users/user-1/uploads/${HASH}`,
      activeArchive({ size: 999 }),
    );

    await expect(
      authorize(metadata(), { auth: { uid: "user-1" } }),
    ).rejects.toMatchObject({ code: "already-exists" });
    expect(firestoreState.txSetCalls).toEqual([]);
  });

  it("rejects an active archive doc that is missing its URL", async () => {
    firestoreState.docs.set(
      `users/user-1/uploads/${HASH}`,
      activeArchive({ url: undefined }),
    );

    await expect(
      authorize(metadata(), { auth: { uid: "user-1" } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("refreshes an existing pending reservation without recreating it", async () => {
    firestoreState.docs.set(
      `users/user-1/uploads/${HASH}`,
      activeArchive({ status: "pending", url: undefined }),
    );

    await expect(
      authorize(metadata(), { auth: { uid: "user-1" } }),
    ).resolves.toMatchObject({ uploadRequired: true, status: "pending" });

    expect(firestoreState.txSetCalls).toEqual([
      expect.objectContaining({
        path: `users/user-1/uploads/${HASH}`,
        data: { status: "pending", updatedAt: { __op: "serverTimestamp" } },
        options: { merge: true },
      }),
    ]);
  });

  it("creates a pending reservation for a new upload", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });

    await expect(
      authorize(metadata(), { auth: { uid: "user-1" } }),
    ).resolves.toMatchObject({
      uploadRequired: true,
      hash: HASH,
      path: PATH,
      status: "pending",
    });

    expect(firestoreState.txSetCalls).toEqual([
      expect.objectContaining({
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({
          status: "pending",
          shareable: false,
          refCount: 0,
          displayName: "photo.png",
        }),
      }),
    ]);
  });

  it("retries failed reservations as pending and clears failure fields", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, {
      ...activeArchive(),
      status: "failed",
      failureReason: "hash-mismatch",
      failedAt: "old-failed-at",
    });

    await expect(
      authorize(metadata(), { auth: { uid: "user-1" } }),
    ).resolves.toMatchObject({
      uploadRequired: true,
      status: "pending",
    });

    expect(firestoreState.txSetCalls).toEqual([
      expect.objectContaining({
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({
          status: "pending",
          displayName: "photo.png",
          failedAt: { __op: "delete" },
          failureReason: { __op: "delete" },
        }),
        options: { merge: true },
      }),
    ]);
  });

  it("preserves the first displayName when retrying a failed reservation", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, {
      ...activeArchive({ displayName: "original.png" }),
      status: "failed",
      failureReason: "hash-mismatch",
      failedAt: "old-failed-at",
    });

    await expect(
      authorize(metadata({ displayName: "renamed.png" }), {
        auth: { uid: "user-1" },
      }),
    ).resolves.toMatchObject({
      uploadRequired: true,
      status: "pending",
    });

    expect(firestoreState.txSetCalls).toEqual([
      expect.objectContaining({
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({
          status: "pending",
          displayName: "original.png",
        }),
        options: { merge: true },
      }),
    ]);
  });

  it("re-checks quota before retrying failed reservations", async () => {
    firestoreState.docs.set("users/user-1", {
      storageUsed: 5_368_709_120,
      isDevAccount: false,
    });
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, {
      ...activeArchive(),
      status: "failed",
    });

    await expect(
      authorize(metadata(), { auth: { uid: "user-1" } }),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(firestoreState.txSetCalls).toEqual([]);
  });

  it("rejects over-quota uploads for non-dev users", async () => {
    firestoreState.docs.set("users/user-1", {
      storageUsed: 5_368_709_120,
      isDevAccount: false,
    });

    await expect(
      authorize(metadata(), { auth: { uid: "user-1" } }),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("allows over-quota upload reservations for dev accounts", async () => {
    firestoreState.docs.set("users/user-1", {
      storageUsed: 5_368_709_120,
      isDevAccount: true,
    });

    await expect(
      authorize(metadata(), { auth: { uid: "user-1" } }),
    ).resolves.toMatchObject({ uploadRequired: true });
  });

  it("updates only the shareable flag through the owner callable", async () => {
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, activeArchive());

    await expect(
      setShareable(
        { hash: HASH, shareable: true },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toEqual({ hash: HASH, shareable: true });

    expect(firestoreState.directUpdateCalls).toEqual([
      {
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({ shareable: true }),
      },
    ]);
  });

  it("requires auth to set the shareable flag", async () => {
    await expect(
      setShareable({ hash: HASH, shareable: true }, {}),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects a non-boolean shareable value", async () => {
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, activeArchive());

    await expect(
      setShareable({ hash: HASH, shareable: "yes" }, { auth: { uid: "user-1" } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(firestoreState.directUpdateCalls).toEqual([]);
  });

  it("cannot set shareable on an upload that does not exist", async () => {
    await expect(
      setShareable({ hash: HASH, shareable: true }, { auth: { uid: "user-1" } }),
    ).rejects.toMatchObject({ code: "not-found" });
    expect(firestoreState.directUpdateCalls).toEqual([]);
  });

  it("requires auth to delete an upload", async () => {
    await expect(remove({ hash: HASH }, {})).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("returns not-found when deleting a missing upload", async () => {
    await expect(
      remove({ hash: HASH }, { auth: { uid: "user-1" } }),
    ).rejects.toMatchObject({ code: "not-found" });
    expect(firestoreState.directDeleteCalls).toEqual([]);
    expect(storageState.deleteCalls).toEqual([]);
  });

  it("deletes an unreferenced upload without force", async () => {
    firestoreState.docs.set(
      `users/user-1/uploads/${HASH}`,
      activeArchive({ refCount: 0 }),
    );

    await expect(
      remove({ hash: HASH }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({ deleted: true, hash: HASH });
    expect(firestoreState.directDeleteCalls).toEqual([
      `users/user-1/uploads/${HASH}`,
    ]);
    expect(storageState.deleteCalls).toEqual([
      { path: PATH, options: { ignoreNotFound: true } },
    ]);
  });

  it("requires force to permanently delete referenced uploads", async () => {
    firestoreState.docs.set(
      `users/user-1/uploads/${HASH}`,
      activeArchive({ refCount: 2 }),
    );

    await expect(
      remove({ hash: HASH }, { auth: { uid: "user-1" } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });

    await expect(
      remove({ hash: HASH, force: true }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({ deleted: true, hash: HASH });
    expect(firestoreState.directDeleteCalls).toEqual([
      `users/user-1/uploads/${HASH}`,
    ]);
    expect(storageState.deleteCalls).toEqual([
      { path: PATH, options: { ignoreNotFound: true } },
    ]);
  });
});
