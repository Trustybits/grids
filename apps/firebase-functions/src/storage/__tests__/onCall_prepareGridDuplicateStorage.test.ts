import { beforeEach, describe, expect, it, vi } from "vitest";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const SOURCE_A = `users/source/images/${HASH_A}.png`;
const TARGET_A = `users/target/images/${HASH_A}.png`;

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

import { prepareGridDuplicateStorage } from "../onCall_prepareGridDuplicateStorage.js";

const prepare = prepareGridDuplicateStorage as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function seedSourceGrid() {
  firestoreState.docs.set("grids/grid-source", {
    userId: "source",
    tiles: [
      {
        i: "copyable-image",
        content: {
          type: "image",
          src: SOURCE_A,
          srcHash: HASH_A,
        },
      },
      {
        i: "blocked-image",
        content: {
          type: "image",
          src: `users/source/images/${HASH_B}.png`,
          srcHash: HASH_B,
        },
      },
    ],
  });
  firestoreState.docs.set(`users/source/uploads/${HASH_A}`, {
    uid: "source",
    hash: HASH_A,
    kind: "images",
    path: SOURCE_A,
    url: "https://cdn/source-a.png",
    displayName: "source-photo.png",
    size: 10,
    contentType: "image/png",
    ext: "png",
    status: "active",
    refCount: 1,
    shareable: true,
  });
  firestoreState.docs.set(`users/source/uploads/${HASH_B}`, {
    uid: "source",
    hash: HASH_B,
    kind: "images",
    path: `users/source/images/${HASH_B}.png`,
    url: "https://cdn/source-b.png",
    size: 20,
    contentType: "image/png",
    ext: "png",
    status: "active",
    refCount: 1,
    shareable: false,
  });
  firestoreState.docs.set("users/target", { storageUsed: 0 });
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.directSetCalls = [];
  storageState.copyCalls = [];
  storageState.setMetadataCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  FieldValue.serverTimestamp.mockClear();
  FieldValue.delete.mockClear();
});

