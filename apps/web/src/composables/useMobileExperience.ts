/**
 * useMobileExperience — Mobile 2.0 early-access gating composable
 *
 * Decides whether the Mobile 2.0 chrome should render. Two parts:
 *
 *   1. Device — touch-primary (`(hover: none) and (pointer: coarse)`) AND a
 *      small viewport (the grid `sm` breakpoint, same column math the grid
 *      canvas uses). This gates whether the opt-in is even offered.
 *   2. Opt-in — the user is enrolled in the `beta-mobile-2` PostHog early
 *      access feature. Enrollment is the single source of truth: the flag is
 *      evaluated against the `$feature_enrollment/beta-mobile-2` person
 *      property, and the in-app toggle drives PostHog enrollment directly.
 *
 * `initMobileExperience()` must be called once in App.vue (same pattern as
 * `initTier`). State is module-level so every consumer shares one set of
 * listeners.
 *
 * At GA this collapses to just the device check — see the Mobile 2.0 plan's
 * housekeeping section.
 */

import { computed, readonly, ref } from "vue";
import posthog from "posthog-js";
import {
  FEATURE_FLAGS,
  useFeatureFlags,
} from "@/composables/useFeatureFlags";
import {
  calculateViewportColumnCount,
  columnCountToBreakpoint,
} from "@/utils/GridLayoutUtils";

// Default grid metrics (Grid.vue) — the chrome gate uses the same column
// math as the canvas so "mobile" here matches the `sm` breakpoint users see.
const DEFAULT_BASE_COLUMN_COUNT = 12;
const DEFAULT_ROW_HEIGHT = 75;
const DEFAULT_MARGIN = 48;

const TOUCH_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

export interface MobileExperienceEnvironment {
  getViewportWidth(): number;
  matchTouchMedia(): { matches: boolean; onChange(cb: () => void): () => void };
  addResizeListener(listener: () => void): void;
  removeResizeListener(listener: () => void): void;
}

const defaultEnvironment: MobileExperienceEnvironment = {
  getViewportWidth: () =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  matchTouchMedia: () => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return { matches: false, onChange: () => () => {} };
    }
    const query = window.matchMedia(TOUCH_MEDIA_QUERY);
    return {
      get matches() {
        return query.matches;
      },
      onChange: (cb: () => void) => {
        query.addEventListener("change", cb);
        return () => query.removeEventListener("change", cb);
      },
    };
  },
  addResizeListener: (listener) => {
    if (typeof window !== "undefined") {
      window.addEventListener("resize", listener);
    }
  },
  removeResizeListener: (listener) => {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", listener);
    }
  },
};

function hasPostHogKey(): boolean {
  return !!import.meta.env.VITE_POSTHOG_KEY;
}

// ── Module-level reactive state ────────────────────────────────────────────

const _isTouchDevice = ref(false);
const _viewportWidth = ref(0);
const _enrolled = ref(false);

let _cleanup: (() => void) | null = null;

// ── Bootstrap ──────────────────────────────────────────────────────────────

/**
 * Bootstrap device listeners and the PostHog enrollment sync.
 * Call once in App.vue.
 */
export function initMobileExperience(
  environment: MobileExperienceEnvironment = defaultEnvironment,
): void {
  _cleanup?.();

  const flags = useFeatureFlags();

  const touchMedia = environment.matchTouchMedia();
  _isTouchDevice.value = touchMedia.matches;
  _viewportWidth.value = environment.getViewportWidth();

  const syncTouch = () => {
    _isTouchDevice.value = environment.matchTouchMedia().matches;
  };
  const stopTouchListener = touchMedia.onChange(syncTouch);

  const syncViewport = () => {
    _viewportWidth.value = environment.getViewportWidth();
  };
  environment.addResizeListener(syncViewport);

  // Enrollment is reflected by the flag value. Sync now and whenever PostHog
  // (re)loads flags — updateEarlyAccessFeatureEnrollment triggers a reload.
  const syncEnrollment = () => {
    _enrolled.value = flags.isEnabled(FEATURE_FLAGS.BETA_MOBILE_2);
  };
  syncEnrollment();
  if (hasPostHogKey()) {
    posthog.onFeatureFlags(syncEnrollment);
  }

  _cleanup = () => {
    stopTouchListener();
    environment.removeResizeListener(syncViewport);
  };
}

// ── Composable ─────────────────────────────────────────────────────────────

export function useMobileExperience() {
  const isSmallViewport = computed(() => {
    const width = _viewportWidth.value;
    if (width <= 0) return false;
    const columns = calculateViewportColumnCount({
      baseColumnCount: DEFAULT_BASE_COLUMN_COUNT,
      viewportWidth: width,
      rowHeight: DEFAULT_ROW_HEIGHT,
      margin: DEFAULT_MARGIN,
    });
    return columnCountToBreakpoint(columns) === "sm";
  });

  /** Touch-primary device with a small (grid `sm`) viewport. */
  const isMobileDevice = computed(
    () => _isTouchDevice.value && isSmallViewport.value,
  );

  /**
   * Whether the Mobile 2.0 opt-in is offered on this device. Enrollment is
   * open to everyone eligible, so this is the device gate today; kept as a
   * distinct name so availability can be tightened later without touching
   * call sites.
   */
  const canUseMobile2 = computed(() => isMobileDevice.value);

  /** Whether the user is enrolled in the Mobile 2.0 early access feature. */
  const isMobile2Enabled = readonly(_enrolled);

  /** The single gate the app chrome branches on. */
  const isMobile2 = computed(() => isMobileDevice.value && _enrolled.value);

  /**
   * Opt the user in/out of the Mobile 2.0 early access feature. Drives
   * PostHog enrollment (the source of truth); applied optimistically so the
   * UI responds immediately while PostHog reloads flags.
   */
  async function setMobile2Enabled(value: boolean): Promise<void> {
    _enrolled.value = value;
    if (hasPostHogKey()) {
      posthog.updateEarlyAccessFeatureEnrollment(
        FEATURE_FLAGS.BETA_MOBILE_2,
        value,
      );
    }
  }

  return {
    isMobileDevice,
    isSmallViewport,
    canUseMobile2,
    isMobile2Enabled,
    isMobile2,
    setMobile2Enabled,
  };
}
