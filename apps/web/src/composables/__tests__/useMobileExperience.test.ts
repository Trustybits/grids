/**
 * Tests for useMobileExperience.
 *
 * Mobile 2.0 is now the universal chrome, so `isMobile2` is unconditionally on
 * (the touch + beta-enrollment gate was retired). The composable still exposes
 * the real device signals `isMobileDevice` / `isSmallViewport`, driven through
 * an injected environment; those are what the remaining tests exercise.
 *
 * Module-level state is reset by re-running initMobileExperience() per test
 * (it tears down previous listeners), mirroring the useTier test approach.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  initMobileExperience,
  useMobileExperience,
  type MobileExperienceEnvironment,
} from "@/composables/useMobileExperience";

// Viewport widths around the grid breakpoints: md needs
// 8*75 + 9*48 = 1032px, so anything below that is `sm`.
const PHONE_WIDTH = 390;
const DESKTOP_WIDTH = 1400;

/** Captured callbacks so tests can drive device transitions. */
let resizeCb: (() => void) | null = null;
let touchChangeCb: (() => void) | null = null;

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

beforeEach(() => {
  resizeCb = null;
  touchChangeCb = null;
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

describe("isMobile2 — universal chrome gate", () => {
  it("is on for a mobile device", () => {
    init({ width: PHONE_WIDTH, touch: true });
    const { isMobile2 } = useMobileExperience();
    expect(isMobile2.value).toBe(true);
  });

  it("is on for a desktop, non-touch window", () => {
    init({ width: DESKTOP_WIDTH, touch: false });
    const { isMobile2 } = useMobileExperience();
    expect(isMobile2.value).toBe(true);
  });
});
