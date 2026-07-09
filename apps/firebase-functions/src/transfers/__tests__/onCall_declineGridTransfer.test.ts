import { beforeEach, describe, expect, it, vi } from "vitest";

const { maintenance, callableUtils, transferUtils } = vi.hoisted(() => ({
  maintenance: {
    noopIfMaintenance: vi.fn(() => false),
  },
  callableUtils: {
    getCallableData: vi.fn((data: unknown) => data ?? {}),
    requireAuth: vi.fn(() => "recipient"),
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

import { declineGridTransfer } from "../onCall_declineGridTransfer.js";

const decline = declineGridTransfer as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  maintenance.noopIfMaintenance.mockReturnValue(false);
  callableUtils.getCallableData.mockImplementation((data: unknown) => data ?? {});
  callableUtils.requireAuth.mockReturnValue("recipient");
  transferUtils.normalizeTransferId.mockImplementation((value: string) => value);
  transferUtils.readTransfer.mockResolvedValue({
    ref: { path: "gridTransfers/transfer-1" },
    transfer: {
      id: "transfer-1",
      toUserId: "recipient",
      status: "pending",
    },
  });
});

describe("declineGridTransfer", () => {
  it("returns null during maintenance without requiring auth", async () => {
    maintenance.noopIfMaintenance.mockReturnValue(true);

    await expect(decline({}, {})).resolves.toBeNull();

    expect(callableUtils.requireAuth).not.toHaveBeenCalled();
    expect(transferUtils.readTransfer).not.toHaveBeenCalled();
  });

  it("declines a pending incoming transfer", async () => {
    await expect(
      decline({ transferId: "transfer-1" }, { auth: { uid: "recipient" } }),
    ).resolves.toEqual({ transferId: "transfer-1", status: "declined" });

    expect(transferUtils.normalizeTransferId).toHaveBeenCalledWith("transfer-1");
    expect(transferUtils.markTransferResolved).toHaveBeenCalledWith(
      { path: "gridTransfers/transfer-1" },
      "declined",
    );
  });

  it("rejects users who are not the recipient", async () => {
    callableUtils.requireAuth.mockReturnValue("other-user");

    await expect(
      decline({ transferId: "transfer-1" }, { auth: { uid: "other-user" } }),
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect(transferUtils.markTransferResolved).not.toHaveBeenCalled();
  });

  it("rejects transfers that are no longer pending", async () => {
    transferUtils.readTransfer.mockResolvedValue({
      ref: { path: "gridTransfers/transfer-1" },
      transfer: {
        id: "transfer-1",
        toUserId: "recipient",
        status: "accepted",
      },
    });

    await expect(
      decline({ transferId: "transfer-1" }, { auth: { uid: "recipient" } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });

    expect(transferUtils.markTransferResolved).not.toHaveBeenCalled();
  });
});
