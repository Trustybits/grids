/**
 * Unit tests for the upload-archive helpers that back the storage callables
 * and triggers (see notes/storage-refactor-implementation-plan.md, Phase 1.1
 * `utils_uploadArchive`).
 *
 * The Admin SDK (Firestore + Storage) is mocked in-memory so the transaction,
 * quota, refCount, and finalize logic can be exercised directly rather than
 * only through the callables. Covers:
 * - archive document ref path construction
 * - download URL construction and download-token selection
 * - quota assertion (no-op, dev exemption, over/under limit)
 * - reading, failing, and reserving archive docs
 * - refCount delta application (skip missing, clamp at zero, ignore no-ops)
 * - finalize state machine (missing / already-active / metadata-mismatch /
 *   activation preserving refCount + shareable)
 * - metadata-match assertion.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";

const HASH = "a".repeat(64);
const PATH = `users/user-1/images/${HASH}.png`;

const { firestoreState, FieldValue } = vi.hoisted(() => {
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
      directSetCalls: [] as Array<{
        path: string;
        data: Record<string, unknown>;
        options?: Record<string, unknown>;
      }>,
    },
  };
});

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import(
    "../../__tests__/utils_testMocks.js"
  );
  return createHttpsModuleMock();
});

vi.mock("firebase-functions/logger", () => ({
  warn: vi.fn(),
}));

vi.mock("../../admin.js", () => {
  function docRef(path: string) {
    return {
      path,
      collection: (subcollectionName: string) => ({
        doc: (subDocId: string) =>
          docRef(`${path}/${subcollectionName}/${subDocId}`),
      }),
      get: async () => {
        const data = firestoreState.docs.get(path);
        return { exists: data !== undefined, data: () => data };
      },
      set: async (
        data: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        firestoreState.directSetCalls.push({ path, data, options });
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
          return { exists: data !== undefined, data: () => data };
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

  return { default: { firestore } };
});

import {
  adjustUploadRefCounts,
  assertArchiveMetadataMatches,
  assertUserHasStorageQuota,
  buildDownloadUrl,
  createPendingArchiveReservation,
  ensureDownloadToken,
  finalizeUploadArchiveDoc,
  markUploadFailed,
  readUploadArchiveDoc,
  uploadArchiveRef,
  type UploadArchiveDoc,
} from "../utils_uploadArchive.js";
import { STORAGE_QUOTA_BYTES, type UploadMetadata } from "../utils_uploadPaths.js";

function metadata(overrides: Partial<UploadMetadata> = {}): UploadMetadata {
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

function pendingDoc(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user-1",
    hash: HASH,
    kind: "images",
    path: PATH,
    displayName: "photo.png",
    size: 25,
    contentType: "image/png",
    ext: "png",
    status: "pending",
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
  firestoreState.directSetCalls = [];
  vi.mocked(logger.warn).mockClear();
  FieldValue.serverTimestamp.mockClear();
  FieldValue.delete.mockClear();
});

describe("uploadArchiveRef", () => {
  it("points at users/{uid}/uploads/{hash}", () => {
    expect(uploadArchiveRef("user-1", HASH).path).toBe(
      `users/user-1/uploads/${HASH}`,
    );
  });
});

describe("buildDownloadUrl", () => {
  it("builds a media download URL with an encoded path", () => {
    expect(buildDownloadUrl("bucket-x", PATH)).toBe(
      `https://firebasestorage.googleapis.com/v0/b/bucket-x/o/${encodeURIComponent(
        PATH,
      )}?alt=media`,
    );
  });

  it("appends an encoded token when provided", () => {
    expect(buildDownloadUrl("bucket-x", PATH, "tok en")).toContain(
      "&token=tok%20en",
    );
  });

  it("points at the Storage emulator host when one is configured", () => {
    const prev = process.env.STORAGE_EMULATOR_HOST;
    process.env.STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
    try {
      expect(buildDownloadUrl("bucket-x", PATH)).toBe(
        `http://127.0.0.1:9199/v0/b/bucket-x/o/${encodeURIComponent(
          PATH,
        )}?alt=media`,
      );
    } finally {
      if (prev === undefined) delete process.env.STORAGE_EMULATOR_HOST;
      else process.env.STORAGE_EMULATOR_HOST = prev;
    }
  });
});

describe("ensureDownloadToken", () => {
  it("reuses an existing single token", () => {
    expect(ensureDownloadToken({ firebaseStorageDownloadTokens: "tok-1" })).toBe(
      "tok-1",
    );
  });

  it("takes the first token from a comma-separated list", () => {
    expect(
      ensureDownloadToken({ firebaseStorageDownloadTokens: "tok-1,tok-2" }),
    ).toBe("tok-1");
  });

  it("generates a fresh token when none is present", () => {
    const token = ensureDownloadToken();
    expect(typeof token).toBe("string");
    expect(token).not.toBe("");
    expect(ensureDownloadToken()).not.toBe(token);
  });

  it("generates a fresh token when the stored value is an empty string", () => {
    expect(ensureDownloadToken({ firebaseStorageDownloadTokens: "" })).not.toBe(
      "",
    );
  });
});

describe("assertUserHasStorageQuota", () => {
  it("is a no-op for zero or negative additional bytes", async () => {
    await expect(
      assertUserHasStorageQuota("user-1", 0),
    ).resolves.toBeUndefined();
    expect(firestoreState.docs.size).toBe(0);
  });

  it("allows uploads that stay within quota", async () => {
    firestoreState.docs.set("users/user-1", { storageUsed: 100 });
    await expect(
      assertUserHasStorageQuota("user-1", 25),
    ).resolves.toBeUndefined();
  });

  it("allows uploads with no existing user document (usage treated as zero)", async () => {
    await expect(
      assertUserHasStorageQuota("user-1", 25),
    ).resolves.toBeUndefined();
  });

  it("rejects uploads that exceed quota for non-dev users", async () => {
    firestoreState.docs.set("users/user-1", {
      storageUsed: STORAGE_QUOTA_BYTES,
      isDevAccount: false,
    });
    await expect(
      assertUserHasStorageQuota("user-1", 1),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("exempts dev accounts from quota", async () => {
    firestoreState.docs.set("users/user-1", {
      storageUsed: STORAGE_QUOTA_BYTES,
      isDevAccount: true,
    });
    await expect(
      assertUserHasStorageQuota("user-1", 1024),
    ).resolves.toBeUndefined();
  });
});

describe("readUploadArchiveDoc", () => {
  it("returns the archive document when it exists", async () => {
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, pendingDoc());
    await expect(readUploadArchiveDoc("user-1", HASH)).resolves.toMatchObject({
      hash: HASH,
      status: "pending",
    });
  });

  it("returns null when the archive document is missing", async () => {
    await expect(readUploadArchiveDoc("user-1", HASH)).resolves.toBeNull();
  });
});

describe("markUploadFailed", () => {
  it("merges a failed status and reason onto the archive doc", async () => {
    await markUploadFailed("user-1", HASH, "hash-mismatch");
    expect(firestoreState.directSetCalls).toEqual([
      {
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({
          status: "failed",
          failureReason: "hash-mismatch",
        }),
        options: { merge: true },
      },
    ]);
  });
});

describe("createPendingArchiveReservation", () => {
  it("writes a pending reservation and clears any prior failure fields", async () => {
    const result = await createPendingArchiveReservation("user-1", metadata());

    expect(result).toEqual({ path: PATH });
    expect(firestoreState.directSetCalls).toEqual([
      {
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({
          status: "pending",
          refCount: 0,
          shareable: false,
          displayName: "photo.png",
          failedAt: { __op: "delete" },
          failureReason: { __op: "delete" },
        }),
        options: { merge: true },
      },
    ]);
  });
});

describe("adjustUploadRefCounts", () => {
  it("does nothing when there are no deltas", async () => {
    await adjustUploadRefCounts("user-1", new Map());
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });

  it("applies positive and negative deltas to existing docs", async () => {
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, pendingDoc({ refCount: 3 }));

    await adjustUploadRefCounts("user-1", new Map([[HASH, 2]]));

    expect(firestoreState.txUpdateCalls).toEqual([
      {
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({ refCount: 5 }),
      },
    ]);
  });

  it("clamps a decrement so refCount never goes below zero", async () => {
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, pendingDoc({ refCount: 1 }));

    await adjustUploadRefCounts("user-1", new Map([[HASH, -5]]));

    expect(firestoreState.txUpdateCalls).toEqual([
      {
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({ refCount: 0 }),
      },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      "Clamping upload refCount adjustment below zero",
      {
        uid: "user-1",
        hash: HASH,
        current: 1,
        delta: -5,
        attempted: -4,
      },
    );
  });

  it("skips and logs deltas whose archive doc is missing", async () => {
    await adjustUploadRefCounts("user-1", new Map([[HASH, 1]]));
    expect(firestoreState.txUpdateCalls).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      "Skipping upload refCount adjustment because archive doc is missing",
      { uid: "user-1", hash: HASH, delta: 1 },
    );
  });

  it("ignores zero deltas without touching the doc", async () => {
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, pendingDoc({ refCount: 4 }));

    await adjustUploadRefCounts("user-1", new Map([[HASH, 0]]));

    expect(firestoreState.txGetCalls).toEqual([]);
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });
});

describe("finalizeUploadArchiveDoc", () => {
  const params = {
    uid: "user-1",
    metadata: metadata(),
    bucketName: "test-bucket",
    token: "tok-1",
  };

  it("reports a missing reservation without writing", async () => {
    await expect(finalizeUploadArchiveDoc(params)).resolves.toEqual({
      activated: false,
      reason: "missing-reservation",
    });
    expect(firestoreState.txSetCalls).toEqual([]);
  });

  it("reports an already-active doc and returns its URL without rewriting", async () => {
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, {
      ...pendingDoc(),
      status: "active",
      url: "https://cdn/existing.png",
    });

    await expect(finalizeUploadArchiveDoc(params)).resolves.toEqual({
      activated: false,
      reason: "already-active",
      url: "https://cdn/existing.png",
    });
    expect(firestoreState.txSetCalls).toEqual([]);
  });

  it("fails the reservation when the finalized metadata does not match", async () => {
    firestoreState.docs.set(
      `users/user-1/uploads/${HASH}`,
      pendingDoc({ contentType: "image/jpeg" }),
    );

    await expect(finalizeUploadArchiveDoc(params)).resolves.toEqual({
      activated: false,
      reason: "metadata-mismatch",
    });
    expect(firestoreState.txSetCalls).toEqual([
      expect.objectContaining({
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({
          status: "failed",
          failureReason: "metadata-mismatch",
        }),
      }),
    ]);
  });

  it("activates a matching reservation, preserving refCount and shareable", async () => {
    firestoreState.docs.set(
      `users/user-1/uploads/${HASH}`,
      pendingDoc({
        refCount: 4,
        shareable: true,
        displayName: "original-name.png",
      }),
    );

    const result = await finalizeUploadArchiveDoc(params);

    expect(result.activated).toBe(true);
    expect(result.url).toContain(encodeURIComponent(PATH));
    expect(firestoreState.txSetCalls).toEqual([
      expect.objectContaining({
        path: `users/user-1/uploads/${HASH}`,
        data: expect.objectContaining({
          status: "active",
          refCount: 4,
          shareable: true,
          displayName: "original-name.png",
          url: expect.stringContaining("token=tok-1"),
        }),
        options: { merge: true },
      }),
    ]);
  });

  it("activates with refCount 0 and shareable false when the reservation omits them", async () => {
    firestoreState.docs.set(`users/user-1/uploads/${HASH}`, {
      uid: "user-1",
      hash: HASH,
      kind: "images",
      path: PATH,
      size: 25,
      contentType: "image/png",
      ext: "png",
      status: "pending",
    });

    await finalizeUploadArchiveDoc(params);

    expect(firestoreState.txSetCalls[0]?.data).toMatchObject({
      status: "active",
      refCount: 0,
      shareable: false,
      displayName: "photo.png",
    });
  });
});

describe("assertArchiveMetadataMatches", () => {
  it("does not throw when kind, size, contentType, and ext all match", () => {
    expect(() =>
      assertArchiveMetadataMatches(
        pendingDoc() as Partial<UploadArchiveDoc>,
        metadata(),
      ),
    ).not.toThrow();
  });

  it.each([
    ["kind", { kind: "videos" }],
    ["size", { size: 999 }],
    ["contentType", { contentType: "image/jpeg" }],
    ["ext", { ext: "jpg" }],
  ])("throws already-exists when %s differs", (_field, override) => {
    let error: { code?: string } | null = null;
    try {
      assertArchiveMetadataMatches(
        pendingDoc(override) as Partial<UploadArchiveDoc>,
        metadata(),
      );
    } catch (thrown) {
      error = thrown as { code?: string };
    }
    expect(error?.code).toBe("already-exists");
  });
});
