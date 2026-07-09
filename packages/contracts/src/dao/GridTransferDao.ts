import type {
  GridTransfer,
  GridTransferStatus,
} from "../types/GridTransfer.js";

export type GridTransferSubscription = (
  transfers: GridTransfer[],
) => void;

export interface GridTransferDao {
  /** Query transfers where the user is the recipient. */
  listIncomingTransfers(
    userId: string,
    status?: GridTransferStatus,
  ): Promise<GridTransfer[]>;

  /** Query transfers where the user is the sender. */
  listOutgoingTransfers(
    userId: string,
    status?: GridTransferStatus,
  ): Promise<GridTransfer[]>;

  /** Subscribe to transfers where the user is the recipient. */
  subscribeIncomingTransfers(
    userId: string,
    callback: GridTransferSubscription,
    status?: GridTransferStatus,
  ): () => void;

  /** Subscribe to transfers where the user is the sender. */
  subscribeOutgoingTransfers(
    userId: string,
    callback: GridTransferSubscription,
    status?: GridTransferStatus,
  ): () => void;
}
