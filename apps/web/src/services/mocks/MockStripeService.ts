import type {
  CheckoutSessionConfig,
  StripeServiceInterface,
} from "../interfaces/StripeServiceInterface";

export class MockStripeService implements StripeServiceInterface {
  createCheckoutSession(_config: CheckoutSessionConfig): Promise<string> {
    throw new Error("Method not implemented.");
  }

  createSupporterCheckoutSession(_amountCents: number): Promise<string> {
    throw new Error("Method not implemented.");
  }

  createProCheckoutSession(_interval: "month" | "year"): Promise<string> {
    throw new Error("Method not implemented.");
  }

  createCustomerPortalSession(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  subscribeToActiveSubscriptions(
    _userId: string,
    _callback: (subscriptions: Array<Record<string, unknown>>) => void,
  ): () => void {
    throw new Error("Method not implemented.");
  }

  subscribeToPayments(
    _userId: string,
    _callback: (payments: Array<Record<string, unknown>>) => void,
  ): () => void {
    throw new Error("Method not implemented.");
  }
}
