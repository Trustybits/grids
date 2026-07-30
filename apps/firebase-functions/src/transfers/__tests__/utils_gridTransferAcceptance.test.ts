import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadArchiveDoc } from "../../storage/utils_uploadArchive.js";

const {
  adminState,
  contractsStorage,
  copyHelpers,
  uploadArchive,
  FieldValue,
} = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
  };
  return {
    FieldValue,
    contractsStorage: {
      extractGridStorageReferencesFromRecord: vi.fn(),
      rewriteArchiveBackedContent: vi.fn((tile) => tile),
      rewriteBackgroundImage: vi.fn(() => ({
        backgroundImageSrc: "rewritten-bg",
        backgroundImageHash: "bg-hash",
      })),
    },
    copyHelpers: {
      copyArchiveObjects: vi.fn(),
      prepareArchiveObjectCopyPlan: vi.fn(),
    },
    uploadArchive: {
      readUploadArchiveDoc: vi.fn(),
      uploadArchiveRef: vi.fn(),
    },
    adminState: {
      notionDocs: [] as Array<{ ref: { delete: ReturnType<typeof vi.fn> } }>,
      recursiveDelete: vi.fn(),
      gridQueryDocs: [] as Array<{
        id: string;
        data: () => Record<string, unknown>;
      }>,
      deletedStorage: [] as Array<{ path: string; options: unknown }>,
    },
  };
});

vi.mock("@grids/contracts/types", () => ({
  ContentType: {
    TEXT: "text",
    SMART_TEXT: "smart_text",
    CHAT: "chat",
    IMAGE: "image",
    VIDEO: "video",
    LINK: "link",
    EMBED: "embed",
    MAP: "map",
    CAMPFIRE: "campfire",
    SUGGESTION: "suggestion",
    PROFILE: "profile",
    YOUTUBE: "youtube",
    ROADMAP_FEED: "roadmap_feed",
    MUSIC: "music",
    DOCUMENT: "document",
  },
}));

vi.mock("@grids/contracts/storage", () => contractsStorage);
vi.mock("../../storage/utils_copyArchiveObjects.js", () => copyHelpers);
vi.mock("../../storage/utils_uploadArchive.js", () => uploadArchive);

vi.mock("../../admin.js", () => {
  function collection(path: string) {
    return {
      path,
      doc: (id: string) => ({
        path: `${path}/${id}`,
        collection: (subcollection: string) =>
          collection(`${path}/${id}/${subcollection}`),
      }),
      get: async () => ({ docs: adminState.notionDocs }),
      where: () => ({
        get: async () => ({ docs: adminState.gridQueryDocs }),
      }),
    };
  }

  return {
    default: {
      firestore: Object.assign(
        () => ({
          collection,
          recursiveDelete: adminState.recursiveDelete,
        }),
        { FieldValue },
      ),
      storage: () => ({
        bucket: () => ({
          file: (path: string) => ({
            delete: async (options: unknown) => {
              adminState.deletedStorage.push({ path, options });
            },
          }),
        }),
      }),
    },
  };
});

import {
  buildTransferInventory,
  copyTransferArchiveObjects,
  deleteNotionAndUpvoteSubcollections,
  deleteSenderOrphanedFiles,
  rewriteGridForTransfer,
} from "../utils_gridTransferAcceptance.js";

const archiveDoc = (overrides: Partial<UploadArchiveDoc> = {}): UploadArchiveDoc => ({
  uid: "source",
  hash: "a".repeat(64),
  kind: "images",
  path: `users/source/images/${"a".repeat(64)}.png`,
  url: "https://source/a.png",
  size: 10,
  contentType: "image/png",
  ext: "png",
  status: "active",
  refCount: 1,
  shareable: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  adminState.notionDocs = [];
  adminState.gridQueryDocs = [];
  adminState.deletedStorage = [];
});

describe("buildTransferInventory", () => {
  it("extracts refs, prepares transfer copy plan with owner authorization, and lists files", async () => {
    const hashA = "a".repeat(64);
    const hashB = "b".repeat(64);
    const refs = [{ hash: hashA }, { hash: hashB }];
    const docA = archiveDoc({ hash: hashA, displayName: "photo.png" });
    const docB = archiveDoc({ hash: hashB, displayName: undefined, ext: "jpg" });
    const copyPlan = {
      copiable: new Map([
        [hashA, docA],
        [hashB, docB],
      ]),
      nonCopiableHashes: new Set<string>(),
      additionalBytesRequired: 10,
      targetArchiveDocs: new Map([[hashA, archiveDoc({ uid: "target", hash: hashA })]]),
      missingForTarget: new Map([[hashB, docB]]),
    };
    contractsStorage.extractGridStorageReferencesFromRecord.mockReturnValue(refs);
    copyHelpers.prepareArchiveObjectCopyPlan.mockResolvedValue(copyPlan);

    await expect(
      buildTransferInventory({
        grid: { id: "grid-1" },
        fromUserId: "source",
        toUserId: "target",
        assertQuota: false,
      }),
    ).resolves.toEqual({
      references: refs,
      copyPlan,
      files: [
        {
          hash: hashA,
          displayName: "photo.png",
          kind: "images",
          size: 10,
          alreadyOwned: true,
        },
        {
          hash: hashB,
          displayName: `${hashB}.jpg`,
          kind: "images",
          size: 10,
          alreadyOwned: false,
        },
      ],
    });
    expect(copyHelpers.prepareArchiveObjectCopyPlan).toHaveBeenCalledWith({
      sourceUid: "source",
      targetUid: "target",
      references: refs,
      requireShareable: false,
      requireActiveSource: true,
      assertQuota: false,
    });
  });
});

