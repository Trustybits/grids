// Unit tests for StripeService — CustomerDao and CloudFunctionsDao are mocked
// via the DAO factory singleton, and the AuthProvider is mocked via its
// singleton. window.location.origin comes from jsdom; Stripe price-id env vars
// are stubbed per-test; fake timers drive the checkout-session timeout.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerAuthProvider } from "@/auth/AuthProviderSingleton";
import { StripeService } from "@/services/StripeService";
import type { CustomerDao } from "@grids/contracts/dao";
import type { CloudFunctionsDao } from "@grids/contracts/dao";
import type { AuthProvider } from "@grids/contracts/auth";
import { registerTestDaoFactory } from "./testHelpers";

let mockCustomerDao: Record<string, ReturnType<typeof vi.fn>>;
let mockCloudFunctionsDao: Record<string, ReturnType<typeof vi.fn>>;
let mockAuthProvider: Record<string, ReturnType<typeof vi.fn>>;

const ORIGIN = window.location.origin;

beforeEach(() => {
  mockCustomerDao = {
    createCheckoutSession: vi.fn(),
    subscribeToCheckoutSession: vi.fn(),
    subscribeToActiveSubscriptions: vi.fn(),
    subscribeToPayments: vi.fn(),
  };
  mockCloudFunctionsDao = {
    callFunction: vi.fn(),
  };
  mockAuthProvider = {
    getCurrentUserId: vi.fn(() => "user-1"),
  };

  registerTestDaoFactory({
    getCustomerDao: () => mockCustomerDao as unknown as CustomerDao,
    getCloudFunctionsDao: () =>
      mockCloudFunctionsDao as unknown as CloudFunctionsDao,
  });

  registerAuthProvider(mockAuthProvider as unknown as AuthProvider);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const baseConfig = {
  mode: "payment" as const,
  success_url: "s",
  cancel_url: "c",
};

// The real CustomerDao subscription contract fires snapshots asynchronously,
// AFTER subscribeToCheckoutSession returns its unsubscribe fn. This helper
// mirrors that: it captures the service's callback, returns the unsubscribe
// stub synchronously, and lets the test emit a snapshot once the subscription
// is established. (Emitting synchronously inside subscribe would reference the
// service's `unsubscribe` const before it is initialized.)
function deferredCheckoutSession() {
  const unsub = vi.fn();
  let emit!: (data: unknown) => void;
  mockCustomerDao.subscribeToCheckoutSession.mockImplementation(
    (_uid, _sid, cb: (d: unknown) => void) => {
      emit = cb;
      return unsub;
    },
  );
  // Resolves after the service has awaited createCheckoutSession and subscribed.
  const ready = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  return { unsub, emit: (data: unknown) => emit(data), ready };
}

// ── createCheckoutSession ────────────────────────────────────────────────

describe("createCheckoutSession", () => {
  it("throws when there is no signed-in user", async () => {
    mockAuthProvider.getCurrentUserId.mockReturnValue(null);

    const service = new StripeService();
    await expect(service.createCheckoutSession(baseConfig)).rejects.toThrow(
      "Must be signed in to initiate checkout",
    );
    expect(mockCustomerDao.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("resolves with the checkout url once the session document has one", async () => {
    mockCustomerDao.createCheckoutSession.mockResolvedValueOnce("sess-1");
    const session = deferredCheckoutSession();

    const service = new StripeService();
    const promise = service.createCheckoutSession(baseConfig);
    await session.ready();
    session.emit({ url: "https://checkout.stripe/session" });
    const url = await promise;

    expect(mockCustomerDao.createCheckoutSession).toHaveBeenCalledWith(
      "user-1",
      { ...baseConfig },
    );
    expect(mockCustomerDao.subscribeToCheckoutSession).toHaveBeenCalledWith(
      "user-1",
      "sess-1",
      expect.any(Function),
    );
    expect(url).toBe("https://checkout.stripe/session");
    expect(session.unsub).toHaveBeenCalledTimes(1);
  });

  it("ignores null snapshots and waits for a later url", async () => {
    mockCustomerDao.createCheckoutSession.mockResolvedValueOnce("sess-1");
    const session = deferredCheckoutSession();

    const service = new StripeService();
    const promise = service.createCheckoutSession(baseConfig);
    await session.ready();

    session.emit(null); // should be ignored
    session.emit({ url: "https://late.url" });

    await expect(promise).resolves.toBe("https://late.url");
  });

  it("rejects with the Stripe error message when the session errors", async () => {
    mockCustomerDao.createCheckoutSession.mockResolvedValueOnce("sess-1");
    const session = deferredCheckoutSession();

    const service = new StripeService();
    const promise = service.createCheckoutSession(baseConfig);
    await session.ready();
    session.emit({ error: { message: "card declined" } });

    await expect(promise).rejects.toThrow("card declined");
    expect(session.unsub).toHaveBeenCalledTimes(1);
  });

  it("rejects with a generic message when the error has no message", async () => {
    mockCustomerDao.createCheckoutSession.mockResolvedValueOnce("sess-1");
    const session = deferredCheckoutSession();

    const service = new StripeService();
    const promise = service.createCheckoutSession(baseConfig);
    await session.ready();
    session.emit({ error: {} });

    await expect(promise).rejects.toThrow("Stripe checkout failed");
  });

  it("rejects generically when the error is a non-object truthy value", async () => {
    mockCustomerDao.createCheckoutSession.mockResolvedValueOnce("sess-1");
    const session = deferredCheckoutSession();

    const service = new StripeService();
    const promise = service.createCheckoutSession(baseConfig);
    await session.ready();
    // A string error has no `.message`, so the optional-chaining fallback fires.
    session.emit({ error: "declined" });

    await expect(promise).rejects.toThrow("Stripe checkout failed");
  });

  it("rejects and unsubscribes when the session times out", async () => {
    vi.useFakeTimers();
    mockCustomerDao.createCheckoutSession.mockResolvedValueOnce("sess-1");
    const unsub = vi.fn();
    mockCustomerDao.subscribeToCheckoutSession.mockReturnValue(unsub);

    const service = new StripeService();
    const promise = service.createCheckoutSession(baseConfig);
    const assertion = expect(promise).rejects.toThrow(
      "Checkout session timed out. Please try again.",
    );

    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});

// ── createSupporterCheckoutSession ───────────────────────────────────────

describe("createSupporterCheckoutSession", () => {
  it("rejects amounts below the $0.50 minimum", async () => {
    const service = new StripeService();
    await expect(service.createSupporterCheckoutSession(49)).rejects.toThrow(
      "Minimum Stripe charge is $0.50.",
    );
    expect(mockCustomerDao.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("builds a one-time payment session with the supporter line item", async () => {
    mockCustomerDao.createCheckoutSession.mockResolvedValueOnce("sess-1");
    const session = deferredCheckoutSession();

    const service = new StripeService();
    const promise = service.createSupporterCheckoutSession(500);
    await session.ready();
    session.emit({ url: "https://checkout" });
    await promise;

    const config = mockCustomerDao.createCheckoutSession.mock.calls[0][1];
    expect(config).toMatchObject({
      mode: "payment",
      success_url: `${ORIGIN}/dashboard?payment=supporter_success`,
      cancel_url: `${ORIGIN}/pricing`,
      metadata: { type: "supporter" },
    });
    expect(config.line_items).toEqual([
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Grids Supporter",
            description:
              "Support Grids and unlock the Supporter badge + remove branding",
          },
          unit_amount: 500,
        },
        quantity: 1,
      },
    ]);
  });

  it("accepts the exact $0.50 minimum", async () => {
    mockCustomerDao.createCheckoutSession.mockResolvedValueOnce("sess-1");
    const session = deferredCheckoutSession();

    const service = new StripeService();
    const promise = service.createSupporterCheckoutSession(50);
    await session.ready();
    session.emit({ url: "https://checkout" });

    await expect(promise).resolves.toBe("https://checkout");
  });
});

// ── createProCheckoutSession ─────────────────────────────────────────────

describe("createProCheckoutSession", () => {
  it("uses the monthly price id for a monthly interval", async () => {
    vi.stubEnv("VITE_STRIPE_PRO_MONTHLY_PRICE_ID", "price_monthly");
    mockCustomerDao.createCheckoutSession.mockResolvedValueOnce("sess-1");
    const session = deferredCheckoutSession();

    const service = new StripeService();
    const promise = service.createProCheckoutSession("month");
    await session.ready();
    session.emit({ url: "https://checkout" });
    await promise;

    const config = mockCustomerDao.createCheckoutSession.mock.calls[0][1];
    expect(config).toMatchObject({
      mode: "subscription",
      price: "price_monthly",
      success_url: `${ORIGIN}/dashboard?payment=pro_success`,
      cancel_url: `${ORIGIN}/pricing`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: { type: "pro", interval: "month" },
    });
  });

  it("uses the annual price id for a yearly interval", async () => {
    vi.stubEnv("VITE_STRIPE_PRO_ANNUAL_PRICE_ID", "price_annual");
    mockCustomerDao.createCheckoutSession.mockResolvedValueOnce("sess-1");
    const session = deferredCheckoutSession();

    const service = new StripeService();
    const promise = service.createProCheckoutSession("year");
    await session.ready();
    session.emit({ url: "https://checkout" });
    await promise;

    const config = mockCustomerDao.createCheckoutSession.mock.calls[0][1];
    expect(config.price).toBe("price_annual");
    expect(config.metadata).toEqual({ type: "pro", interval: "year" });
  });

  it("throws when the price id is not configured", async () => {
    vi.stubEnv("VITE_STRIPE_PRO_MONTHLY_PRICE_ID", "");

    const service = new StripeService();
    await expect(service.createProCheckoutSession("month")).rejects.toThrow(
      /Stripe price ID not configured/,
    );
    expect(mockCustomerDao.createCheckoutSession).not.toHaveBeenCalled();
  });
});

// ── createCustomerPortalSession ──────────────────────────────────────────

describe("createCustomerPortalSession", () => {
  it("throws when there is no signed-in user", async () => {
    mockAuthProvider.getCurrentUserId.mockReturnValue(null);

    const service = new StripeService();
    await expect(service.createCustomerPortalSession()).rejects.toThrow(
      "Must be signed in to initiate checkout",
    );
  });

  it("calls the portal-link function with the return url and returns its url", async () => {
    mockCloudFunctionsDao.callFunction.mockResolvedValueOnce({
      url: "https://portal.stripe",
    });

    const service = new StripeService();
    const url = await service.createCustomerPortalSession();

    expect(mockCloudFunctionsDao.callFunction).toHaveBeenCalledWith(
      "ext-firestore-stripe-payments-createPortalLink",
      { returnUrl: `${ORIGIN}/dashboard` },
    );
    expect(url).toBe("https://portal.stripe");
  });

  it("propagates errors from the cloud function", async () => {
    mockCloudFunctionsDao.callFunction.mockRejectedValueOnce(
      new Error("portal down"),
    );

    const service = new StripeService();
    await expect(service.createCustomerPortalSession()).rejects.toThrow(
      "portal down",
    );
  });
});

// ── subscribeToActiveSubscriptions ───────────────────────────────────────

describe("subscribeToActiveSubscriptions", () => {
  it("delegates to the DAO and returns the unsubscribe fn", () => {
    const unsub = vi.fn();
    mockCustomerDao.subscribeToActiveSubscriptions.mockReturnValueOnce(unsub);
    const callback = vi.fn();

    const service = new StripeService();
    const result = service.subscribeToActiveSubscriptions("user-1", callback);

    expect(
      mockCustomerDao.subscribeToActiveSubscriptions,
    ).toHaveBeenCalledWith("user-1", callback);
    expect(result).toBe(unsub);
  });
});

// ── subscribeToPayments ──────────────────────────────────────────────────

describe("subscribeToPayments", () => {
  it("delegates to the DAO and returns the unsubscribe fn", () => {
    const unsub = vi.fn();
    mockCustomerDao.subscribeToPayments.mockReturnValueOnce(unsub);
    const callback = vi.fn();

    const service = new StripeService();
    const result = service.subscribeToPayments("user-1", callback);

    expect(mockCustomerDao.subscribeToPayments).toHaveBeenCalledWith(
      "user-1",
      callback,
    );
    expect(result).toBe(unsub);
  });
});
