import { beforeEach, describe, expect, it, vi } from "vitest";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const HASH = "a".repeat(64);
const SOURCE_PATH = `users/source/images/${HASH}.png`;
const TARGET_PATH = `users/target/images/${HASH}.png`;

const {
  firestoreState,
  storageState,
  authState,
  recursiveDelete,
  FieldValue,
  Timestamp,
} = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
    delete: vi.fn(() => ({ __op: "delete" })),
  };
  const Timestamp = {
    fromMillis: vi.fn((millis: number) => ({
      millis,
      toMillis: () => millis,
      toDate: () => new Date(millis),
    })),
  };
  return {
    FieldValue,
    Timestamp,
    recursiveDelete: vi.fn(),
    firestoreState: {
      docs: new Map<string, Record<string, unknown>>(),
      nextId: 1,
    },
    storageState: {
      copyCalls: [] as Array<{ source: string; target: string }>,
      setMetadataCalls: [] as Array<{ path: string; metadata: unknown }>,
      deleteCalls: [] as Array<{ path: string; options?: unknown }>,
    },
    authState: {
      usersByEmail: new Map<string, { uid: string }>(),
    },
  };
});

vi.mock("firebase-functions/v1", () => ({
  https: {
    onCall: (handler: unknown) => handler,
  },
  pubsub: {
    schedule: () => ({
      timeZone: () => ({
        onRun: (handler: unknown) => handler,
      }),
    }),
  },
}));

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import(
    "../../__tests__/utils_testMocks.js"
  );
  return createHttpsModuleMock();
});

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../../admin.js", () => {
  type Filter = { field: string; op: string; value: unknown };

  function parentPath(path: string) {
    const parts = path.split("/");
    parts.pop();
    return parts.join("/");
  }

  function docSnapshot(path: string) {
    const data = firestoreState.docs.get(path);
    const pathParts = path.split("/");
    return {
      id: pathParts[pathParts.length - 1] ?? path,
      ref: docRef(path),
      exists: data !== undefined,
      data: () => data,
    };
  }

  function matchesFilter(data: Record<string, unknown>, filter: Filter) {
    const value = data[filter.field];
    if (filter.op === "==") return value === filter.value;
    if (filter.op === "<=") {
      const left =
        value && typeof value === "object" && "toMillis" in value
          ? (value as { toMillis: () => number }).toMillis()
          : value instanceof Date
            ? value.getTime()
            : value;
      const right =
        filter.value &&
        typeof filter.value === "object" &&
        "toMillis" in filter.value
          ? (filter.value as { toMillis: () => number }).toMillis()
          : filter.value instanceof Date
            ? filter.value.getTime()
            : filter.value;
      return typeof left === "number" && typeof right === "number"
        ? left <= right
        : false;
    }
    return false;
  }

  function query(path: string, filters: Filter[] = [], limitCount?: number) {
    return {
      path,
      where: (field: string, op: string, value: unknown) =>
        query(path, [...filters, { field, op, value }], limitCount),
      limit: (count: number) => query(path, filters, count),
      get: async () => {
        let docs = [...firestoreState.docs.entries()]
          .filter(([docPath]) => parentPath(docPath) === path)
          .filter(([, data]) => filters.every((filter) => matchesFilter(data, filter)))
          .map(([docPath]) => docSnapshot(docPath));
        if (limitCount !== undefined) docs = docs.slice(0, limitCount);
        return {
          docs,
          empty: docs.length === 0,
        };
      },
      doc: (id?: string) => {
        const docId = id ?? `auto-${firestoreState.nextId++}`;
        return docRef(`${path}/${docId}`);
      },
    };
  }

  function docRef(path: string) {
    const pathParts = path.split("/");
    return {
      id: pathParts[pathParts.length - 1] ?? path,
      path,
      collection: (subcollectionName: string) =>
        query(`${path}/${subcollectionName}`),
      get: async () => docSnapshot(path),
      set: async (
        data: Record<string, unknown>,
        options?: { merge?: boolean },
      ) => {
        firestoreState.docs.set(path, {
          ...(options?.merge ? firestoreState.docs.get(path) ?? {} : {}),
          ...data,
        });
      },
      update: async (data: Record<string, unknown>) => {
        firestoreState.docs.set(path, {
          ...(firestoreState.docs.get(path) ?? {}),
          ...data,
        });
      },
      delete: async () => {
        firestoreState.docs.delete(path);
      },
    };
  }

  const firestore = () => ({
    collection: (collectionName: string) => query(collectionName),
    batch: () => {
      const updates: Array<{ ref: { path: string }; data: Record<string, unknown> }> = [];
      return {
        update: (ref: { path: string }, data: Record<string, unknown>) => {
          updates.push({ ref, data });
        },
        commit: async () => {
          for (const update of updates) {
            firestoreState.docs.set(update.ref.path, {
              ...(firestoreState.docs.get(update.ref.path) ?? {}),
              ...update.data,
            });
          }
        },
      };
    },
    runTransaction: async (
      callback: (tx: {
        get: (ref: { get: () => Promise<unknown> }) => Promise<unknown>;
        update: (ref: { path: string }, data: Record<string, unknown>) => void;
        set: (
          ref: { path: string },
          data: Record<string, unknown>,
          options?: { merge?: boolean },
        ) => void;
      }) => Promise<unknown>,
    ) => {
      const tx = {
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        update: (ref: { path: string }, data: Record<string, unknown>) => {
          firestoreState.docs.set(ref.path, {
            ...(firestoreState.docs.get(ref.path) ?? {}),
            ...data,
          });
        },
        set: (
          ref: { path: string },
          data: Record<string, unknown>,
          options?: { merge?: boolean },
        ) => {
          firestoreState.docs.set(ref.path, {
            ...(options?.merge ? firestoreState.docs.get(ref.path) ?? {} : {}),
            ...data,
          });
        },
      };
      return callback(tx);
    },
    recursiveDelete,
  });
  firestore.FieldValue = FieldValue;
  firestore.Timestamp = Timestamp;

  return {
    default: {
      firestore,
      auth: () => ({
        getUserByEmail: async (email: string) => {
          const user = authState.usersByEmail.get(email);
          if (!user) throw new Error("not-found");
          return user;
        },
      }),
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
            delete: async (options?: unknown) => {
              storageState.deleteCalls.push({ path, options });
            },
          }),
        }),
      }),
    },
  };
});

