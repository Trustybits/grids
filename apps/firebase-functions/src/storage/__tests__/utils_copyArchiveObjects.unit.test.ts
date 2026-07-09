import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadArchiveDoc } from "../utils_uploadArchive.js";

const { uploadArchive, uploadPaths, storageState } = vi.hoisted(() => ({
  uploadArchive: {
    assertUserHasStorageQuota: vi.fn(),
    buildDownloadUrl: vi.fn(
      (_bucket: string, path: string, token?: string) =>
        `https://download/${encodeURIComponent(path)}?token=${token ?? ""}`,
    ),
    createPendingArchiveReservation: vi.fn(),
    ensureDownloadToken: vi.fn(() => "token-1"),
    readUploadArchiveDoc: vi.fn(),
  },
  uploadPaths: {
    buildCanonicalUploadPath: vi.fn(
      (uid: string, metadata: { kind: string; hash: string; ext: string }) =>
        `users/${uid}/${metadata.kind}/${metadata.hash}.${metadata.ext}`,
    ),
  },
  storageState: {
    copyCalls: [] as Array<{ source: string; target: string }>,
    metadataCalls: [] as Array<{ path: string; metadata: unknown }>,
  },
}));

vi.mock("../../admin.js", () => ({
  default: {
    storage: () => ({
      bucket: () => ({
        name: "bucket-1",
        file: (path: string) => ({
          path,
          copy: async (target: { path: string }) => {
            storageState.copyCalls.push({ source: path, target: target.path });
          },
          setMetadata: async (metadata: unknown) => {
            storageState.metadataCalls.push({ path, metadata });
          },
        }),
      }),
    }),
  },
}));

vi.mock("../utils_uploadArchive.js", () => uploadArchive);
vi.mock("../utils_uploadPaths.js", () => uploadPaths);

import {
  copyArchiveObjects,
  prepareArchiveObjectCopyPlan,
} from "../utils_copyArchiveObjects.js";

const activeDoc = (overrides: Partial<UploadArchiveDoc> = {}): UploadArchiveDoc => ({
  uid: "source",
  hash: "a".repeat(64),
  kind: "images",
  path: `users/source/images/${"a".repeat(64)}.png`,
  url: "https://source/a.png",
  displayName: "a.png",
  size: 10,
  contentType: "image/png",
  ext: "png",
  status: "active",
  refCount: 1,
  shareable: true,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  storageState.copyCalls = [];
  storageState.metadataCalls = [];
});

describe("prepareArchiveObjectCopyPlan", () => {
  it("deduplicates references, classifies non-copiable hashes, and asserts quota by default", async () => {
    const hashA = "a".repeat(64);
    const hashB = "b".repeat(64);
    uploadArchive.readUploadArchiveDoc.mockImplementation(
      async (uid: string, hash: string) => {
        if (uid === "source" && hash === hashA) return activeDoc({ hash: hashA });
        if (uid === "source" && hash === hashB) return null;
        return null;
      },
    );

    const plan = await prepareArchiveObjectCopyPlan({
      sourceUid: "source",
      targetUid: "target",
      references: [{ hash: hashA }, { hash: hashA }, { hash: hashB }],
      requireShareable: true,
    });

    expect(uploadArchive.readUploadArchiveDoc).toHaveBeenCalledTimes(3);
    expect(plan.copiable.has(hashA)).toBe(true);
    expect(plan.nonCopiableHashes).toEqual(new Set([hashB]));
    expect(plan.additionalBytesRequired).toBe(10);
    expect(uploadArchive.assertUserHasStorageQuota).toHaveBeenCalledWith(
      "target",
      10,
    );
  });

  it("blocks inactive source docs only when active source is required", async () => {
    const hash = "a".repeat(64);
    uploadArchive.readUploadArchiveDoc.mockResolvedValue(
      activeDoc({ status: "pending" }),
    );

    await expect(
      prepareArchiveObjectCopyPlan({
        sourceUid: "source",
        targetUid: "target",
        references: [{ hash }],
        requireShareable: false,
        requireActiveSource: true,
        assertQuota: false,
      }),
    ).resolves.toMatchObject({
      copiable: new Map(),
      nonCopiableHashes: new Set([hash]),
      additionalBytesRequired: 0,
    });
  });

  it("skips quota assertion during preview and reuses active target docs", async () => {
    const hash = "a".repeat(64);
    uploadArchive.readUploadArchiveDoc.mockImplementation(
      async (uid: string) =>
        uid === "source"
          ? activeDoc({ hash })
          : activeDoc({ uid: "target", hash, url: "https://target/a.png" }),
    );

    const plan = await prepareArchiveObjectCopyPlan({
      sourceUid: "source",
      targetUid: "target",
      references: [{ hash }],
      requireShareable: false,
      assertQuota: false,
    });

    expect(plan.additionalBytesRequired).toBe(0);
    expect(plan.targetArchiveDocs.get(hash)?.url).toBe("https://target/a.png");
    expect(plan.missingForTarget.size).toBe(0);
    expect(uploadArchive.assertUserHasStorageQuota).not.toHaveBeenCalled();
  });
});

describe("copyArchiveObjects", () => {
  it("copies only missing target files and builds rewrite maps", async () => {
    const hash = "a".repeat(64);
    const doc = activeDoc({ hash });

    const rewriteMap = await copyArchiveObjects({
      targetUid: "target",
      plan: {
        copiable: new Map([[hash, doc]]),
        nonCopiableHashes: new Set(),
        additionalBytesRequired: 10,
        targetArchiveDocs: new Map(),
        missingForTarget: new Map([[hash, doc]]),
      },
    });

    expect(uploadArchive.createPendingArchiveReservation).toHaveBeenCalledWith(
      "target",
      expect.objectContaining({
        hash,
        displayName: "a.png",
      }),
    );
    expect(storageState.copyCalls).toEqual([
      {
        source: doc.path,
        target: `users/target/images/${hash}.png`,
      },
    ]);
    expect(storageState.metadataCalls).toEqual([
      {
        path: `users/target/images/${hash}.png`,
        metadata: {
          contentType: "image/png",
          metadata: {
            published: "true",
            firebaseStorageDownloadTokens: "token-1",
          },
        },
      },
    ]);
    expect(rewriteMap[hash]).toEqual({
      oldHash: hash,
      oldUrl: "https://source/a.png",
      newHash: hash,
      newUrl: `https://download/${encodeURIComponent(
        `users/target/images/${hash}.png`,
      )}?token=token-1`,
    });
  });

  it("uses an existing target archive URL without reserving or copying", async () => {
    const hash = "a".repeat(64);
    const doc = activeDoc({ hash });

    const rewriteMap = await copyArchiveObjects({
      targetUid: "target",
      plan: {
        copiable: new Map([[hash, doc]]),
        nonCopiableHashes: new Set(),
        additionalBytesRequired: 0,
        targetArchiveDocs: new Map([
          [hash, activeDoc({ uid: "target", hash, url: "https://target/a.png" })],
        ]),
        missingForTarget: new Map(),
      },
    });

    expect(uploadArchive.createPendingArchiveReservation).not.toHaveBeenCalled();
    expect(storageState.copyCalls).toEqual([]);
    expect(rewriteMap[hash]?.newUrl).toBe("https://target/a.png");
  });
});
