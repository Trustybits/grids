export interface CheckoutSessionConfig {
  price?: string;
  line_items?: Array<{
    price_data: {
      currency: string;
      product_data: { name: string; description?: string };
      unit_amount: number;
    };
    quantity: number;
  }>;
  mode: "payment" | "subscription";
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  allow_promotion_codes?: boolean;
  billing_address_collection?: "auto" | "required";
}

export interface StripeServiceInterface {
  createCheckoutSession(config: CheckoutSessionConfig): Promise<string>;

  createSupporterCheckoutSession(amountCents: number): Promise<string>;

  createProCheckoutSession(interval: "month" | "year"): Promise<string>;

  createCustomerPortalSession(): Promise<string>;

  subscribeToActiveSubscriptions(
    userId: string,
    callback: (subscriptions: Array<Record<string, unknown>>) => void,
  ): () => void;

  subscribeToPayments(
    userId: string,
    callback: (payments: Array<Record<string, unknown>>) => void,
  ): () => void;
}
