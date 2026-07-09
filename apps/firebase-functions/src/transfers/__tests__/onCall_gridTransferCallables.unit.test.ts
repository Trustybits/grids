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
      requireAuth: vi.fn((_context: unknown) => "caller"),
    },
    transferUtils: {
      fieldValue: vi.fn(() => FieldValue),
      getRecipientQuotaRemaining: vi.fn(),
      gridTransfersCollection: vi.fn(),
      isExpired: vi.fn(() => false),
      markTransferResolved: vi.fn(),
      normalizeGridId: vi.fn((value: string) => value),
      normalizeRecipientRef: vi.fn((value: unknown) => value),
      normalizeRemoveOrphanedFiles: vi.fn((value: boolean) => value),
      normalizeTransferId: vi.fn((value: string) => value),
      readTransfer: vi.fn(),
      resolveRecipientUid: vi.fn(),
      timestampFromMillis: vi.fn((millis: number) => ({ millis })),
      transferExpiresAt: vi.fn(() => ({ expires: true })),
    },
    acceptanceUtils: {
      buildTransferInventory: vi.fn(),
      copyTransferArchiveObjects: vi.fn(),
      deleteNotionAndUpvoteSubcollections: vi.fn(),
      deleteSenderOrphanedFiles: vi.fn(),
      rewriteGridForTransfer: vi.fn(),
    },
    adminState: {
      gridSnap: { exists: true, data: () => ({ userId: "caller" }) },
      senderSnap: { data: () => ({ slug: "sender", email: "sender@example.com" }) },
      txGridSnap: { exists: true, data: () => ({ userId: "source" }) },
      txTransferSnap: { data: () => ({ status: "pending" }) },
      txUpdates: [] as Array<{ ref: unknown; data: Record<string, unknown> }>,
      txSets: [] as Array<{
        ref: unknown;
        data: Record<string, unknown>;
        options?: unknown;
      }>,
      batchUpdates: [] as Array<{ ref: unknown; data: Record<string, unknown> }>,
      batchCommitted: false,
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

vi.mock("../../maintenance.js", () => maintenance);
vi.mock("../../shared/utils_callable.js", () => callableUtils);
vi.mock("../utils_gridTransfer.js", () => transferUtils);
vi.mock("../utils_gridTransferAcceptance.js", () => acceptanceUtils);

vi.mock("../../admin.js", () => {
  const gridRef = { path: "grids/grid-1" };
  const slugRef = { path: "slugs/source-slug" };
  return {
    default: {
      firestore: () => ({
        collection: (collectionName: string) => ({
          doc: (docId: string) => {
            if (collectionName === "grids") {
              return {
                ...gridRef,
                get: async () => adminState.gridSnap,
              };
            }
            if (collectionName === "users") {
              return {
                path: `users/${docId}`,
                get: async () => adminState.senderSnap,
              };
            }
            return slugRef;
          },
        }),
        runTransaction: async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            get: async (ref: { path: string }) =>
              ref.path.startsWith("grids/")
                ? adminState.txGridSnap
                : ref.path.startsWith("gridTransfers/")
                  ? adminState.txTransferSnap
                  : { data: () => ({ defaultGridId: "grid-1", slug: "source-slug" }) },
            update: (ref: unknown, data: Record<string, unknown>) => {
              adminState.txUpdates.push({ ref, data });
            },
            set: (ref: unknown, data: Record<string, unknown>, options?: unknown) => {
              adminState.txSets.push({ ref, data, options });
            },
          };
          return callback(tx);
        },
        batch: () => ({
          update: (ref: unknown, data: Record<string, unknown>) => {
            adminState.batchUpdates.push({ ref, data });
          },
          commit: async () => {
            adminState.batchCommitted = true;
          },
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

type Callable = (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

const accept = acceptGridTransfer as unknown as Callable;
const cancel = cancelGridTransfer as unknown as Callable;
const create = createGridTransfer as unknown as Callable;
const decline = declineGridTransfer as unknown as Callable;
const preview = previewGridTransferAcceptance as unknown as Callable;
const sweepExpired = sweepExpiredGridTransfers as unknown as () => Promise<unknown>;

function transfer(overrides: Record<string, unknown> = {}) {
  return {
    id: "transfer-1",
    gridId: "grid-1",
    gridName: "Grid",
    fromUserId: "source",
    fromSlug: "source-slug",
    toUserId: "caller",
    removeOrphanedFiles: false,
    status: "pending",
    expiresAt: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  maintenance.noopIfMaintenance.mockReturnValue(false);
  callableUtils.getCallableData.mockImplementation((data: unknown) => data ?? {});
  callableUtils.requireAuth.mockReturnValue("caller");
  transferUtils.fieldValue.mockReturnValue(FieldValue);
  transferUtils.isExpired.mockReturnValue(false);
  transferUtils.normalizeGridId.mockImplementation((value: string) => value);
  transferUtils.normalizeRecipientRef.mockImplementation((value: unknown) => value);
  transferUtils.normalizeRemoveOrphanedFiles.mockImplementation(
    (value: boolean) => value,
  );
  transferUtils.normalizeTransferId.mockImplementation((value: string) => value);
  transferUtils.resolveRecipientUid.mockResolvedValue("recipient");
  transferUtils.readTransfer.mockResolvedValue({
    ref: { path: "gridTransfers/transfer-1" },
    transfer: transfer(),
  });
  transferUtils.gridTransfersCollection.mockReturnValue({
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn(async () => ({ empty: true, docs: [] })),
    doc: vi.fn(() => ({
      id: "transfer-new",
      set: vi.fn(),
    })),
  });
  transferUtils.getRecipientQuotaRemaining.mockResolvedValue({
    remaining: 100,
    isDevAccount: false,
  });
  transferUtils.timestampFromMillis.mockReturnValue({ millis: 0 });
  transferUtils.transferExpiresAt.mockReturnValue({ expires: true });
  acceptanceUtils.buildTransferInventory.mockResolvedValue({
    references: [{ hash: "hash-a" }],
    copyPlan: {
      additionalBytesRequired: 10,
      nonCopiableHashes: new Set(),
    },
    files: [{ hash: "hash-a" }],
  });
  acceptanceUtils.copyTransferArchiveObjects.mockResolvedValue({ hash: {} });
  acceptanceUtils.rewriteGridForTransfer.mockReturnValue({ userId: "caller" });
  adminState.gridSnap = {
    exists: true,
    data: () => ({
      userId: "source",
      name: "Grid",
      tiles: [{ i: "tile-1" }],
    }),
  };
  adminState.senderSnap = {
    data: () => ({ slug: "sender", email: "sender@example.com" }),
  };
  adminState.txGridSnap = { exists: true, data: () => ({ userId: "source" }) };
  adminState.txTransferSnap = { data: () => ({ status: "pending" }) };
  adminState.txUpdates = [];
  adminState.txSets = [];
  adminState.batchUpdates = [];
  adminState.batchCommitted = false;
});

describe("createGridTransfer", () => {
  it("creates a pending transfer after validating ownership and pending uniqueness", async () => {
    adminState.gridSnap = {
      exists: true,
      data: () => ({
        userId: "caller",
        name: "Grid",
        tiles: [{ i: "tile-1" }],
      }),
    };

    await expect(
      create(
        {
          gridId: "grid-1",
          recipient: { slug: "target" },
          removeOrphanedFiles: false,
        },
        { auth: { uid: "caller" } },
      ),
    ).resolves.toEqual({
      transferId: "transfer-new",
      status: "pending",
      estimatedBytes: 10,
    });

    const transferCollection = transferUtils.gridTransfersCollection.mock.results[1]
      .value as { doc: ReturnType<typeof vi.fn> };
    const transferRef = transferCollection.doc.mock.results[0].value as {
      set: ReturnType<typeof vi.fn>;
    };
    expect(transferRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        gridId: "grid-1",
        fromUserId: "caller",
        toUserId: "recipient",
        status: "pending",
        expiresAt: { expires: true },
      }),
    );
    expect(acceptanceUtils.buildTransferInventory).toHaveBeenCalledWith(
      expect.objectContaining({ assertQuota: false }),
    );
  });

  it("rejects self-transfer before reading the grid", async () => {
    transferUtils.resolveRecipientUid.mockResolvedValue("caller");

    await expect(
      create(
        { gridId: "grid-1", recipient: { slug: "caller" }, removeOrphanedFiles: false },
        { auth: { uid: "caller" } },
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("previewGridTransferAcceptance", () => {
  it("returns quota preview data without asserting quota", async () => {
    await expect(
      preview({ transferId: "transfer-1" }, { auth: { uid: "caller" } }),
    ).resolves.toEqual({
      additionalBytesRequired: 10,
      recipientQuotaRemaining: 100,
      wouldExceedQuota: false,
      files: [{ hash: "hash-a" }],
      nonCopiableCount: 0,
    });
    expect(acceptanceUtils.buildTransferInventory).toHaveBeenCalledWith(
      expect.objectContaining({ assertQuota: false }),
    );
  });

  it("marks expired transfers and rejects preview", async () => {
    transferUtils.isExpired.mockReturnValue(true);

    await expect(
      preview({ transferId: "transfer-1" }, { auth: { uid: "caller" } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(transferUtils.markTransferResolved).toHaveBeenCalledWith(
      { path: "gridTransfers/transfer-1" },
      "expired",
      { failureReason: "expired" },
    );
  });
});

describe("acceptGridTransfer", () => {
  it("copies files, rewrites the grid, accepts the transfer, and skips sender cleanup when not requested", async () => {
    await expect(
      accept({ transferId: "transfer-1" }, { auth: { uid: "caller" } }),
    ).resolves.toEqual({
      transferId: "transfer-1",
      gridId: "grid-1",
      status: "accepted",
    });

    expect(acceptanceUtils.buildTransferInventory).toHaveBeenCalledWith(
      expect.objectContaining({ assertQuota: true }),
    );
    expect(acceptanceUtils.copyTransferArchiveObjects).toHaveBeenCalled();
    expect(acceptanceUtils.deleteNotionAndUpvoteSubcollections).toHaveBeenCalledWith(
      "grid-1",
      [{ i: "tile-1" }],
    );
    expect(adminState.txUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ data: { userId: "caller" } }),
        expect.objectContaining({
          ref: { path: "gridTransfers/transfer-1" },
          data: expect.objectContaining({ status: "accepted" }),
        }),
      ]),
    );
    expect(acceptanceUtils.deleteSenderOrphanedFiles).not.toHaveBeenCalled();
  });

  it("deletes sender orphaned files only when requested", async () => {
    transferUtils.readTransfer.mockResolvedValue({
      ref: { path: "gridTransfers/transfer-1" },
      transfer: transfer({ removeOrphanedFiles: true }),
    });

    await accept({ transferId: "transfer-1" }, { auth: { uid: "caller" } });

    expect(acceptanceUtils.deleteSenderOrphanedFiles).toHaveBeenCalledWith({
      fromUserId: "source",
      gridId: "grid-1",
      transferredHashes: new Set(["hash-a"]),
    });
  });
});

describe("declineGridTransfer and cancelGridTransfer", () => {
  it("declines pending incoming transfers", async () => {
    await expect(
      decline({ transferId: "transfer-1" }, { auth: { uid: "caller" } }),
    ).resolves.toEqual({ transferId: "transfer-1", status: "declined" });
    expect(transferUtils.markTransferResolved).toHaveBeenCalledWith(
      { path: "gridTransfers/transfer-1" },
      "declined",
    );
  });

  it("cancels pending outgoing transfers", async () => {
    transferUtils.readTransfer.mockResolvedValue({
      ref: { path: "gridTransfers/transfer-1" },
      transfer: transfer({ fromUserId: "caller", toUserId: "target" }),
    });

    await expect(
      cancel({ transferId: "transfer-1" }, { auth: { uid: "caller" } }),
    ).resolves.toEqual({ transferId: "transfer-1", status: "cancelled" });
    expect(transferUtils.markTransferResolved).toHaveBeenCalledWith(
      { path: "gridTransfers/transfer-1" },
      "cancelled",
    );
  });
});

describe("sweepExpiredGridTransfers", () => {
  it("expires every pending transfer returned by the query", async () => {
    transferUtils.gridTransfersCollection.mockReturnValue({
      where: vi.fn().mockReturnThis(),
      get: vi.fn(async () => ({
        docs: [{ ref: { path: "gridTransfers/expired" } }],
      })),
    });

    await expect(sweepExpired()).resolves.toBeNull();

    expect(adminState.batchUpdates).toEqual([
      {
        ref: { path: "gridTransfers/expired" },
        data: expect.objectContaining({
          status: "expired",
          failureReason: "expired",
        }) as unknown as Record<string, unknown>,
      },
    ]);
    expect(adminState.batchCommitted).toBe(true);
  });
});
