import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GridTransfer } from "@grids/contracts/types";
import { memoryDatabase } from "../StubbedMemoryDatabase";
import { StubbedGridTransferDao } from "../StubbedGridTransferDao";
import { flushMicrotasks, resetMemoryDatabase } from "./memoryTestUtils";

const pendingIncoming: GridTransfer = {
  id: "incoming",
  gridId: "grid-1",
  gridName: "Incoming",
  fromUserId: "sender",
  toUserId: "recipient",
  removeOrphanedFiles: false,
  status: "pending",
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  expiresAt: new Date("2026-01-16T00:00:00.000Z"),
};

const olderOutgoing: GridTransfer = {
  ...pendingIncoming,
  id: "outgoing",
  gridId: "grid-2",
  gridName: "Outgoing",
  fromUserId: "recipient",
  toUserId: "other",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  resetMemoryDatabase();
  memoryDatabase.gridTransfers.set(pendingIncoming.id, pendingIncoming);
  memoryDatabase.gridTransfers.set(olderOutgoing.id, olderOutgoing);
  memoryDatabase.gridTransfers.set("accepted", {
    ...pendingIncoming,
    id: "accepted",
    status: "accepted",
  });
});

describe("StubbedGridTransferDao", () => {
  it("lists pending incoming transfers for a recipient", async () => {
    const dao = new StubbedGridTransferDao();

    await expect(dao.listIncomingTransfers("recipient")).resolves.toEqual([
      pendingIncoming,
    ]);
  });

  it("lists outgoing transfers for a sender and status", async () => {
    const dao = new StubbedGridTransferDao();

    await expect(
      dao.listOutgoingTransfers("recipient", "pending"),
    ).resolves.toEqual([olderOutgoing]);
    await expect(
      dao.listIncomingTransfers("recipient", "accepted"),
    ).resolves.toEqual([
      expect.objectContaining({ id: "accepted", status: "accepted" }),
    ]);
  });

  it("emits subscribed transfer lists immediately", async () => {
    const dao = new StubbedGridTransferDao();
    const callback = vi.fn();

    const unsubscribe = dao.subscribeIncomingTransfers("recipient", callback);
    await flushMicrotasks();
    unsubscribe();

    expect(callback).toHaveBeenCalledWith([pendingIncoming]);
  });
});