import { acceptGridTransfer } from "../onCall_acceptGridTransfer.js";
import { cancelGridTransfer } from "../onCall_cancelGridTransfer.js";
import { createGridTransfer } from "../onCall_createGridTransfer.js";
import { declineGridTransfer } from "../onCall_declineGridTransfer.js";
import { previewGridTransferAcceptance } from "../onCall_previewGridTransferAcceptance.js";
import { sweepExpiredGridTransfers } from "../onSchedule_sweepExpiredGridTransfers.js";

const createTransfer = createGridTransfer as unknown as Callable;
const previewTransfer = previewGridTransferAcceptance as unknown as Callable;
const acceptTransfer = acceptGridTransfer as unknown as Callable;
const declineTransfer = declineGridTransfer as unknown as Callable;
const cancelTransfer = cancelGridTransfer as unknown as Callable;
const sweepExpired = sweepExpiredGridTransfers as unknown as () => Promise<unknown>;

type Callable = (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function future() {
  return Timestamp.fromMillis(Date.now() + 60_000);
}

function seedGridTransfer() {
  firestoreState.docs.set("users/source", {
    email: "source@example.com",
    slug: "source-slug",
    defaultGridId: "grid-1",
    storageUsed: 10,
  });
  firestoreState.docs.set("users/target", {
    email: "target@example.com",
    slug: "target-slug",
    storageUsed: 0,
  });
  firestoreState.docs.set("slugs/source-slug", {
    userId: "source",
    defaultGridId: "grid-1",
  });
  firestoreState.docs.set("slugs/target-slug", { userId: "target" });
  firestoreState.docs.set("grids/grid-1", {
    id: "grid-1",
    userId: "source",
    name: "Transfer me",
    rev: 2,
    backgroundImageSrc: SOURCE_PATH,
    backgroundImageHash: HASH,
    backgroundEmbed: false,
    tiles: [
      {
        i: "image-tile",
        x: 0,
        y: 0,
        w: 2,
        h: 2,
        caption: "",
        content: {
          type: "image",
          src: SOURCE_PATH,
          srcHash: HASH,
        },
      },
      {
        i: "roadmap-tile",
        x: 2,
        y: 0,
        w: 2,
        h: 2,
        caption: "",
        content: {
          type: "roadmap_feed",
          notionDatabaseId: "db-1",
          statusPropertyName: "Status",
          upvotePropertyName: "Votes",
          statusMapping: { Done: "done" },
          cachedItems: [{ notionPageId: "page-1" }],
        },
      },
    ],
  });
  firestoreState.docs.set("grids/source-other", {
    id: "source-other",
    userId: "source",
    tiles: [],
  });
  firestoreState.docs.set(`users/source/uploads/${HASH}`, {
    uid: "source",
    hash: HASH,
    kind: "images",
    path: SOURCE_PATH,
    url: "https://cdn/source.png",
    displayName: "source.png",
    size: 10,
    contentType: "image/png",
    ext: "png",
    status: "active",
    refCount: 1,
    shareable: false,
  });
  firestoreState.docs.set("grids/grid-1/notionTokens/roadmap-tile", {
    accessToken: "secret",
  });
  firestoreState.docs.set(
    "grids/grid-1/tiles/roadmap-tile/upvotes/user-1_page-1",
    { userId: "user-1" },
  );
  firestoreState.docs.set("gridTransfers/transfer-1", {
    id: "transfer-1",
    gridId: "grid-1",
    gridName: "Transfer me",
    fromUserId: "source",
    fromSlug: "source-slug",
    fromEmail: "source@example.com",
    toUserId: "target",
    removeOrphanedFiles: true,
    status: "pending",
    expiresAt: future(),
  });
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.nextId = 1;
  storageState.copyCalls = [];
  storageState.setMetadataCalls = [];
  storageState.deleteCalls = [];
  authState.usersByEmail = new Map();
  recursiveDelete.mockReset().mockResolvedValue(undefined);
  resetMaintenanceMock(noopIfMaintenance);
  FieldValue.serverTimestamp.mockClear();
  FieldValue.delete.mockClear();
  Timestamp.fromMillis.mockClear();
});

