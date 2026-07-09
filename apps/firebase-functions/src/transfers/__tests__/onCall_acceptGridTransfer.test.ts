import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  adminState,
  maintenance,
  callableUtils,
  transferUtils,
  acceptanceUtils,
  FieldValue,
} = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
  };
  return {
    FieldValue,
    maintenance: {
      noopIfMaintenance: vi.fn(() => false),
    },
    callableUtils: {
      getCallableData: vi.fn((data: unknown) => data ?? {}),
      requireAuth: vi.fn(() => "recipient"),
    },
    transferUtils: {
      fieldValue: vi.fn(() => FieldValue),
      isExpired: vi.fn(() => false),
      markTransferResolved: vi.fn(),
      normalizeTransferId: vi.fn((value: string) => value),
      readTransfer: vi.fn(),
    },
    acceptanceUtils: {
      buildTransferInventory: vi.fn(),
      copyTransferArchiveObjects: vi.fn(),
      deleteNotionAndUpvoteSubcollections: vi.fn(),
      deleteSenderOrphanedFiles: vi.fn(),
      rewriteGridForTransfer: vi.fn(),
    },
    adminState: {
      gridSnap: {
        exists: true,
        data: () => ({ userId: "sender", tiles: [{ i: "tile-1" }] }),
      },
      txGridSnap: {
        exists: true,
        data: () => ({ userId: "sender" }),
      },
      txTransferSnap: {
        data: () => ({ status: "pending" }),
      },
      senderSnap: {
        data: () => ({ defaultGridId: "grid-1", slug: "sender-slug" }),
      },
      txUpdates: [] as Array<{ ref: unknown; data: Record<string, unknown> }>,
      txSets: [] as Array<{
        ref: unknown;
        data: Record<string, unknown>;
        options?: unknown;
      }>,
    },
  };
});

vi.mock("firebase-functions/v1", () => ({
  https: {
    onCall: (handler: unknown) => handler,
  },
}));

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import(
    "../../__tests__/utils_testMocks.js"
  );
  return createHttpsModuleMock();
});

vi.mock("../../maintenance.js", () => maintenance);
vi.mock("../../shared/utils_callable.js", () => callableUtils);
vi.mock("../utils_gridTransfer.js", () => transferUtils);
vi.mock("../utils_gridTransferAcceptance.js", () => acceptanceUtils);

vi.mock("../../admin.js", () => {
  const gridRef = {
    path: "grids/grid-1",
    get: async () => adminState.gridSnap,
  };
  const senderRef = { path: "users/sender" };
  const transferRef = { path: "gridTransfers/transfer-1" };
  const slugRef = { path: "slugs/sender-slug" };
  return {
    default: {
      firestore: () => ({
        collection: (collectionName: string) => ({
          doc: (docId: string) => {
            if (collectionName === "grids") return gridRef;
            if (collectionName === "users") return senderRef;
            if (collectionName === "slugs") return { ...slugRef, path: `slugs/${docId}` };
            return transferRef;
          },
        }),
        runTransaction: async (callback: (tx: unknown) => Promise<unknown>) => {
          // Mirror Firestore's hard rule: every read must precede every write.
          // Once a write is issued, a later `get` throws — matching the emulator
          // so this suite catches read-after-write regressions.
          let hasWritten = false;
          const tx = {
            get: async (ref: { path: string }) => {
              if (hasWritten) {
                throw new Error(
                  "Firestore transactions require all reads to be executed before all writes.",
                );
              }
              if (ref.path === "grids/grid-1") return adminState.txGridSnap;
              if (ref.path === "gridTransfers/transfer-1") {
                return adminState.txTransferSnap;
              }
              return adminState.senderSnap;
            },
            update: (ref: unknown, data: Record<string, unknown>) => {
              hasWritten = true;
              adminState.txUpdates.push({ ref, data });
            },
            set: (ref: unknown, data: Record<string, unknown>, options?: unknown) => {
              hasWritten = true;
              adminState.txSets.push({ ref, data, options });
            },
          };
          return callback(tx);
        },
      }),
    },
  };
});

import { acceptGridTransfer } from "../onCall_acceptGridTransfer.js";

