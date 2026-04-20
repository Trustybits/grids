import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { CustomerDao } from "@/dao/interfaces/CustomerDao";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import type {
  CheckoutSessionConfig,
  IStripeService,
} from "./interfaces/IStripeService";

const CHECKOUT_TIMEOUT_MS = 15_000;

export class StripeService implements IStripeService {
  private customerDao: CustomerDao;

  constructor() {
    const factory = getDaoFactory();
    this.customerDao = factory.getCustomerDao();
  }

  private requireUserId(): string {
    const userId = getAuthProvider().getCurrentUserId();
    if (!userId) throw new Error("Must be signed in to initiate checkout");
    return userId;
  }

  private origin(): string {
    return window.location.origin;
  }

  async createCheckoutSession(config: CheckoutSessionConfig): Promise<string> {
    const userId = this.requireUserId();
    const sessionId = await this.customerDao.createCheckoutSession(
      userId,
      { ...config } as Record<string, unknown>,
    );

    return new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error("Checkout session timed out. Please try again."));
      }, CHECKOUT_TIMEOUT_MS);

      const unsubscribe = this.customerDao.subscribeToCheckoutSession(
        userId,
        sessionId,
        (data) => {
          if (!data) return;

          if (data.error) {
            clearTimeout(timeoutId);
            unsubscribe();
            const errObj = data.error as Record<string, unknown> | undefined;
            reject(
              new Error(
                (errObj?.message as string) ?? "Stripe checkout failed",
              ),
            );
            return;
          }

          if (data.url) {
            clearTimeout(timeoutId);
            unsubscribe();
            resolve(data.url as string);
          }
        },
      );
    });
  }

  async createSupporterCheckoutSession(amountCents: number): Promise<string> {
    if (amountCents < 50) {
      throw new Error(
        "Minimum Stripe charge is $0.50. For free badges, use grantFreeSupporterBadge().",
      );
    }

    return this.createCheckoutSession({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Grids Supporter",
              description:
                "Support Grids and unlock the Supporter badge + remove branding",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${this.origin()}/dashboard?payment=supporter_success`,
      cancel_url: `${this.origin()}/pricing`,
      metadata: { type: "supporter" },
    });
  }

  async createProCheckoutSession(
    interval: "month" | "year",
  ): Promise<string> {
    const priceId =
      interval === "month"
        ? import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID
        : import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID;

    if (!priceId) {
      throw new Error(
        `Stripe price ID not configured. Set VITE_STRIPE_PRO_${interval.toUpperCase()}LY_PRICE_ID in your .env`,
      );
    }

    return this.createCheckoutSession({
      mode: "subscription",
      price: priceId,
      success_url: `${this.origin()}/dashboard?payment=pro_success`,
      cancel_url: `${this.origin()}/pricing`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: { type: "pro", interval },
    });
  }

  async createCustomerPortalSession(): Promise<string> {
    this.requireUserId();

    const { getFunctions, httpsCallable } = await import("firebase/functions");
    const fns = getFunctions();
    const createPortal = httpsCallable<
      { returnUrl: string },
      { url: string }
    >(fns, "ext-firestore-stripe-payments-createPortalLink");

    const { data } = await createPortal({
      returnUrl: `${this.origin()}/dashboard`,
    });

    return data.url;
  }

  subscribeToActiveSubscriptions(
    userId: string,
    callback: (subscriptions: Array<Record<string, unknown>>) => void,
  ): () => void {
    return this.customerDao.subscribeToActiveSubscriptions(userId, callback);
  }
}
