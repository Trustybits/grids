import type { GridTransferDao } from "@grids/contracts/dao";
import type {
  GridTransfer,
  GridTransferStatus,
} from "@grids/contracts/types";
import {
  channel,
  cloneValue,
  emit,
  memoryDatabase,
  subscribeToValue,
} from "./StubbedMemoryDatabase";

const DEFAULT_STATUS: GridTransferStatus = "pending";
const GRID_TRANSFERS_CHANNEL = channel("gridTransfers");

export function emitGridTransfersChanged(): void {
  emit(GRID_TRANSFERS_CHANNEL);
}

export class StubbedGridTransferDao implements GridTransferDao {
  public listIncomingTransfers(
    userId: string,
    status: GridTransferStatus = DEFAULT_STATUS,
  ): Promise<GridTransfer[]> {
    return Promise.resolve(this.findByParticipant("toUserId", userId, status));
  }

  public listOutgoingTransfers(
    userId: string,
    status: GridTransferStatus = DEFAULT_STATUS,
  ): Promise<GridTransfer[]> {
    return Promise.resolve(this.findByParticipant("fromUserId", userId, status));
  }

  public subscribeIncomingTransfers(
    userId: string,
    callback: (transfers: GridTransfer[]) => void,
    status: GridTransferStatus = DEFAULT_STATUS,
  ): () => void {
    return subscribeToValue(
      GRID_TRANSFERS_CHANNEL,
      () => this.findByParticipant("toUserId", userId, status),
      callback,
    );
  }

  public subscribeOutgoingTransfers(
    userId: string,
    callback: (transfers: GridTransfer[]) => void,
    status: GridTransferStatus = DEFAULT_STATUS,
  ): () => void {
    return subscribeToValue(
      GRID_TRANSFERS_CHANNEL,
      () => this.findByParticipant("fromUserId", userId, status),
      callback,
    );
  }

  private findByParticipant(
    field: "fromUserId" | "toUserId",
    userId: string,
    status: GridTransferStatus,
  ): GridTransfer[] {
    return Array.from(memoryDatabase.gridTransfers.values())
      .filter(
        (transfer) =>
          transfer[field] === userId && transfer.status === status,
      )
      .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
      .map((transfer) => cloneValue(transfer));
  }
}

function timestampMillis(value: GridTransfer["createdAt"]): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  return value.toDate().getTime();
}
