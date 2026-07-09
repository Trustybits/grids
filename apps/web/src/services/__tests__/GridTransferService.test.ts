import { beforeEach, describe, expect, it, vi } from "vitest";
import { GridTransferService } from "@/services/GridTransferService";
import { registerTestDaoFactory } from "./testHelpers";
import type {
  CloudFunctionsDao,
  GridTransferDao,
} from "@grids/contracts/dao";
import type { GridTransfer } from "@grids/contracts/types";

const transfer: GridTransfer = {
  id: "transfer-1",
  gridId: "grid-1",
  gridName: "Grid",
  fromUserId: "sender",
  toUserId: "recipient",
  removeOrphanedFiles: false,
  status: "pending",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  expiresAt: new Date("2026-01-15T00:00:00.000Z"),
};

let callFunction: ReturnType<typeof vi.fn>;
let cloudFunctionsDao: CloudFunctionsDao;
let gridTransferDao: GridTransferDao & {
  listIncomingTransfers: ReturnType<typeof vi.fn>;
  listOutgoingTransfers: ReturnType<typeof vi.fn>;
  subscribeIncomingTransfers: ReturnType<typeof vi.fn>;
  subscribeOutgoingTransfers: ReturnType<typeof vi.fn>;
};
let service: GridTransferService;

beforeEach(() => {
  callFunction = vi.fn();
  cloudFunctionsDao = {
    callFunction: callFunction as CloudFunctionsDao["callFunction"],
  };
  gridTransferDao = {
    listIncomingTransfers: vi.fn().mockResolvedValue([transfer]),
    listOutgoingTransfers: vi.fn().mockResolvedValue([transfer]),
    subscribeIncomingTransfers: vi.fn(() => vi.fn()),
    subscribeOutgoingTransfers: vi.fn(() => vi.fn()),
  };
  registerTestDaoFactory({
    getCloudFunctionsDao: () => cloudFunctionsDao,
    getGridTransferDao: () => gridTransferDao,
  });
  service = new GridTransferService();
});

describe("GridTransferService", () => {
  it("calls createGridTransfer with typed payload fields", async () => {
    callFunction.mockResolvedValue({
      transferId: "transfer-1",
      status: "pending",
      estimatedBytes: 12,
    });

    await expect(
      service.createTransfer("grid-1", { slug: "recipient" }, true),
    ).resolves.toEqual({
      transferId: "transfer-1",
      status: "pending",
      estimatedBytes: 12,
    });
    expect(callFunction).toHaveBeenCalledWith(
      "createGridTransfer",
      {
        gridId: "grid-1",
        recipient: { slug: "recipient" },
        removeOrphanedFiles: true,
      },
    );
  });

  it("calls preview and resolution transfer callables", async () => {
    callFunction
      .mockResolvedValueOnce({ additionalBytesRequired: 0 })
      .mockResolvedValueOnce({
        transferId: "transfer-1",
        gridId: "grid-1",
        status: "accepted",
      })
      .mockResolvedValueOnce({ transferId: "transfer-1", status: "declined" })
      .mockResolvedValueOnce({ transferId: "transfer-1", status: "cancelled" });

    await service.previewTransferAcceptance("transfer-1");
    await service.acceptTransfer("transfer-1");
    await service.declineTransfer("transfer-1");
    await service.cancelTransfer("transfer-1");

    expect(callFunction).toHaveBeenNthCalledWith(
      1,
      "previewGridTransferAcceptance",
      { transferId: "transfer-1" },
    );
    expect(callFunction).toHaveBeenNthCalledWith(
      2,
      "acceptGridTransfer",
      { transferId: "transfer-1" },
    );
    expect(callFunction).toHaveBeenNthCalledWith(
      3,
      "declineGridTransfer",
      { transferId: "transfer-1" },
    );
    expect(callFunction).toHaveBeenNthCalledWith(
      4,
      "cancelGridTransfer",
      { transferId: "transfer-1" },
    );
  });

  it("delegates incoming and outgoing transfer reads to the DAO", async () => {
    await expect(
      service.listIncomingTransfers("recipient"),
    ).resolves.toEqual([transfer]);
    await expect(
      service.listOutgoingTransfers("sender", "accepted"),
    ).resolves.toEqual([transfer]);

    expect(gridTransferDao.listIncomingTransfers).toHaveBeenCalledWith(
      "recipient",
      undefined,
    );
    expect(gridTransferDao.listOutgoingTransfers).toHaveBeenCalledWith(
      "sender",
      "accepted",
    );
  });

  it("delegates transfer subscriptions to the DAO", () => {
    const incomingCallback = vi.fn();
    const outgoingCallback = vi.fn();
    const unsubscribeIncoming = service.subscribeIncomingTransfers(
      "recipient",
      incomingCallback,
    );
    const unsubscribeOutgoing = service.subscribeOutgoingTransfers(
      "sender",
      outgoingCallback,
      "cancelled",
    );

    expect(unsubscribeIncoming).toEqual(expect.any(Function));
    expect(unsubscribeOutgoing).toEqual(expect.any(Function));
    expect(gridTransferDao.subscribeIncomingTransfers).toHaveBeenCalledWith(
      "recipient",
      incomingCallback,
      undefined,
    );
    expect(gridTransferDao.subscribeOutgoingTransfers).toHaveBeenCalledWith(
      "sender",
      outgoingCallback,
      "cancelled",
    );
  });
});
