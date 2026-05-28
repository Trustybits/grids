import type { CustomerDao } from "@grids/contracts/dao";
import {
  channel,
  createId,
  emit,
  memoryDatabase,
  subscribeToValue,
} from "./StubbedMemoryDatabase";

export class StubbedCustomerDao implements CustomerDao {
  public async createCheckoutSession(
    userId: string,
    config: Record<string, unknown>,
  ): Promise<string> {
    const sessionId = createId("checkout");
    const successUrl =
      typeof config.success_url === "string"
        ? config.success_url
        : this.localUrl("/dashboard");
    memoryDatabase.checkoutSessions.set(`${userId}/${sessionId}`, {
      ...config,
      id: sessionId,
      url: successUrl,
      created: new Date(),
    });
    emit(channel("checkout", userId, sessionId));
    return sessionId;
  }

  public subscribeToCheckoutSession(
    userId: string,
    sessionId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    return subscribeToValue(
      channel("checkout", userId, sessionId),
      () =>
        memoryDatabase.checkoutSessions.get(`${userId}/${sessionId}`) ?? null,
      callback,
    );
  }

  public subscribeToActiveSubscriptions(
    userId: string,
    callback: (subscriptions: Array<Record<string, unknown>>) => void,
  ): () => void {
    return subscribeToValue(
      channel("subscriptions", userId),
      () => memoryDatabase.subscriptions.get(userId) ?? [],
      callback,
    );
  }

  public subscribeToPayments(
    userId: string,
    callback: (payments: Array<Record<string, unknown>>) => void,
  ): () => void {
    return subscribeToValue(
      channel("payments", userId),
      () => memoryDatabase.payments.get(userId) ?? [],
      callback,
    );
  }

  private localUrl(path: string): string {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }
}
