import {
  type Firestore,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type {
  GridTransferDao,
  GridTransferSubscription,
} from "@grids/contracts/dao";
import type {
  GridTransfer,
  GridTransferStatus,
} from "@grids/contracts/types";

const COLLECTION = "gridTransfers";
const DEFAULT_STATUS: GridTransferStatus = "pending";

export class FirebaseGridTransferDao implements GridTransferDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async listIncomingTransfers(
    userId: string,
    status: GridTransferStatus = DEFAULT_STATUS,
  ): Promise<GridTransfer[]> {
    const snapshot = await getDocs(
      this.buildParticipantQuery("toUserId", userId, status),
    );
    return snapshot.docs.map((d) => ({
      ...(d.data() as Omit<GridTransfer, "id">),
      id: d.id,
    }));
  }

  public async listOutgoingTransfers(
    userId: string,
    status: GridTransferStatus = DEFAULT_STATUS,
  ): Promise<GridTransfer[]> {
    const snapshot = await getDocs(
      this.buildParticipantQuery("fromUserId", userId, status),
    );
    return snapshot.docs.map((d) => ({
      ...(d.data() as Omit<GridTransfer, "id">),
      id: d.id,
    }));
  }

  public subscribeIncomingTransfers(
    userId: string,
    callback: GridTransferSubscription,
    status: GridTransferStatus = DEFAULT_STATUS,
  ): () => void {
    return this.subscribe("toUserId", userId, status, callback);
  }

  public subscribeOutgoingTransfers(
    userId: string,
    callback: GridTransferSubscription,
    status: GridTransferStatus = DEFAULT_STATUS,
  ): () => void {
    return this.subscribe("fromUserId", userId, status, callback);
  }

  private subscribe(
    field: "fromUserId" | "toUserId",
    userId: string,
    status: GridTransferStatus,
    callback: GridTransferSubscription,
  ): () => void {
    return onSnapshot(
      this.buildParticipantQuery(field, userId, status),
      (snapshot) => {
        callback(
          snapshot.docs.map((d) => ({
            ...(d.data() as Omit<GridTransfer, "id">),
            id: d.id,
          })),
        );
      },
      () => callback([]),
    );
  }

  private buildParticipantQuery(
    field: "fromUserId" | "toUserId",
    userId: string,
    status: GridTransferStatus,
  ) {
    return query(
      collection(this.db, COLLECTION),
      where(field, "==", userId),
      where("status", "==", status),
      orderBy("createdAt", "desc"),
    );
  }
}
