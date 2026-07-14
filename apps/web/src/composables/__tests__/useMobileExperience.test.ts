/**
 * Tests for useMobileExperience — the Mobile 2.0 early-access gate.
 *
 * The gate is two-part: device (touch + small viewport) and PostHog
 * enrollment in the `beta-mobile-2` early access feature. Device signals are
 * driven through an injected environment; enrollment is driven through the
 * mocked posthog-js (isFeatureEnabled reflects enrollment, onFeatureFlags
 * pushes updates, updateEarlyAccessFeatureEnrollment records opt-in calls).
 *
 * Module-level state is reset by re-running initMobileExperience() per test
 * (it tears down previous listeners), mirroring the useTier test approach.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import posthog from "posthog-js";
import {
  initMobileExperience,
  useMobileExperience,
  type MobileExperienceEnvironment,
} from "@/composables/useMobileExperience";

vi.mock("posthog-js", () => ({
  default: {
    isFeatureEnabled: vi.fn(),
    getFeatureFlagPayload: vi.fn(),
    reloadFeatureFlags: vi.fn(),
    onFeatureFlags: vi.fn(),
    updateEarlyAccessFeatureEnrollment: vi.fn(),
  },
}));

const mockedPosthog = vi.mocked(posthog);

// Viewport widths around the grid breakpoints: md needs
// 8*75 + 9*48 = 1032px, so anything below that is `sm`.
const PHONE_WIDTH = 390;
const DESKTOP_WIDTH = 1400;

/** Captured callbacks so tests can drive device / flag transitions. */
let resizeCb: (() => void) | null = null;
let touchChangeCb: (() => void) | null = null;
let flagsCb: (() => void) | null = null;

interface EnvState {
  width: number;
  touch: boolean;
}

function makeEnv(state: EnvState): MobileExperienceEnvironment {
  return {
    getViewportWidth: () => state.width,
    matchTouchMedia: () => ({
      get matches() {
        return state.touch;
      },
      onChange: (cb) => {
        touchChangeCb = cb;
        return () => {
          touchChangeCb = null;
        };
      },
    }),
    addResizeListener: (listener) => {
      resizeCb = listener;
    },
    removeResizeListener: () => {
      resizeCb = null;
    },
  };
}

function init(state: EnvState) {
  initMobileExperience(makeEnv(state));
  return state;
}

/** Simulate PostHog reporting a new enrollment/flag state. */
function setEnrolled(enrolled: boolean) {
  mockedPosthog.isFeatureEnabled.mockReturnValue(enrolled);
  flagsCb?.();
}

