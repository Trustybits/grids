import { beforeEach, describe, expect, it, vi } from "vitest";

const HASH = "a".repeat(64);
const SOURCE_PATH = `users/source/images/${HASH}.png`;
const TARGET_PATH = `users/target/images/${HASH}.png`;

const { firestoreState, storageState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
    delete: vi.fn(() => ({ __op: "delete" })),
  };
  return {
    FieldValue,
    firestoreState: {
      docs: new Map<string, Record<string, unknown>>(),
      directSetCalls: [] as Array<{
        path: string;
        data: Record<string, unknown>;
        options?: Record<string, unknown>;
      }>,
    },
    storageState: {
      copyCalls: [] as Array<{ source: string; target: string }>,
      setMetadataCalls: [] as Array<{ path: string; metadata: unknown }>,
    },
  };
});

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
        return {
          exists: data !== undefined,
          data: () => data,
        };
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
  });
  firestore.FieldValue = FieldValue;

  return {
    default: {
      firestore,
      storage: () => ({
        bucket: () => ({
          name: "test-bucket",
          file: (path: string) => ({
            path,
            copy: async (target: { path: string }) => {
              storageState.copyCalls.push({ source: path, target: target.path });
            },
            setMetadata: async (metadata: unknown) => {
              storageState.setMetadataCalls.push({ path, metadata });
            },
          }),
        }),
      }),
    },
  };
});

import {
  copyArchiveObjects,
  prepareArchiveObjectCopyPlan,
} from "../utils_copyArchiveObjects.js";

function seedArchiveDoc(overrides: Record<string, unknown> = {}) {
  firestoreState.docs.set(`users/source/uploads/${HASH}`, {
    uid: "source",
    hash: HASH,
    kind: "images",
    path: SOURCE_PATH,
    url: "https://cdn/source.png",
    displayName: "source-photo.png",
    size: 10,
    contentType: "image/png",
    ext: "png",
    status: "active",
    refCount: 1,
    shareable: false,
    ...overrides,
  });
  firestoreState.docs.set("users/target", { storageUsed: 0 });
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.directSetCalls = [];
  storageState.copyCalls = [];
  storageState.setMetadataCalls = [];
  FieldValue.serverTimestamp.mockClear();
  FieldValue.delete.mockClear();
});

describe("prepareArchiveObjectCopyPlan", () => {
  it("blocks unshareable cross-user copies when shareability is required", async () => {
    seedArchiveDoc({ shareable: false });

    const plan = await prepareArchiveObjectCopyPlan({
      sourceUid: "source",
      targetUid: "target",
      references: [{ hash: HASH }],
      requireShareable: true,
    });

    expect(plan.copiable.size).toBe(0);
    expect(plan.nonCopiableHashes).toEqual(new Set([HASH]));
    expect(plan.additionalBytesRequired).toBe(0);
  });

  it("allows unshareable cross-user copies when owner authorization is enough", async () => {
    seedArchiveDoc({ shareable: false });

    const plan = await prepareArchiveObjectCopyPlan({
      sourceUid: "source",
      targetUid: "target",
      references: [{ hash: HASH }],
      requireShareable: false,
    });

    expect(plan.copiable.size).toBe(1);
    expect(plan.nonCopiableHashes).toEqual(new Set());
    expect(plan.additionalBytesRequired).toBe(10);
  });
});

describe("copyArchiveObjects", () => {
  it("copies missing target objects and returns a rewrite map", async () => {
    seedArchiveDoc({ shareable: false });
    const plan = await prepareArchiveObjectCopyPlan({
      sourceUid: "source",
      targetUid: "target",
      references: [{ hash: HASH }],
      requireShareable: false,
    });

    const rewriteMap = await copyArchiveObjects({
      targetUid: "target",
      plan,
    });

    expect(rewriteMap[HASH]).toMatchObject({
      oldHash: HASH,
      oldUrl: "https://cdn/source.png",
      newHash: HASH,
    });
    expect(rewriteMap[HASH]?.newUrl).toContain(encodeURIComponent(TARGET_PATH));
    expect(storageState.copyCalls).toEqual([
      { source: SOURCE_PATH, target: TARGET_PATH },
    ]);
    expect(storageState.setMetadataCalls).toEqual([
      expect.objectContaining({ path: TARGET_PATH }),
    ]);
    expect(firestoreState.directSetCalls).toEqual([
      expect.objectContaining({
        path: `users/target/uploads/${HASH}`,
        data: expect.objectContaining({
          status: "pending",
          displayName: "source-photo.png",
        }),
        options: { merge: true },
      }),
    ]);
  });
});
