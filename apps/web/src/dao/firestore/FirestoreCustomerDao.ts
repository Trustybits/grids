import {
  type Firestore,
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { CustomerDao } from "@grids/contracts/dao";

export class FirestoreCustomerDao implements CustomerDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async createCheckoutSession(
    userId: string,
    config: Record<string, unknown>,
  ): Promise<string> {
    const sessionsRef = collection(
      this.db,
      "customers",
      userId,
      "checkout_sessions",
    );
    const sessionDoc = await addDoc(sessionsRef, {
      ...config,
      created: serverTimestamp(),
    });
    return sessionDoc.id;
  }

  public subscribeToCheckoutSession(
    userId: string,
    sessionId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    const sessionDoc = doc(
      this.db,
      "customers",
      userId,
      "checkout_sessions",
      sessionId,
    );
    return onSnapshot(sessionDoc, (snap) => {
      callback((snap.data() as Record<string, unknown>) ?? null);
    });
  }

  public subscribeToActiveSubscriptions(
    userId: string,
    callback: (subscriptions: Array<Record<string, unknown>>) => void,
  ): () => void {
    const subsQuery = query(
      collection(this.db, "customers", userId, "subscriptions"),
      where("status", "in", ["active", "trialing", "past_due"]),
      limit(1),
    );
    return onSnapshot(subsQuery, (snap) => {
      const subscriptions = snap.docs.map(
        (d) => d.data() as Record<string, unknown>,
      );
      callback(subscriptions);
    });
  }

  public subscribeToPayments(
    userId: string,
    callback: (payments: Array<Record<string, unknown>>) => void,
  ): () => void {
    const paymentsQuery = query(
      collection(this.db, "customers", userId, "payments"),
      where("status", "==", "succeeded"),
    );
    return onSnapshot(paymentsQuery, (snap) => {
      const payments = snap.docs.map(
        (d) => d.data() as Record<string, unknown>,
      );
      callback(payments);
    });
  }
}
