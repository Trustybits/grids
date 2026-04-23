import type {
  CheckoutSessionConfig,
  IStripeService,
} from "../interfaces/IStripeService";

export class MockStripeService implements IStripeService {
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
}
