import type { Firestore } from "firebase/firestore";
import type { CustomerDao } from "../interfaces/CustomerDao";

export class FirestoreCustomerDao implements CustomerDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public createCheckoutSession(
    _userId: string,
    _config: Record<string, unknown>,
  ): Promise<string> {
    throw new Error(
      "FirestoreCustomerDao.createCheckoutSession not implemented",
    );
  }

  public subscribeToCheckoutSession(
    _userId: string,
    _sessionId: string,
    _callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    throw new Error(
      "FirestoreCustomerDao.subscribeToCheckoutSession not implemented",
    );
  }

  public subscribeToActiveSubscriptions(
    _userId: string,
    _callback: (subscriptions: Array<Record<string, unknown>>) => void,
  ): () => void {
    throw new Error(
      "FirestoreCustomerDao.subscribeToActiveSubscriptions not implemented",
    );
  }
}
