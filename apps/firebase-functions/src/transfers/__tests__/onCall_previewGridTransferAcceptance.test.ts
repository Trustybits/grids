import { beforeEach, describe, expect, it, vi } from "vitest";

const { adminState, maintenance, callableUtils, transferUtils, acceptanceUtils } =
  vi.hoisted(() => ({
    maintenance: {
      noopIfMaintenance: vi.fn(() => false),
    },
    callableUtils: {
      getCallableData: vi.fn((data: unknown) => data ?? {}),
      requireAuth: vi.fn(() => "recipient"),
    },
    transferUtils: {
      getRecipientQuotaRemaining: vi.fn(),
      isExpired: vi.fn(() => false),
      markTransferResolved: vi.fn(),
      normalizeTransferId: vi.fn((value: string) => value),
      readTransfer: vi.fn(),
    },
    acceptanceUtils: {
      buildTransferInventory: vi.fn(),
    },
    adminState: {
      gridSnap: {
        exists: true,
        data: () => ({ userId: "sender" }),
      },
    },
  }));

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
vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => adminState.gridSnap,
        }),
      }),
    }),
  },
}));

import { previewGridTransferAcceptance } from "../onCall_previewGridTransferAcceptance.js";

const preview = previewGridTransferAcceptance as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  maintenance.noopIfMaintenance.mockReturnValue(false);
  callableUtils.requireAuth.mockReturnValue("recipient");
  transferUtils.isExpired.mockReturnValue(false);
  transferUtils.normalizeTransferId.mockImplementation((value: string) => value);
  transferUtils.readTransfer.mockResolvedValue({
    ref: { path: "gridTransfers/transfer-1" },
    transfer: {
      id: "transfer-1",
      gridId: "grid-1",
      fromUserId: "sender",
      toUserId: "recipient",
      status: "pending",
      expiresAt: {},
    },
  });
  acceptanceUtils.buildTransferInventory.mockResolvedValue({
    copyPlan: {
      additionalBytesRequired: 40,
      nonCopiableHashes: new Set(["missing"]),
    },
    files: [{ hash: "hash-a", alreadyOwned: false }],
  });
  transferUtils.getRecipientQuotaRemaining.mockResolvedValue({
    remaining: 25,
    isDevAccount: false,
  });
  adminState.gridSnap = {
    exists: true,
    data: () => ({ userId: "sender" }),
  };
});

describe("previewGridTransferAcceptance", () => {
  it("returns quota and file preview without asserting quota", async () => {
    await expect(
      preview({ transferId: "transfer-1" }, { auth: { uid: "recipient" } }),
    ).resolves.toEqual({
      additionalBytesRequired: 40,
      recipientQuotaRemaining: 25,
      wouldExceedQuota: true,
      files: [{ hash: "hash-a", alreadyOwned: false }],
      nonCopiableCount: 1,
    });

    expect(acceptanceUtils.buildTransferInventory).toHaveBeenCalledWith({
      grid: expect.objectContaining({ userId: "sender" }),
      fromUserId: "sender",
      toUserId: "recipient",
      assertQuota: false,
    });
  });

  it("rejects non-recipient preview attempts", async () => {
    callableUtils.requireAuth.mockReturnValue("other");

    await expect(
      preview({ transferId: "transfer-1" }, { auth: { uid: "other" } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("marks expired transfers before rejecting", async () => {
    transferUtils.isExpired.mockReturnValue(true);

    await expect(
      preview({ transferId: "transfer-1" }, { auth: { uid: "recipient" } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(transferUtils.markTransferResolved).toHaveBeenCalledWith(
      { path: "gridTransfers/transfer-1" },
      "expired",
      { failureReason: "expired" },
    );
  });
});