beforeEach(() => {
  resizeCb = null;
  touchChangeCb = null;
  flagsCb = null;

  mockedPosthog.isFeatureEnabled.mockReset();
  mockedPosthog.isFeatureEnabled.mockReturnValue(false);
  mockedPosthog.updateEarlyAccessFeatureEnrollment.mockReset();
  mockedPosthog.onFeatureFlags.mockReset();
  mockedPosthog.onFeatureFlags.mockImplementation((cb) => {
    flagsCb = cb as unknown as () => void;
    return () => {};
  });

  // PostHog key present by default so enrollment paths are exercised.
  vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("device detection", () => {
  it("is a mobile device when touch-primary with a small viewport", () => {
    init({ width: PHONE_WIDTH, touch: true });
    const { isMobileDevice, isSmallViewport } = useMobileExperience();
    expect(isSmallViewport.value).toBe(true);
    expect(isMobileDevice.value).toBe(true);
  });

  it("is not a mobile device on a wide touch screen", () => {
    init({ width: DESKTOP_WIDTH, touch: true });
    const { isMobileDevice } = useMobileExperience();
    expect(isMobileDevice.value).toBe(false);
  });

  it("is not a mobile device on a narrow non-touch window", () => {
    init({ width: PHONE_WIDTH, touch: false });
    const { isMobileDevice } = useMobileExperience();
    expect(isMobileDevice.value).toBe(false);
  });

  it("reacts to viewport resizes", () => {
    const state = init({ width: DESKTOP_WIDTH, touch: true });
    const { isMobileDevice } = useMobileExperience();
    expect(isMobileDevice.value).toBe(false);

    state.width = PHONE_WIDTH;
    resizeCb?.();
    expect(isMobileDevice.value).toBe(true);
  });

  it("reacts to touch capability changes", () => {
    const state = init({ width: PHONE_WIDTH, touch: false });
    const { isMobileDevice } = useMobileExperience();
    expect(isMobileDevice.value).toBe(false);

    state.touch = true;
    touchChangeCb?.();
    expect(isMobileDevice.value).toBe(true);
  });
});

describe("canUseMobile2 — availability", () => {
  it("offers the opt-in on a mobile device", () => {
    init({ width: PHONE_WIDTH, touch: true });
    const { canUseMobile2 } = useMobileExperience();
    expect(canUseMobile2.value).toBe(true);
  });

  it("does not offer the opt-in on desktop", () => {
    init({ width: DESKTOP_WIDTH, touch: false });
    const { canUseMobile2 } = useMobileExperience();
    expect(canUseMobile2.value).toBe(false);
  });
});

describe("enrollment state", () => {
  it("reads initial enrollment from the flag on init", () => {
    mockedPosthog.isFeatureEnabled.mockReturnValue(true);
    init({ width: PHONE_WIDTH, touch: true });
    const { isMobile2Enabled, isMobile2 } = useMobileExperience();
    expect(isMobile2Enabled.value).toBe(true);
    expect(isMobile2.value).toBe(true);
  });

  it("defaults to not enrolled", () => {
    init({ width: PHONE_WIDTH, touch: true });
    const { isMobile2Enabled, isMobile2 } = useMobileExperience();
    expect(isMobile2Enabled.value).toBe(false);
    expect(isMobile2.value).toBe(false);
  });

  it("updates when PostHog reloads flags after enrollment", () => {
    init({ width: PHONE_WIDTH, touch: true });
    const { isMobile2Enabled, isMobile2 } = useMobileExperience();
    expect(isMobile2Enabled.value).toBe(false);

    setEnrolled(true);
    expect(isMobile2Enabled.value).toBe(true);
    expect(isMobile2.value).toBe(true);
  });

  it("does not enable isMobile2 when enrolled but on desktop", () => {
    mockedPosthog.isFeatureEnabled.mockReturnValue(true);
    init({ width: DESKTOP_WIDTH, touch: false });
    const { isMobile2 } = useMobileExperience();
    expect(isMobile2.value).toBe(false);
  });
});

describe("setMobile2Enabled", () => {
  it("drives PostHog enrollment and applies optimistically", async () => {
    init({ width: PHONE_WIDTH, touch: true });
    const { setMobile2Enabled, isMobile2Enabled } = useMobileExperience();

    await setMobile2Enabled(true);

    expect(
      mockedPosthog.updateEarlyAccessFeatureEnrollment,
    ).toHaveBeenCalledWith("beta-mobile-2", true);
    expect(isMobile2Enabled.value).toBe(true);
  });

  it("opts the user back out", async () => {
    mockedPosthog.isFeatureEnabled.mockReturnValue(true);
    init({ width: PHONE_WIDTH, touch: true });
    const { setMobile2Enabled, isMobile2Enabled } = useMobileExperience();
    expect(isMobile2Enabled.value).toBe(true);

    await setMobile2Enabled(false);

    expect(
      mockedPosthog.updateEarlyAccessFeatureEnrollment,
    ).toHaveBeenCalledWith("beta-mobile-2", false);
    expect(isMobile2Enabled.value).toBe(false);
  });

  it("still updates local state without a PostHog key (dev)", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    init({ width: PHONE_WIDTH, touch: true });
    const { setMobile2Enabled, isMobile2Enabled } = useMobileExperience();

    await setMobile2Enabled(true);

    expect(
      mockedPosthog.updateEarlyAccessFeatureEnrollment,
    ).not.toHaveBeenCalled();
    expect(isMobile2Enabled.value).toBe(true);
  });
});
