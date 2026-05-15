import type { CustomerDao } from "@/dao/interfaces/CustomerDao";

export class StubbedCustomerDao implements CustomerDao {
  public createCheckoutSession(
    _userId: string,
    _config: Record<string, unknown>,
  ): Promise<string> {
    throw new Error("Stubbed DAO implementation");
  }

  public subscribeToCheckoutSession(
    _userId: string,
    _sessionId: string,
    _callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }

  public subscribeToActiveSubscriptions(
    _userId: string,
    _callback: (subscriptions: Array<Record<string, unknown>>) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }

  public subscribeToPayments(
    _userId: string,
    _callback: (payments: Array<Record<string, unknown>>) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }
}