describe("prepareGridDuplicateStorage", () => {
  it("estimates copiable and non-copiable source files", async () => {
    seedSourceGrid();

    await expect(
      prepare(
        { sourceGridId: "grid-source", copyDepth: "full" },
        { auth: { uid: "target" } },
      ),
    ).resolves.toEqual({
      additionalBytesRequired: 10,
      copiableCount: 1,
      nonCopiableCount: 1,
      replacementTileIds: ["blocked-image"],
      removeBackgroundImage: false,
    });
  });

  it("reports non-copiable background images separately from tile replacements", async () => {
    seedSourceGrid();
    const sourceGrid = firestoreState.docs.get("grids/grid-source");
    firestoreState.docs.set("grids/grid-source", {
      ...sourceGrid,
      backgroundImageSrc: `users/source/images/${HASH_B}.png`,
      backgroundImageHash: HASH_B,
    });

    await expect(
      prepare(
        { sourceGridId: "grid-source", copyDepth: "full" },
        { auth: { uid: "target" } },
      ),
    ).resolves.toMatchObject({
      nonCopiableCount: 1,
      replacementTileIds: ["blocked-image"],
      removeBackgroundImage: true,
    });
  });

  it("counts each tile that must be replaced for non-copiable files", async () => {
    seedSourceGrid();
    const sourceGrid = firestoreState.docs.get("grids/grid-source");
    firestoreState.docs.set("grids/grid-source", {
      ...sourceGrid,
      tiles: [
        ...((sourceGrid?.tiles as unknown[]) ?? []),
        {
          i: "second-blocked-image",
          content: {
            type: "image",
            src: `users/source/images/${HASH_B}.png`,
            srcHash: HASH_B,
          },
        },
      ],
    });

    await expect(
      prepare(
        { sourceGridId: "grid-source", copyDepth: "full" },
        { auth: { uid: "target" } },
      ),
    ).resolves.toMatchObject({
      nonCopiableCount: 2,
      replacementTileIds: ["blocked-image", "second-blocked-image"],
    });
  });

  it("rejects over-quota duplicates before copying", async () => {
    seedSourceGrid();
    firestoreState.docs.set("users/target", {
      storageUsed: 5_368_709_120,
      isDevAccount: false,
    });

    await expect(
      prepare(
        { sourceGridId: "grid-source", copyDepth: "full" },
        { auth: { uid: "target" } },
      ),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(storageState.copyCalls).toEqual([]);
  });

  it("copies shareable files and returns rewrite maps after confirmation", async () => {
    seedSourceGrid();

    const result = await prepare(
      { sourceGridId: "grid-source", copyDepth: "full", confirmed: true },
      { auth: { uid: "target" } },
    );

    expect(result).toMatchObject({
      additionalBytesRequired: 10,
      copiableCount: 1,
      nonCopiableCount: 1,
      replacementTileIds: ["blocked-image"],
      rewriteMap: {
        [HASH_A]: {
          oldHash: HASH_A,
          oldUrl: "https://cdn/source-a.png",
          newHash: HASH_A,
        },
      },
    });
    expect(
      (result as { rewriteMap: Record<string, { newUrl: string }> }).rewriteMap[
        HASH_A
      ]?.newUrl,
    ).toContain(encodeURIComponent(TARGET_A));
    expect(firestoreState.directSetCalls).toEqual([
      expect.objectContaining({
        path: `users/target/uploads/${HASH_A}`,
        data: expect.objectContaining({
          status: "pending",
          shareable: false,
          refCount: 0,
          displayName: "source-photo.png",
        }),
        options: { merge: true },
      }),
    ]);
    expect(storageState.copyCalls).toEqual([
      { source: SOURCE_A, target: TARGET_A },
    ]);
    expect(storageState.copyCalls).not.toContainEqual({
      source: `users/source/images/${HASH_B}.png`,
      target: `users/target/images/${HASH_B}.png`,
    });
    expect(storageState.setMetadataCalls).toEqual([
      expect.objectContaining({ path: TARGET_A }),
    ]);
    expect(firestoreState.directSetCalls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining("users/source/uploads/"),
        }),
      ]),
    );
    expect(firestoreState.directSetCalls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: `users/target/uploads/${HASH_B}`,
        }),
      ]),
    );
  });

  it("treats references with missing source archive docs as non-copiable", async () => {
    seedSourceGrid();
    firestoreState.docs.delete(`users/source/uploads/${HASH_B}`);

    const result = await prepare(
      { sourceGridId: "grid-source", copyDepth: "full", confirmed: true },
      { auth: { uid: "target" } },
    );

    expect(result).toMatchObject({
      copiableCount: 1,
      nonCopiableCount: 1,
      replacementTileIds: ["blocked-image"],
    });
    expect(storageState.copyCalls).toEqual([
      { source: SOURCE_A, target: TARGET_A },
    ]);
    expect(firestoreState.directSetCalls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: `users/target/uploads/${HASH_B}`,
        }),
      ]),
    );
  });

  it("uses an existing target archive URL without copying", async () => {
    seedSourceGrid();
    firestoreState.docs.set(`users/target/uploads/${HASH_A}`, {
      uid: "target",
      hash: HASH_A,
      kind: "images",
      path: TARGET_A,
      url: "https://cdn/target-existing.png",
      size: 10,
      contentType: "image/png",
      ext: "png",
      status: "active",
      refCount: 0,
      shareable: false,
    });

    const result = await prepare(
      { sourceGridId: "grid-source", copyDepth: "full", confirmed: true },
      { auth: { uid: "target" } },
    );

    expect(result).toMatchObject({
      additionalBytesRequired: 0,
      rewriteMap: {
        [HASH_A]: {
          newUrl: "https://cdn/target-existing.png",
        },
      },
    });
    expect(storageState.copyCalls).toEqual([]);
    expect(firestoreState.directSetCalls).toEqual([]);
  });
});
