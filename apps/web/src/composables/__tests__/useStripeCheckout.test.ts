/**
 * Tests for useStripeCheckout — wraps StripeService with reactive loading/error
 * state and performs the post-session redirect.
 *
 * The service factory, usePostHog, and window.location.assign are mocked so we
 * can assert analytics events, redirects, error handling, and the PWYW minimum
 * validation. Module-level loading/error refs are shared, so clearError() is
 * called in beforeEach to reset error state.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStripeCheckout } from "@/composables/useStripeCheckout";

const {
  mockCapture,
  mockCreateProCheckoutSession,
  mockCreateSupporterCheckoutSession,
  mockCreateCustomerPortalSession,
} = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockCreateProCheckoutSession: vi.fn(),
  mockCreateSupporterCheckoutSession: vi.fn(),
  mockCreateCustomerPortalSession: vi.fn(),
}));

vi.mock("@/composables/usePostHog", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getStripeService: () => ({
      createProCheckoutSession: mockCreateProCheckoutSession,
      createSupporterCheckoutSession: mockCreateSupporterCheckoutSession,
      createCustomerPortalSession: mockCreateCustomerPortalSession,
    }),
  }),
}));

const assignSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Replace window.location with a stub that records assign() calls.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign: assignSpy },
  });
  // Reset shared error state.
  useStripeCheckout().clearError();
});

describe("checkoutPro", () => {
  it("captures start/redirect events and redirects to the session URL", async () => {
    mockCreateProCheckoutSession.mockResolvedValue("https://stripe/pro");
    const { checkoutPro, error, loading } = useStripeCheckout();

    await checkoutPro("month");

    expect(mockCapture).toHaveBeenCalledWith("checkout_started", {
      type: "pro",
      interval: "month",
    });
    expect(mockCreateProCheckoutSession).toHaveBeenCalledWith("month");
    expect(mockCapture).toHaveBeenCalledWith("checkout_redirecting", {
      type: "pro",
      interval: "month",
    });
    expect(assignSpy).toHaveBeenCalledWith("https://stripe/pro");
    expect(error.value).toBeNull();
    expect(loading.value).toBe(false);
  });

  it("records the error message and a checkout_error event on failure", async () => {
    mockCreateProCheckoutSession.mockRejectedValue(new Error("card declined"));
    const { checkoutPro, error, loading } = useStripeCheckout();

    await checkoutPro("year");

    expect(error.value).toBe("card declined");
    expect(mockCapture).toHaveBeenCalledWith("checkout_error", {
      type: "pro",
      interval: "year",
      error: "card declined",
    });
    expect(assignSpy).not.toHaveBeenCalled();
    expect(loading.value).toBe(false);
  });

  it("uses a generic message when the rejection is not an Error", async () => {
    mockCreateProCheckoutSession.mockRejectedValue("boom");
    const { checkoutPro, error } = useStripeCheckout();

    await checkoutPro("month");

    expect(error.value).toBe("Something went wrong. Please try again.");
  });
});

describe("checkoutSupporter", () => {
  it("redirects with the amount converted to cents", async () => {
    mockCreateSupporterCheckoutSession.mockResolvedValue("https://stripe/sup");
    const { checkoutSupporter } = useStripeCheckout();

    await checkoutSupporter(5);

    expect(mockCapture).toHaveBeenCalledWith("checkout_started", {
      type: "supporter",
      amount_cents: 500,
    });
    expect(mockCreateSupporterCheckoutSession).toHaveBeenCalledWith(500);
    expect(assignSpy).toHaveBeenCalledWith("https://stripe/sup");
  });

  it("rounds fractional dollar amounts to whole cents", async () => {
    mockCreateSupporterCheckoutSession.mockResolvedValue("https://stripe/sup");
    const { checkoutSupporter } = useStripeCheckout();

    await checkoutSupporter(1.999); // 199.9 cents → rounds to 200

    expect(mockCreateSupporterCheckoutSession).toHaveBeenCalledWith(200);
  });

  it("rejects amounts below the Stripe minimum without calling Stripe", async () => {
    const { checkoutSupporter, error } = useStripeCheckout();

    await checkoutSupporter(0.25); // 25 cents < 50

    expect(error.value).toBe("Minimum payment is $0.50.");
    expect(mockCreateSupporterCheckoutSession).not.toHaveBeenCalled();
    expect(mockCapture).toHaveBeenCalledWith("checkout_error", {
      type: "supporter",
      error: "Minimum payment is $0.50.",
    });
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("rejects a zero amount with the $0-flow message", async () => {
    const { checkoutSupporter, error } = useStripeCheckout();

    await checkoutSupporter(0);

    expect(error.value).toBe("Use $0 flow outside of Stripe checkout.");
    expect(mockCreateSupporterCheckoutSession).not.toHaveBeenCalled();
  });

  it("allows exactly the Stripe minimum ($0.50)", async () => {
    mockCreateSupporterCheckoutSession.mockResolvedValue("https://stripe/sup");
    const { checkoutSupporter, error } = useStripeCheckout();

    await checkoutSupporter(0.5);

    expect(error.value).toBeNull();
    expect(mockCreateSupporterCheckoutSession).toHaveBeenCalledWith(50);
  });

  it("records the error message on a Stripe failure", async () => {
    mockCreateSupporterCheckoutSession.mockRejectedValue(new Error("network"));
    const { checkoutSupporter, error } = useStripeCheckout();

    await checkoutSupporter(10);

    expect(error.value).toBe("network");
    expect(mockCapture).toHaveBeenCalledWith("checkout_error", {
      type: "supporter",
      error: "network",
    });
  });
});

describe("openCustomerPortal", () => {
  it("captures the open event and redirects to the portal URL", async () => {
    mockCreateCustomerPortalSession.mockResolvedValue("https://stripe/portal");
    const { openCustomerPortal } = useStripeCheckout();

    await openCustomerPortal();

    expect(mockCapture).toHaveBeenCalledWith("customer_portal_opened");
    expect(assignSpy).toHaveBeenCalledWith("https://stripe/portal");
  });

  it("records a billing-specific message on failure", async () => {
    mockCreateCustomerPortalSession.mockRejectedValue(new Error("no customer"));
    const { openCustomerPortal, error } = useStripeCheckout();

    await openCustomerPortal();

    expect(error.value).toBe("no customer");
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("uses the default billing message when the rejection is not an Error", async () => {
    mockCreateCustomerPortalSession.mockRejectedValue(42);
    const { openCustomerPortal, error } = useStripeCheckout();

    await openCustomerPortal();

    expect(error.value).toBe("Could not open billing portal.");
  });
});

describe("loading + error state", () => {
  it("clears a prior error when a new checkout starts loading", async () => {
    // Seed an error.
    mockCreateProCheckoutSession.mockRejectedValueOnce(new Error("first"));
    const api = useStripeCheckout();
    await api.checkoutPro("month");
    expect(api.error.value).toBe("first");

    // Next successful run should clear it via setLoading(true).
    mockCreateProCheckoutSession.mockResolvedValueOnce("https://stripe/ok");
    await api.checkoutPro("month");
    expect(api.error.value).toBeNull();
  });

  it("clearError resets the error to null", async () => {
    mockCreateProCheckoutSession.mockRejectedValueOnce(new Error("oops"));
    const api = useStripeCheckout();
    await api.checkoutPro("month");
    expect(api.error.value).toBe("oops");

    api.clearError();
    expect(api.error.value).toBeNull();
  });
});
