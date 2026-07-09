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
import type { GridTransferServiceInterface } from "../interfaces/GridTransferServiceInterface";

export class MockGridTransferService implements GridTransferServiceInterface {
  createTransfer(
    _gridId: string,
    _recipient: GridTransferRecipientRef,
    _removeOrphanedFiles: boolean,
  ): Promise<CreateGridTransferResponse> {
    throw new Error("Method not implemented.");
  }

  previewTransferAcceptance(
    _transferId: string,
  ): Promise<PreviewGridTransferAcceptanceResponse> {
    throw new Error("Method not implemented.");
  }

  acceptTransfer(_transferId: string): Promise<AcceptGridTransferResponse> {
    throw new Error("Method not implemented.");
  }

  declineTransfer(_transferId: string): Promise<DeclineGridTransferResponse> {
    throw new Error("Method not implemented.");
  }

  cancelTransfer(_transferId: string): Promise<CancelGridTransferResponse> {
    throw new Error("Method not implemented.");
  }

  listIncomingTransfers(
    _userId: string,
    _status?: GridTransferStatus,
  ): Promise<GridTransfer[]> {
    throw new Error("Method not implemented.");
  }

  listOutgoingTransfers(
    _userId: string,
    _status?: GridTransferStatus,
  ): Promise<GridTransfer[]> {
    throw new Error("Method not implemented.");
  }

  subscribeIncomingTransfers(
    _userId: string,
    _callback: (transfers: GridTransfer[]) => void,
    _status?: GridTransferStatus,
  ): () => void {
    throw new Error("Method not implemented.");
  }

  subscribeOutgoingTransfers(
    _userId: string,
    _callback: (transfers: GridTransfer[]) => void,
    _status?: GridTransferStatus,
  ): () => void {
    throw new Error("Method not implemented.");
  }
}
