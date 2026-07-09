import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type {
  CloudFunctionsDao,
  GridTransferDao,
} from "@grids/contracts/dao";
import type {
  AcceptGridTransferRequest,
  AcceptGridTransferResponse,
  CancelGridTransferRequest,
  CancelGridTransferResponse,
  CreateGridTransferRequest,
  CreateGridTransferResponse,
  DeclineGridTransferRequest,
  DeclineGridTransferResponse,
  GridTransfer,
  GridTransferRecipientRef,
  GridTransferStatus,
  PreviewGridTransferAcceptanceRequest,
  PreviewGridTransferAcceptanceResponse,
} from "@grids/contracts/types";
import type { GridTransferServiceInterface } from "./interfaces/GridTransferServiceInterface";

export class GridTransferService implements GridTransferServiceInterface {
  private cloudFunctionsDao: CloudFunctionsDao;
  private gridTransferDao: GridTransferDao;

  public constructor() {
    const factory = getDaoFactory();
    this.cloudFunctionsDao = factory.getCloudFunctionsDao();
    this.gridTransferDao = factory.getGridTransferDao();
  }

  public createTransfer(
    gridId: string,
    recipient: GridTransferRecipientRef,
    removeOrphanedFiles: boolean,
  ): Promise<CreateGridTransferResponse> {
    return this.cloudFunctionsDao.callFunction<
      CreateGridTransferRequest,
      CreateGridTransferResponse
    >("createGridTransfer", {
      gridId,
      recipient,
      removeOrphanedFiles,
    });
  }

  public previewTransferAcceptance(
    transferId: string,
  ): Promise<PreviewGridTransferAcceptanceResponse> {
    return this.cloudFunctionsDao.callFunction<
      PreviewGridTransferAcceptanceRequest,
      PreviewGridTransferAcceptanceResponse
    >("previewGridTransferAcceptance", { transferId });
  }

  public acceptTransfer(
    transferId: string,
  ): Promise<AcceptGridTransferResponse> {
    return this.cloudFunctionsDao.callFunction<
      AcceptGridTransferRequest,
      AcceptGridTransferResponse
    >("acceptGridTransfer", { transferId });
  }

  public declineTransfer(
    transferId: string,
  ): Promise<DeclineGridTransferResponse> {
    return this.cloudFunctionsDao.callFunction<
      DeclineGridTransferRequest,
      DeclineGridTransferResponse
    >("declineGridTransfer", { transferId });
  }

  public cancelTransfer(
    transferId: string,
  ): Promise<CancelGridTransferResponse> {
    return this.cloudFunctionsDao.callFunction<
      CancelGridTransferRequest,
      CancelGridTransferResponse
    >("cancelGridTransfer", { transferId });
  }

  public listIncomingTransfers(
    userId: string,
    status?: GridTransferStatus,
  ): Promise<GridTransfer[]> {
    return this.gridTransferDao.listIncomingTransfers(userId, status);
  }

  public listOutgoingTransfers(
    userId: string,
    status?: GridTransferStatus,
  ): Promise<GridTransfer[]> {
    return this.gridTransferDao.listOutgoingTransfers(userId, status);
  }

  public subscribeIncomingTransfers(
    userId: string,
    callback: (transfers: GridTransfer[]) => void,
    status?: GridTransferStatus,
  ): () => void {
    return this.gridTransferDao.subscribeIncomingTransfers(
      userId,
      callback,
      status,
    );
  }

  public subscribeOutgoingTransfers(
    userId: string,
    callback: (transfers: GridTransfer[]) => void,
    status?: GridTransferStatus,
  ): () => void {
    return this.gridTransferDao.subscribeOutgoingTransfers(
      userId,
      callback,
      status,
    );
  }
}
