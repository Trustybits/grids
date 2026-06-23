/**
 * Tests for useTier — subscription-tier resolution and feature gating.
 *
 * The auth provider is mocked so we can drive onAuthStateChanged manually and
 * assert how tier transitions between 'free' and 'community'. The composable
 * keeps module-level reactive state, so initTier() is re-run per test to reset
 * it to a known tier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTier, initTier } from "@/composables/useTier";

const { mockOnAuthStateChanged, mockUnsub } = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockUnsub: vi.fn(),
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({ onAuthStateChanged: mockOnAuthStateChanged }),
}));

/** Captured auth-state callback so tests can simulate sign-in / sign-out. */
let authCb: ((user: { uid: string } | null) => void) | null = null;

beforeEach(() => {
  authCb = null;
  mockOnAuthStateChanged.mockReset();
  mockOnAuthStateChanged.mockImplementation((cb) => {
    authCb = cb;
    return mockUnsub;
  });
  mockUnsub.mockReset();
});

function signIn(uid = "user-1") {
  initTier();
  authCb?.({ uid });
}

function signOut() {
  initTier();
  authCb?.(null);
}

describe("initTier", () => {
  it("subscribes to auth state changes", () => {
    initTier();
    expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes a previous listener before re-subscribing", () => {
    initTier();
    // Ignore any unsub from listeners leaked by earlier tests (module-level
    // singleton state); isolate the unsub triggered by the re-subscribe below.
    mockUnsub.mockClear();
    initTier();
    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });

  it("sets tier to community and clears loading when a user signs in", () => {
    signIn();
    const { tier, isLoading } = useTier();
    expect(tier.value).toBe("community");
    expect(isLoading.value).toBe(false);
  });

  it("sets tier to free and clears loading when signed out", () => {
    signOut();
    const { tier, isLoading } = useTier();
    expect(tier.value).toBe("free");
    expect(isLoading.value).toBe(false);
  });
});

describe("tier rank computeds", () => {
  it("free tier is neither community-or-above nor pro-or-above", () => {
    signOut();
    const { isCommunityOrAbove, isProOrAbove } = useTier();
    expect(isCommunityOrAbove.value).toBe(false);
    expect(isProOrAbove.value).toBe(false);
  });

  it("community tier is community-or-above but not pro-or-above", () => {
    signIn();
    const { isCommunityOrAbove, isProOrAbove } = useTier();
    expect(isCommunityOrAbove.value).toBe(true);
    expect(isProOrAbove.value).toBe(false);
  });
});

describe("can — feature gating", () => {
  it("grants community features to a signed-in user", () => {
    signIn();
    const { can } = useTier();
    expect(can("create_grid")).toBe(true);
    expect(can("claim_slug")).toBe(true);
    expect(can("remove_branding")).toBe(true);
  });

  it("denies community features to a signed-out user", () => {
    signOut();
    const { can } = useTier();
    expect(can("create_grid")).toBe(false);
    expect(can("publish_grid")).toBe(false);
  });

  it("denies pro features to a community user", () => {
    signIn();
    const { can } = useTier();
    expect(can("custom_domain")).toBe(false);
    expect(can("advanced_analytics")).toBe(false);
  });
});

describe("lockReason", () => {
  it("returns null when the user already has access", () => {
    signIn();
    const { lockReason } = useTier();
    expect(lockReason("create_grid")).toBeNull();
  });

  it("returns 'sign_in' for a community feature when signed out", () => {
    signOut();
    const { lockReason } = useTier();
    expect(lockReason("create_grid")).toBe("sign_in");
  });

  it("returns 'pro' for a pro feature when on community tier", () => {
    signIn();
    const { lockReason } = useTier();
    expect(lockReason("custom_domain")).toBe("pro");
  });

  it("returns 'sign_in' (not 'supporter') for remove_branding when signed out", () => {
    // NOTE: the 'supporter' lock reason is effectively unreachable. remove_branding
    // requires 'community', so when signed out the first branch
    // (`required === 'community' && tier === 'free'`) returns 'sign_in' before the
    // `feature === 'remove_branding'` branch can run; and when on community tier
    // can() is already true so lockReason returns null. This test pins the actual
    // reachable behaviour and documents that the 'supporter' branch is dead code.
    signOut();
    const { lockReason } = useTier();
    expect(lockReason("remove_branding")).toBe("sign_in");
  });
});

describe("exposed requirements map", () => {
  it("exposes TIER_REQUIREMENTS with the expected mappings", () => {
    const { TIER_REQUIREMENTS } = useTier();
    expect(TIER_REQUIREMENTS.create_grid).toBe("community");
    expect(TIER_REQUIREMENTS.custom_domain).toBe("pro");
  });
});
