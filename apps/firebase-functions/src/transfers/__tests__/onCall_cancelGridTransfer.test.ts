import { beforeEach, describe, expect, it, vi } from "vitest";

const { maintenance, callableUtils, transferUtils } = vi.hoisted(() => ({
  maintenance: {
    noopIfMaintenance: vi.fn(() => false),
  },
  callableUtils: {
    getCallableData: vi.fn((data: unknown) => data ?? {}),
    requireAuth: vi.fn(() => "sender"),
  },
  transferUtils: {
    markTransferResolved: vi.fn(),
    normalizeTransferId: vi.fn((value: string) => value),
    readTransfer: vi.fn(),
  },
}));

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

import { cancelGridTransfer } from "../onCall_cancelGridTransfer.js";

const cancel = cancelGridTransfer as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  maintenance.noopIfMaintenance.mockReturnValue(false);
  callableUtils.getCallableData.mockImplementation((data: unknown) => data ?? {});
  callableUtils.requireAuth.mockReturnValue("sender");
  transferUtils.normalizeTransferId.mockImplementation((value: string) => value);
  transferUtils.readTransfer.mockResolvedValue({
    ref: { path: "gridTransfers/transfer-1" },
    transfer: {
      id: "transfer-1",
      fromUserId: "sender",
      status: "pending",
    },
  });
});

describe("cancelGridTransfer", () => {
  it("cancels a pending outgoing transfer", async () => {
    await expect(
      cancel({ transferId: "transfer-1" }, { auth: { uid: "sender" } }),
    ).resolves.toEqual({ transferId: "transfer-1", status: "cancelled" });

    expect(transferUtils.markTransferResolved).toHaveBeenCalledWith(
      { path: "gridTransfers/transfer-1" },
      "cancelled",
    );
  });

  it("rejects users who are not the sender", async () => {
    callableUtils.requireAuth.mockReturnValue("other-user");

    await expect(
      cancel({ transferId: "transfer-1" }, { auth: { uid: "other-user" } }),
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect(transferUtils.markTransferResolved).not.toHaveBeenCalled();
  });

  it("rejects transfers that are no longer pending", async () => {
    transferUtils.readTransfer.mockResolvedValue({
      ref: { path: "gridTransfers/transfer-1" },
      transfer: {
        id: "transfer-1",
        fromUserId: "sender",
        status: "accepted",
      },
    });

    await expect(
      cancel({ transferId: "transfer-1" }, { auth: { uid: "sender" } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });

    expect(transferUtils.markTransferResolved).not.toHaveBeenCalled();
  });
});
