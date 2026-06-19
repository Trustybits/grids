/**
 * Tests for useFeatureFlags — the PostHog-backed feature flag composable.
 *
 * Behaviour under test:
 *  - isEnabled: dev override precedence, the "no PostHog key" dev-default
 *    branch, and delegation to posthog.isFeatureEnabled when a key is present.
 *  - getPayload: gated on the key, otherwise delegates.
 *  - override / resetOverrides: mutate the shared override map.
 *  - reloadFlags: no-op without a key; resolves and flips flagsLoaded once
 *    PostHog reports flags are ready.
 *
 * posthog-js is mocked and VITE_POSTHOG_KEY / DEV are stubbed per-test. The
 * composable keeps module-level state (overrides, flagsLoaded), so every test
 * clears overrides via resetOverrides() in beforeEach to stay isolated.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import posthog from "posthog-js";
import { useFeatureFlags } from "@/composables/useFeatureFlags";

vi.mock("posthog-js", () => ({
  default: {
    isFeatureEnabled: vi.fn(),
    getFeatureFlagPayload: vi.fn(),
    reloadFeatureFlags: vi.fn(),
    onFeatureFlags: vi.fn(),
  },
}));

const mockedPosthog = vi.mocked(posthog);

beforeEach(() => {
  // Reset shared override state between tests.
  useFeatureFlags().resetOverrides();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("isEnabled — dev overrides", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
  });

  it("returns the override value when set to true, ignoring PostHog", () => {
    const { isEnabled, override } = useFeatureFlags();
    override("beta-marketplace", true);
    expect(isEnabled("beta-marketplace")).toBe(true);
    expect(mockedPosthog.isFeatureEnabled).not.toHaveBeenCalled();
  });

  it("returns the override value when set to false, ignoring PostHog", () => {
    mockedPosthog.isFeatureEnabled.mockReturnValue(true);
    const { isEnabled, override } = useFeatureFlags();
    override("beta-marketplace", false);
    expect(isEnabled("beta-marketplace")).toBe(false);
    expect(mockedPosthog.isFeatureEnabled).not.toHaveBeenCalled();
  });

  it("resetOverrides clears a previously set override", () => {
    const { isEnabled, override, resetOverrides } = useFeatureFlags();
    override("beta-marketplace", true);
    resetOverrides();
    mockedPosthog.isFeatureEnabled.mockReturnValue(false);
    expect(isEnabled("beta-marketplace")).toBe(false);
    expect(mockedPosthog.isFeatureEnabled).toHaveBeenCalledWith(
      "beta-marketplace",
    );
  });
});

describe("isEnabled — no PostHog key", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
  });

  it("defaults all flags to enabled in development", () => {
    vi.stubEnv("DEV", true);
    const { isEnabled } = useFeatureFlags();
    expect(isEnabled("editor-smart-text")).toBe(true);
  });

  it("defaults all flags to disabled outside development", () => {
    vi.stubEnv("DEV", false);
    const { isEnabled } = useFeatureFlags();
    expect(isEnabled("editor-smart-text")).toBe(false);
  });

  it("still honors an explicit override even without a key", () => {
    vi.stubEnv("DEV", false);
    const { isEnabled, override } = useFeatureFlags();
    override("editor-smart-text", true);
    expect(isEnabled("editor-smart-text")).toBe(true);
  });
});

describe("isEnabled — PostHog key present", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
  });

  it("delegates to posthog.isFeatureEnabled", () => {
    mockedPosthog.isFeatureEnabled.mockReturnValue(true);
    const { isEnabled } = useFeatureFlags();
    expect(isEnabled("pro-custom-domain")).toBe(true);
    expect(mockedPosthog.isFeatureEnabled).toHaveBeenCalledWith(
      "pro-custom-domain",
    );
  });

  it("coerces an undefined PostHog result to false", () => {
    mockedPosthog.isFeatureEnabled.mockReturnValue(undefined);
    const { isEnabled } = useFeatureFlags();
    expect(isEnabled("pro-custom-domain")).toBe(false);
  });
});

describe("getPayload", () => {
  it("returns undefined when no PostHog key is configured", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    const { getPayload } = useFeatureFlags();
    expect(getPayload("editor-custom-css")).toBeUndefined();
    expect(mockedPosthog.getFeatureFlagPayload).not.toHaveBeenCalled();
  });

  it("delegates to posthog.getFeatureFlagPayload when a key is present", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
    mockedPosthog.getFeatureFlagPayload.mockReturnValue({ variant: "b" });
    const { getPayload } = useFeatureFlags();
    expect(getPayload("editor-custom-css")).toEqual({ variant: "b" });
    expect(mockedPosthog.getFeatureFlagPayload).toHaveBeenCalledWith(
      "editor-custom-css",
    );
  });
});

describe("reloadFlags", () => {
  it("is a no-op (resolves) when no PostHog key is configured", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    const { reloadFlags } = useFeatureFlags();
    await expect(reloadFlags()).resolves.toBeUndefined();
    expect(mockedPosthog.reloadFeatureFlags).not.toHaveBeenCalled();
  });

  it("reloads flags and resolves once onFeatureFlags fires, setting flagsLoaded", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
    mockedPosthog.onFeatureFlags.mockImplementation((cb) => {
      (cb as () => void)();
      return () => {};
    });

    const { reloadFlags, flagsLoaded } = useFeatureFlags();
    expect(flagsLoaded.value).toBe(false);

    await reloadFlags();

    expect(mockedPosthog.reloadFeatureFlags).toHaveBeenCalledTimes(1);
    expect(flagsLoaded.value).toBe(true);
  });
});

describe("exposed constants", () => {
  it("re-exports the FEATURE_FLAGS registry", () => {
    const { FEATURE_FLAGS } = useFeatureFlags();
    expect(FEATURE_FLAGS.BETA_MARKETPLACE).toBe("beta-marketplace");
    expect(FEATURE_FLAGS.PRO_CUSTOM_DOMAIN).toBe("pro-custom-domain");
  });
});
