/**
 * Tests for useMobileExperience — the Grids 2.0 early-access gate.
 *
 * The gate is three-part: device (touch + small viewport), PostHog enrollment
 * in the `beta-early-access` feature, and — on non-mobile devices only — the
 * internal `beta-desktop-2` kill switch. Device signals are driven through an
 * injected environment; flags are driven through the mocked posthog-js
 * (isFeatureEnabled reflects per-flag state, onFeatureFlags pushes updates,
 * updateEarlyAccessFeatureEnrollment records opt-in calls).
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

/** Per-flag state behind the mocked isFeatureEnabled. */
let flagState: Record<string, boolean> = {};

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

/** Simulate PostHog reporting a new flag state (enrollment or kill switch). */
function setFlags(next: Record<string, boolean>) {
  flagState = { ...flagState, ...next };
  flagsCb?.();
}

beforeEach(() => {
  resizeCb = null;
  touchChangeCb = null;
  flagsCb = null;
  // Desktop kill switch defaults ON (its production rollout), enrollment OFF.
  flagState = { "beta-early-access": false, "beta-desktop-2": true };

  mockedPosthog.isFeatureEnabled.mockReset();
  mockedPosthog.isFeatureEnabled.mockImplementation(
    (flag: string) => flagState[flag] ?? false,
  );
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

  it("exposes raw touch capability independent of viewport size", () => {
    init({ width: DESKTOP_WIDTH, touch: true });
    const { isTouchDevice, isMobileDevice } = useMobileExperience();
    expect(isTouchDevice.value).toBe(true);
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

describe("canUseEarlyAccess — availability", () => {
  it("offers the opt-in on a mobile device", () => {
    init({ width: PHONE_WIDTH, touch: true });
    const { canUseEarlyAccess } = useMobileExperience();
    expect(canUseEarlyAccess.value).toBe(true);
  });

  it("also offers the opt-in on desktop so users can enroll anywhere", () => {
    init({ width: DESKTOP_WIDTH, touch: false });
    const { canUseEarlyAccess } = useMobileExperience();
    expect(canUseEarlyAccess.value).toBe(true);
  });
});

describe("enrollment state", () => {
  it("reads initial enrollment from the flag on init", () => {
    flagState["beta-early-access"] = true;
    init({ width: PHONE_WIDTH, touch: true });
    const { isEarlyAccessEnrolled, isMobile2 } = useMobileExperience();
    expect(isEarlyAccessEnrolled.value).toBe(true);
    expect(isMobile2.value).toBe(true);
  });

  it("defaults to not enrolled", () => {
    init({ width: PHONE_WIDTH, touch: true });
    const { isEarlyAccessEnrolled, isMobile2, chromeActive } =
      useMobileExperience();
    expect(isEarlyAccessEnrolled.value).toBe(false);
    expect(isMobile2.value).toBe(false);
    expect(chromeActive.value).toBe(false);
  });

  it("updates when PostHog reloads flags after enrollment", () => {
    init({ width: PHONE_WIDTH, touch: true });
    const { isEarlyAccessEnrolled, isMobile2 } = useMobileExperience();
    expect(isEarlyAccessEnrolled.value).toBe(false);

    setFlags({ "beta-early-access": true });
    expect(isEarlyAccessEnrolled.value).toBe(true);
    expect(isMobile2.value).toBe(true);
  });
});

describe("chrome gates — isMobile2 / isDesktop2 / chromeActive", () => {
  it("enrolled on a phone: mobile chrome, not desktop chrome", () => {
    flagState["beta-early-access"] = true;
    init({ width: PHONE_WIDTH, touch: true });
    const { isMobile2, isDesktop2, chromeActive } = useMobileExperience();
    expect(isMobile2.value).toBe(true);
    expect(isDesktop2.value).toBe(false);
    expect(chromeActive.value).toBe(true);
  });

  it("enrolled on desktop with the kill switch on: desktop chrome", () => {
    flagState["beta-early-access"] = true;
    init({ width: DESKTOP_WIDTH, touch: false });
    const { isMobile2, isDesktop2, chromeActive } = useMobileExperience();
    expect(isMobile2.value).toBe(false);
    expect(isDesktop2.value).toBe(true);
    expect(chromeActive.value).toBe(true);
  });

  it("enrolled on desktop with beta-desktop-2 off: no new chrome", () => {
    flagState["beta-early-access"] = true;
    flagState["beta-desktop-2"] = false;
    init({ width: DESKTOP_WIDTH, touch: false });
    const { isMobile2, isDesktop2, chromeActive } = useMobileExperience();
    expect(isMobile2.value).toBe(false);
    expect(isDesktop2.value).toBe(false);
    expect(chromeActive.value).toBe(false);
  });

  it("the desktop kill switch never affects the mobile chrome", () => {
    flagState["beta-early-access"] = true;
    flagState["beta-desktop-2"] = false;
    init({ width: PHONE_WIDTH, touch: true });
    const { isMobile2, chromeActive } = useMobileExperience();
    expect(isMobile2.value).toBe(true);
    expect(chromeActive.value).toBe(true);
  });

  it("not enrolled: no chrome anywhere, regardless of the kill switch", () => {
    init({ width: DESKTOP_WIDTH, touch: false });
    const { isMobile2, isDesktop2, chromeActive } = useMobileExperience();
    expect(isMobile2.value).toBe(false);
    expect(isDesktop2.value).toBe(false);
    expect(chromeActive.value).toBe(false);
  });

  it("turning the kill switch off mid-session drops the desktop chrome", () => {
    flagState["beta-early-access"] = true;
    init({ width: DESKTOP_WIDTH, touch: false });
    const { isDesktop2, chromeActive } = useMobileExperience();
    expect(isDesktop2.value).toBe(true);

    setFlags({ "beta-desktop-2": false });
    expect(isDesktop2.value).toBe(false);
    expect(chromeActive.value).toBe(false);
  });
});

describe("setEarlyAccessEnrolled", () => {
  it("drives PostHog enrollment and applies optimistically", async () => {
    init({ width: PHONE_WIDTH, touch: true });
    const { setEarlyAccessEnrolled, isEarlyAccessEnrolled } =
      useMobileExperience();

    await setEarlyAccessEnrolled(true);

    expect(
      mockedPosthog.updateEarlyAccessFeatureEnrollment,
    ).toHaveBeenCalledWith("beta-early-access", true);
    expect(isEarlyAccessEnrolled.value).toBe(true);
  });

  it("opts the user back out", async () => {
    flagState["beta-early-access"] = true;
    init({ width: PHONE_WIDTH, touch: true });
    const { setEarlyAccessEnrolled, isEarlyAccessEnrolled } =
      useMobileExperience();
    expect(isEarlyAccessEnrolled.value).toBe(true);

    await setEarlyAccessEnrolled(false);

    expect(
      mockedPosthog.updateEarlyAccessFeatureEnrollment,
    ).toHaveBeenCalledWith("beta-early-access", false);
    expect(isEarlyAccessEnrolled.value).toBe(false);
  });

  it("still updates local state without a PostHog key (dev)", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    init({ width: PHONE_WIDTH, touch: true });
    const { setEarlyAccessEnrolled, isEarlyAccessEnrolled } =
      useMobileExperience();

    await setEarlyAccessEnrolled(true);

    expect(
      mockedPosthog.updateEarlyAccessFeatureEnrollment,
    ).not.toHaveBeenCalled();
    expect(isEarlyAccessEnrolled.value).toBe(true);
  });
});