describe("grid transfer callables", () => {
  it("creates a pending transfer and estimates recipient storage bytes", async () => {
    seedGridTransfer();
    firestoreState.docs.delete("gridTransfers/transfer-1");
    authState.usersByEmail.set("target@example.com", { uid: "target" });

    const result = await createTransfer(
      {
        gridId: "grid-1",
        recipient: { email: "target@example.com" },
        removeOrphanedFiles: false,
      },
      { auth: { uid: "source" } },
    );

    expect(result).toEqual({
      transferId: "auto-1",
      status: "pending",
      estimatedBytes: 10,
    });
    expect(firestoreState.docs.get("gridTransfers/auto-1")).toMatchObject({
      gridId: "grid-1",
      fromUserId: "source",
      toUserId: "target",
      removeOrphanedFiles: false,
      status: "pending",
    });
  });

  it("rejects self-transfer attempts", async () => {
    seedGridTransfer();

    await expect(
      createTransfer(
        {
          gridId: "grid-1",
          recipient: { slug: "source-slug" },
          removeOrphanedFiles: false,
        },
        { auth: { uid: "source" } },
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("previews transfer acceptance without throwing on quota exhaustion", async () => {
    seedGridTransfer();
    firestoreState.docs.set("users/target", {
      storageUsed: 5_368_709_120,
      isDevAccount: false,
    });

    await expect(
      previewTransfer(
        { transferId: "transfer-1" },
        { auth: { uid: "target" } },
      ),
    ).resolves.toMatchObject({
      additionalBytesRequired: 10,
      recipientQuotaRemaining: 0,
      wouldExceedQuota: true,
      files: [
        {
          hash: HASH,
          displayName: "source.png",
          kind: "images",
          size: 10,
          alreadyOwned: false,
        },
      ],
      nonCopiableCount: 0,
    });
  });

  it("accepts a transfer, rewrites files, strips Notion/upvotes, clears defaults, and removes sender-only files", async () => {
    seedGridTransfer();

    await expect(
      acceptTransfer(
        { transferId: "transfer-1" },
        { auth: { uid: "target" } },
      ),
    ).resolves.toEqual({
      transferId: "transfer-1",
      gridId: "grid-1",
      status: "accepted",
    });

    const grid = firestoreState.docs.get("grids/grid-1") as {
      userId: string;
      rev: number;
      backgroundImageSrc: string;
      tiles: Array<{ content: Record<string, unknown> }>;
    };
    expect(grid.userId).toBe("target");
    expect(grid.rev).toBe(3);
    expect(grid.backgroundImageSrc).toContain(encodeURIComponent(TARGET_PATH));
    expect(grid.tiles[0].content).toMatchObject({
      type: "image",
      srcHash: HASH,
    });
    expect(String(grid.tiles[0].content.src)).toContain(
      encodeURIComponent(TARGET_PATH),
    );
    expect(grid.tiles[1].content).toEqual({
      type: "roadmap_feed",
      notionDatabaseId: "",
      statusPropertyName: "",
      upvotePropertyName: "",
      statusMapping: {},
    });
    expect(firestoreState.docs.has("grids/grid-1/notionTokens/roadmap-tile")).toBe(
      false,
    );
    expect(recursiveDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "grids/grid-1/tiles/roadmap-tile/upvotes",
      }),
    );
    expect(firestoreState.docs.get("users/source")).toMatchObject({
      defaultGridId: null,
    });
    expect(firestoreState.docs.get("slugs/source-slug")).toMatchObject({
      defaultGridId: null,
    });
    expect(firestoreState.docs.get("gridTransfers/transfer-1")).toMatchObject({
      status: "accepted",
    });
    expect(storageState.copyCalls).toEqual([
      { source: SOURCE_PATH, target: TARGET_PATH },
    ]);
    expect(firestoreState.docs.has(`users/source/uploads/${HASH}`)).toBe(false);
    expect(storageState.deleteCalls).toEqual([
      { path: SOURCE_PATH, options: { ignoreNotFound: true } },
    ]);
  });

  it("declines and cancels pending transfers by the correct participant", async () => {
    seedGridTransfer();
    await expect(
      declineTransfer(
        { transferId: "transfer-1" },
        { auth: { uid: "target" } },
      ),
    ).resolves.toEqual({ transferId: "transfer-1", status: "declined" });

    firestoreState.docs.set("gridTransfers/transfer-2", {
      ...firestoreState.docs.get("gridTransfers/transfer-1"),
      id: "transfer-2",
      status: "pending",
    });
    await expect(
      cancelTransfer(
        { transferId: "transfer-2" },
        { auth: { uid: "source" } },
      ),
    ).resolves.toEqual({ transferId: "transfer-2", status: "cancelled" });
  });

  it("expires pending transfers on the scheduled sweep", async () => {
    seedGridTransfer();
    firestoreState.docs.set("gridTransfers/transfer-1", {
      ...firestoreState.docs.get("gridTransfers/transfer-1"),
      expiresAt: Timestamp.fromMillis(Date.now() - 1_000),
    });

    await sweepExpired();

    expect(firestoreState.docs.get("gridTransfers/transfer-1")).toMatchObject({
      status: "expired",
      failureReason: "expired",
    });
  });
});