describe("copyTransferArchiveObjects", () => {
  it("delegates to the archive object copier with the recipient uid", async () => {
    const plan = { copiable: new Map() } as never;
    copyHelpers.copyArchiveObjects.mockResolvedValue({ a: { newUrl: "url" } });

    await expect(
      copyTransferArchiveObjects({ toUserId: "target", copyPlan: plan }),
    ).resolves.toEqual({ a: { newUrl: "url" } });
    expect(copyHelpers.copyArchiveObjects).toHaveBeenCalledWith({
      targetUid: "target",
      plan,
    });
  });
});

describe("rewriteGridForTransfer", () => {
  it("rewrites ownership, replaces non-copiable tiles, strips roadmap connections, and bumps rev", () => {
    const blockedHash = "b".repeat(64);
    contractsStorage.extractGridStorageReferencesFromRecord.mockReturnValue([
      { hash: blockedHash, tileId: "image", location: "tile.image.src" },
      { hash: "c".repeat(64), location: "grid.backgroundImage" },
    ]);
    contractsStorage.rewriteBackgroundImage.mockReturnValue({
      backgroundImageSrc: "",
      backgroundImageHash: "",
    });

    const result = rewriteGridForTransfer({
      gridId: "grid-1",
      toUserId: "target",
      rewriteMap: {},
      nonCopiableHashes: new Set([blockedHash, "c".repeat(64)]),
      grid: {
        rev: 4,
        responsiveLayoutVersion: "griddle-v1",
        backgroundImageSrc: "old-bg",
        backgroundImageHash: "c".repeat(64),
        tiles: [
          {
            i: "image",
            content: { type: "image" },
          },
          {
            i: "roadmap",
            content: {
              type: "roadmap_feed",
              notionDatabaseId: "db",
              statusPropertyName: "Status",
              upvotePropertyName: "Votes",
              statusMapping: { Done: "done" },
            },
          },
        ],
      },
    });

    expect(result).toMatchObject({
      userId: "target",
      backgroundImageSrc: "",
      backgroundImageHash: "",
      rev: 5,
      updatedAt: { __op: "serverTimestamp" },
    });
    expect(result.tiles?.[0].content).toEqual({
      type: "suggestion",
      action: "media",
    });
    expect(result.tiles?.[1].content).toEqual({
      type: "roadmap_feed",
      notionDatabaseId: "",
      statusPropertyName: "",
      upvotePropertyName: "",
      statusMapping: {},
    });
    expect(result).not.toHaveProperty("responsiveLayoutVersion");
    expect(contractsStorage.rewriteBackgroundImage).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ removeBackgroundImage: true }),
    );
  });
});

describe("deleteNotionAndUpvoteSubcollections", () => {
  it("deletes notion token docs and only roadmap upvote subcollections", async () => {
    const deleteToken = vi.fn();
    adminState.notionDocs = [{ ref: { delete: deleteToken } }];

    await deleteNotionAndUpvoteSubcollections("grid-1", [
      { i: "roadmap", content: { type: "roadmap_feed" } },
      { i: "chat", content: { type: "chat" } },
      { i: 123, content: { type: "roadmap_feed" } },
    ]);

    expect(deleteToken).toHaveBeenCalledTimes(1);
    expect(adminState.recursiveDelete).toHaveBeenCalledTimes(1);
    expect(adminState.recursiveDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "grids/grid-1/tiles/roadmap/upvotes",
      }),
    );
  });
});

describe("deleteSenderOrphanedFiles", () => {
  it("returns without reading Firestore when there are no transferred hashes", async () => {
    await deleteSenderOrphanedFiles({
      fromUserId: "source",
      gridId: "grid-1",
      transferredHashes: new Set(),
    });

    expect(contractsStorage.extractGridStorageReferencesFromRecord).not.toHaveBeenCalled();
  });

  it("deletes only transferred files that are absent from the sender's other grids", async () => {
    const retainedHash = "a".repeat(64);
    const deletedHash = "b".repeat(64);
    adminState.gridQueryDocs = [
      {
        id: "grid-1",
        data: () => ({ id: "grid-1" }),
      },
      {
        id: "other-grid",
        data: () => ({ id: "other-grid" }),
      },
    ];
    contractsStorage.extractGridStorageReferencesFromRecord.mockReturnValue([
      { hash: retainedHash },
    ]);
    const deleteRef = vi.fn();
    uploadArchive.uploadArchiveRef.mockReturnValue({ delete: deleteRef });
    uploadArchive.readUploadArchiveDoc.mockImplementation(async (_uid, hash) =>
      hash === deletedHash
        ? archiveDoc({
            hash: deletedHash,
            path: `users/source/images/${deletedHash}.png`,
          })
        : archiveDoc({ hash }),
    );

    await deleteSenderOrphanedFiles({
      fromUserId: "source",
      gridId: "grid-1",
      transferredHashes: new Set([retainedHash, deletedHash]),
    });

    expect(uploadArchive.readUploadArchiveDoc).toHaveBeenCalledTimes(1);
    expect(uploadArchive.readUploadArchiveDoc).toHaveBeenCalledWith(
      "source",
      deletedHash,
    );
    expect(deleteRef).toHaveBeenCalledTimes(1);
    expect(adminState.deletedStorage).toEqual([
      {
        path: `users/source/images/${deletedHash}.png`,
        options: { ignoreNotFound: true },
      },
    ]);
  });
});
