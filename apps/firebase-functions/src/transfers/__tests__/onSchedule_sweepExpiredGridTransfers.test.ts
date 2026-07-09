import { beforeEach, describe, expect, it, vi } from "vitest";

const { maintenance, transferUtils, adminState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
  };
  return {
    FieldValue,
    maintenance: {
      noopIfMaintenance: vi.fn(() => false),
    },
    transferUtils: {
      fieldValue: vi.fn(() => FieldValue),
      gridTransfersCollection: vi.fn(),
      timestampFromMillis: vi.fn(() => ({ now: true })),
    },
    adminState: {
      batchUpdates: [] as Array<{ ref: unknown; data: Record<string, unknown> }>,
      batchCommitted: false,
    },
  };
});

vi.mock("firebase-functions/v1", () => ({
  pubsub: {
    schedule: () => ({
      timeZone: () => ({
        onRun: (handler: unknown) => handler,
      }),
    }),
  },
}));

vi.mock("../../maintenance.js", () => maintenance);
vi.mock("../utils_gridTransfer.js", () => transferUtils);
vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
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
}));

import { sweepExpiredGridTransfers } from "../onSchedule_sweepExpiredGridTransfers.js";

const sweepExpired = sweepExpiredGridTransfers as unknown as () => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  maintenance.noopIfMaintenance.mockReturnValue(false);
  transferUtils.fieldValue.mockReturnValue(FieldValue);
  transferUtils.timestampFromMillis.mockReturnValue({ now: true });
  transferUtils.gridTransfersCollection.mockReturnValue({
    where: vi.fn().mockReturnThis(),
    get: vi.fn(async () => ({
      docs: [
        { ref: { path: "gridTransfers/expired-a" } },
        { ref: { path: "gridTransfers/expired-b" } },
      ],
    })),
  });
  adminState.batchUpdates = [];
  adminState.batchCommitted = false;
});

describe("sweepExpiredGridTransfers", () => {
  it("returns null without querying transfers during maintenance", async () => {
    maintenance.noopIfMaintenance.mockReturnValue(true);

    await expect(sweepExpired()).resolves.toBeNull();

    expect(transferUtils.gridTransfersCollection).not.toHaveBeenCalled();
    expect(adminState.batchCommitted).toBe(false);
  });

  it("marks every expired pending transfer as expired and commits once", async () => {
    await expect(sweepExpired()).resolves.toBeNull();

    expect(transferUtils.gridTransfersCollection).toHaveBeenCalledTimes(1);
    expect(adminState.batchUpdates).toEqual([
      {
        ref: { path: "gridTransfers/expired-a" },
        data: expect.objectContaining({
          status: "expired",
          failureReason: "expired",
        }) as unknown as Record<string, unknown>,
      },
      {
        ref: { path: "gridTransfers/expired-b" },
        data: expect.objectContaining({
          status: "expired",
          failureReason: "expired",
        }) as unknown as Record<string, unknown>,
      },
    ]);
    expect(adminState.batchCommitted).toBe(true);
  });
});