const accept = acceptGridTransfer as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function transfer(overrides: Record<string, unknown> = {}) {
  return {
    id: "transfer-1",
    gridId: "grid-1",
    fromUserId: "sender",
    fromSlug: "sender-slug",
    toUserId: "recipient",
    removeOrphanedFiles: false,
    status: "pending",
    expiresAt: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  maintenance.noopIfMaintenance.mockReturnValue(false);
  callableUtils.requireAuth.mockReturnValue("recipient");
  transferUtils.fieldValue.mockReturnValue(FieldValue);
  transferUtils.isExpired.mockReturnValue(false);
  transferUtils.normalizeTransferId.mockImplementation((value: string) => value);
  transferUtils.readTransfer.mockResolvedValue({
    ref: { path: "gridTransfers/transfer-1" },
    transfer: transfer(),
  });
  acceptanceUtils.buildTransferInventory.mockResolvedValue({
    references: [{ hash: "hash-a" }, { hash: "hash-a" }],
    copyPlan: {
      nonCopiableHashes: new Set(["missing"]),
    },
  });
  acceptanceUtils.copyTransferArchiveObjects.mockResolvedValue({
    "hash-a": { newUrl: "https://target" },
  });
  acceptanceUtils.rewriteGridForTransfer.mockReturnValue({
    userId: "recipient",
    tiles: [],
  });
  adminState.gridSnap = {
    exists: true,
    data: () => ({ userId: "sender", tiles: [{ i: "tile-1" }] }),
  };
  adminState.txGridSnap = {
    exists: true,
    data: () => ({ userId: "sender" }),
  };
  adminState.txTransferSnap = {
    data: () => ({ status: "pending" }),
  };
  adminState.senderSnap = {
    data: () => ({ defaultGridId: "grid-1", slug: "sender-slug" }),
  };
  adminState.txUpdates = [];
  adminState.txSets = [];
});

describe("acceptGridTransfer", () => {
  it("accepts a pending transfer and performs the ownership flip transaction", async () => {
    await expect(
      accept({ transferId: "transfer-1" }, { auth: { uid: "recipient" } }),
    ).resolves.toEqual({
      transferId: "transfer-1",
      gridId: "grid-1",
      status: "accepted",
    });

    expect(acceptanceUtils.buildTransferInventory).toHaveBeenCalledWith({
      grid: expect.objectContaining({ userId: "sender" }),
      fromUserId: "sender",
      toUserId: "recipient",
      assertQuota: true,
    });
    expect(acceptanceUtils.copyTransferArchiveObjects).toHaveBeenCalled();
    expect(acceptanceUtils.rewriteGridForTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        gridId: "grid-1",
        toUserId: "recipient",
        nonCopiableHashes: new Set(["missing"]),
      }),
    );
    expect(acceptanceUtils.deleteNotionAndUpvoteSubcollections).toHaveBeenCalledWith(
      "grid-1",
      [{ i: "tile-1" }],
    );
    expect(adminState.txUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.objectContaining({ path: "grids/grid-1" }),
          data: { userId: "recipient", tiles: [] },
        }),
        expect.objectContaining({
          ref: expect.objectContaining({ path: "users/sender" }),
          data: { defaultGridId: null },
        }),
        expect.objectContaining({
          ref: { path: "gridTransfers/transfer-1" },
          data: expect.objectContaining({ status: "accepted" }),
        }),
      ]),
    );
    expect(adminState.txSets).toEqual([
      {
        ref: expect.objectContaining({ path: "slugs/sender-slug" }),
        data: { defaultGridId: null },
        options: { merge: true },
      },
    ]);
  });

  it("rejects non-recipient accept attempts before copying files", async () => {
    callableUtils.requireAuth.mockReturnValue("other-user");

    await expect(
      accept({ transferId: "transfer-1" }, { auth: { uid: "other-user" } }),
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect(acceptanceUtils.copyTransferArchiveObjects).not.toHaveBeenCalled();
  });

  it("marks expired transfers before rejecting", async () => {
    transferUtils.isExpired.mockReturnValue(true);

    await expect(
      accept({ transferId: "transfer-1" }, { auth: { uid: "recipient" } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });

    expect(transferUtils.markTransferResolved).toHaveBeenCalledWith(
      { path: "gridTransfers/transfer-1" },
      "expired",
      { failureReason: "expired" },
    );
  });

  it("runs sender orphan cleanup only when the sender chose removal", async () => {
    transferUtils.readTransfer.mockResolvedValue({
      ref: { path: "gridTransfers/transfer-1" },
      transfer: transfer({ removeOrphanedFiles: true }),
    });

    await accept({ transferId: "transfer-1" }, { auth: { uid: "recipient" } });

    expect(acceptanceUtils.deleteSenderOrphanedFiles).toHaveBeenCalledWith({
      fromUserId: "sender",
      gridId: "grid-1",
      transferredHashes: new Set(["hash-a"]),
    });
  });
});
