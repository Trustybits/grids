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
      requireAuth: vi.fn(() => "sender"),
    },
    transferUtils: {
      fieldValue: vi.fn(() => FieldValue),
      gridTransfersCollection: vi.fn(),
      normalizeGridId: vi.fn((value: string) => value),
      normalizeRecipientRef: vi.fn((value: unknown) => value),
      normalizeRemoveOrphanedFiles: vi.fn((value: boolean) => value),
      resolveRecipientUid: vi.fn(),
      transferExpiresAt: vi.fn(() => ({ expires: true })),
    },
    acceptanceUtils: {
      buildTransferInventory: vi.fn(),
    },
    adminState: {
      gridSnap: {
        exists: true,
        data: () => ({ userId: "sender", name: "Grid" }),
      } as { exists: boolean; data: () => Record<string, unknown> | undefined },
      senderSnap: {
        data: () => ({ slug: "sender-slug", email: "sender@example.com" }),
      },
    },
  };
});

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    https: {
      onCall: (handler: unknown) => handler,
    },
  })),
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

vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
      collection: (collectionName: string) => ({
        doc: (_docId: string) => {
          if (collectionName === "grids") {
            return { get: async () => adminState.gridSnap };
          }
          return { get: async () => adminState.senderSnap };
        },
      }),
    }),
  },
}));

import { createGridTransfer } from "../onCall_createGridTransfer.js";

const create = createGridTransfer as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  maintenance.noopIfMaintenance.mockReturnValue(false);
  callableUtils.getCallableData.mockImplementation((data: unknown) => data ?? {});
  callableUtils.requireAuth.mockReturnValue("sender");
  transferUtils.fieldValue.mockReturnValue(FieldValue);
  transferUtils.normalizeGridId.mockImplementation((value: string) => value);
  transferUtils.normalizeRecipientRef.mockImplementation((value: unknown) => value);
  transferUtils.normalizeRemoveOrphanedFiles.mockImplementation(
    (value: boolean) => value,
  );
  transferUtils.resolveRecipientUid.mockResolvedValue("recipient");
  transferUtils.transferExpiresAt.mockReturnValue({ expires: true });
  const transferRef = { id: "transfer-new", set: vi.fn() };
  transferUtils.gridTransfersCollection.mockReturnValue({
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn(async () => ({ empty: true })),
    doc: vi.fn(() => transferRef),
  });
  acceptanceUtils.buildTransferInventory.mockResolvedValue({
    copyPlan: { additionalBytesRequired: 25 },
  });
  adminState.gridSnap = {
    exists: true,
    data: () => ({ userId: "sender", name: "Grid" }),
  };
  adminState.senderSnap = {
    data: () => ({ slug: "sender-slug", email: "sender@example.com" }),
  };
});

describe("createGridTransfer", () => {
  it("returns null during maintenance without requiring auth", async () => {
    maintenance.noopIfMaintenance.mockReturnValue(true);

    await expect(create({}, {})).resolves.toBeNull();

    expect(callableUtils.requireAuth).not.toHaveBeenCalled();
  });

  it("creates a pending transfer with sender snapshots and estimated bytes", async () => {
    await expect(
      create(
        {
          gridId: "grid-1",
          recipient: { slug: "target" },
          removeOrphanedFiles: true,
        },
        { auth: { uid: "sender" } },
      ),
    ).resolves.toEqual({
      transferId: "transfer-new",
      status: "pending",
      estimatedBytes: 25,
    });

    const collection = transferUtils.gridTransfersCollection.mock.results[1].value as {
      doc: ReturnType<typeof vi.fn>;
    };
    const transferRef = collection.doc.mock.results[0].value as {
      set: ReturnType<typeof vi.fn>;
    };
    expect(transferRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "transfer-new",
        gridId: "grid-1",
        gridName: "Grid",
        fromUserId: "sender",
        fromSlug: "sender-slug",
        fromEmail: "sender@example.com",
        toUserId: "recipient",
        removeOrphanedFiles: true,
        status: "pending",
      }),
    );
    expect(acceptanceUtils.buildTransferInventory).toHaveBeenCalledWith({
      grid: expect.objectContaining({ userId: "sender" }),
      fromUserId: "sender",
      toUserId: "recipient",
      assertQuota: false,
    });
  });

  it("rejects self transfers before loading the grid", async () => {
    transferUtils.resolveRecipientUid.mockResolvedValue("sender");

    await expect(
      create(
        { gridId: "grid-1", recipient: { slug: "sender" }, removeOrphanedFiles: false },
        { auth: { uid: "sender" } },
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("rejects missing or non-owned grids", async () => {
    adminState.gridSnap = { exists: false, data: () => undefined };
    await expect(
      create(
        { gridId: "missing", recipient: { slug: "target" }, removeOrphanedFiles: false },
        { auth: { uid: "sender" } },
      ),
    ).rejects.toMatchObject({ code: "not-found" });

    adminState.gridSnap = {
      exists: true,
      data: () => ({ userId: "other", name: "Grid" }),
    };
    await expect(
      create(
        { gridId: "grid-1", recipient: { slug: "target" }, removeOrphanedFiles: false },
        { auth: { uid: "sender" } },
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
