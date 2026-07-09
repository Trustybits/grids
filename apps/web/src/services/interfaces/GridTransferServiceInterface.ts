import type {
  AcceptGridTransferResponse,
  CancelGridTransferResponse,
  CreateGridTransferResponse,
  DeclineGridTransferResponse,
  GridTransfer,
  GridTransferRecipientRef,
  GridTransferStatus,
  PreviewGridTransferAcceptanceResponse,
} from "@grids/contracts/types";

export interface GridTransferServiceInterface {
  createTransfer(
    gridId: string,
    recipient: GridTransferRecipientRef,
    removeOrphanedFiles: boolean,
  ): Promise<CreateGridTransferResponse>;

  previewTransferAcceptance(
    transferId: string,
  ): Promise<PreviewGridTransferAcceptanceResponse>;

  acceptTransfer(transferId: string): Promise<AcceptGridTransferResponse>;

  declineTransfer(transferId: string): Promise<DeclineGridTransferResponse>;

  cancelTransfer(transferId: string): Promise<CancelGridTransferResponse>;

  listIncomingTransfers(
    userId: string,
    status?: GridTransferStatus,
  ): Promise<GridTransfer[]>;

  listOutgoingTransfers(
    userId: string,
    status?: GridTransferStatus,
  ): Promise<GridTransfer[]>;

  subscribeIncomingTransfers(
    userId: string,
    callback: (transfers: GridTransfer[]) => void,
    status?: GridTransferStatus,
  ): () => void;

  subscribeOutgoingTransfers(
    userId: string,
    callback: (transfers: GridTransfer[]) => void,
    status?: GridTransferStatus,
  ): () => void;
}
