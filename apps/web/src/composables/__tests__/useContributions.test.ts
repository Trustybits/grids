/**
 * Tests for useContributions — aggregates the signed-in user's PWYW payment
 * total from a Stripe payments subscription.
 *
 * The auth provider and service factory are mocked so we can drive auth-state
 * transitions and feed payment arrays into the subscribe callback. The
 * composable holds module-level reactive state, so initContributions() is
 * re-run per test to reset it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  initContributions,
  useContributions,
} from "@/composables/useContributions";

const {
  mockOnAuthStateChanged,
  mockSubscribeToPayments,
  mockUnsubAuth,
  mockUnsubPayments,
} = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockSubscribeToPayments: vi.fn(),
  mockUnsubAuth: vi.fn(),
  mockUnsubPayments: vi.fn(),
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({ onAuthStateChanged: mockOnAuthStateChanged }),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getStripeService: () => ({ subscribeToPayments: mockSubscribeToPayments }),
  }),
}));

let authCb: ((user: { uid: string } | null) => void) | null = null;
let paymentsCb: ((payments: Array<{ amount: unknown }>) => void) | null = null;

beforeEach(() => {
  authCb = null;
  paymentsCb = null;
  mockOnAuthStateChanged.mockReset();
  mockSubscribeToPayments.mockReset();
  mockUnsubAuth.mockReset();
  mockUnsubPayments.mockReset();

  mockOnAuthStateChanged.mockImplementation((cb) => {
    authCb = cb;
    return mockUnsubAuth;
  });
  mockSubscribeToPayments.mockImplementation((_uid, cb) => {
    paymentsCb = cb;
    return mockUnsubPayments;
  });
});

describe("initContributions", () => {
  it("subscribes to auth state once", () => {
    initContributions();
    expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes a previous auth listener before re-subscribing", () => {
    initContributions();
    mockUnsubAuth.mockClear();
    initContributions();
    expect(mockUnsubAuth).toHaveBeenCalledTimes(1);
  });

  it("subscribes to the signed-in user's payments by uid", () => {
    initContributions();
    authCb?.({ uid: "user-9" });
    expect(mockSubscribeToPayments).toHaveBeenCalledWith(
      "user-9",
      expect.any(Function),
    );
  });

  it("resets the total to zero and stops loading when signed out", () => {
    initContributions();
    authCb?.(null);
    const { totalPaidCents, isLoading } = useContributions();
    expect(totalPaidCents.value).toBe(0);
    expect(isLoading.value).toBe(false);
  });

  it("tears down a payments subscription when the user signs out", () => {
    initContributions();
    authCb?.({ uid: "user-9" });
    authCb?.(null);
    expect(mockUnsubPayments).toHaveBeenCalledTimes(1);
  });
});

describe("payment aggregation", () => {
  it("sums payment amounts into totalPaidCents and clears loading", () => {
    initContributions();
    authCb?.({ uid: "user-1" });
    paymentsCb?.([{ amount: 500 }, { amount: 250 }, { amount: 1000 }]);

    const { totalPaidCents, isLoading, hasContributed } = useContributions();
    expect(totalPaidCents.value).toBe(1750);
    expect(isLoading.value).toBe(false);
    expect(hasContributed.value).toBe(true);
  });

  it("treats non-numeric amounts as zero", () => {
    initContributions();
    authCb?.({ uid: "user-1" });
    paymentsCb?.([{ amount: "abc" }, { amount: 300 }, { amount: null }]);

    const { totalPaidCents } = useContributions();
    expect(totalPaidCents.value).toBe(300);
  });

  it("coerces numeric strings via Number()", () => {
    initContributions();
    authCb?.({ uid: "user-1" });
    paymentsCb?.([{ amount: "200" }, { amount: "50" }]);

    const { totalPaidCents } = useContributions();
    expect(totalPaidCents.value).toBe(250);
  });

  it("reports hasContributed false when the total is zero", () => {
    initContributions();
    authCb?.({ uid: "user-1" });
    paymentsCb?.([]);

    const { hasContributed, totalPaidCents } = useContributions();
    expect(totalPaidCents.value).toBe(0);
    expect(hasContributed.value).toBe(false);
  });
});

describe("readonly exposure", () => {
  it("exposes totalPaidCents and isLoading as readonly refs", () => {
    initContributions();
    const { totalPaidCents } = useContributions();
    // Writing to a readonly ref is a no-op (and warns); value stays put.
    (totalPaidCents as unknown as { value: number }).value = 9999;
    expect(totalPaidCents.value).not.toBe(9999);
  });
});
