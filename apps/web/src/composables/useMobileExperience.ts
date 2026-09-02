/**
 * useMobileExperience — Grids 2.0 early-access gating + device signals
 *
 * Decides which chrome the app renders. Three parts:
 *
 *   1. Device — touch-primary (`(hover: none) and (pointer: coarse)`) AND a
 *      small viewport (the grid `sm` breakpoint, same column math the grid
 *      canvas uses) selects the *mobile* variant of the new chrome.
 *   2. Opt-in — the user is enrolled in the `beta-early-access` PostHog early
 *      access feature ("Early Access"). Enrollment is the single source of
 *      truth: the flag is evaluated against the
 *      `$feature_enrollment/beta-early-access` person property, and the
 *      in-app toggle drives PostHog enrollment directly.
 *   3. Desktop kill switch — on non-mobile devices the new chrome is
 *      additionally gated by the internal `beta-desktop-2` flag, so the newer
 *      desktop chrome can be turned off for everyone without un-enrolling
 *      anyone from the stable mobile chrome.
 *
 * Gates exposed:
 *   - `isMobile2`    — enrolled AND mobile device → phone chrome (sheets,
 *                      tile toolbars hidden).
 *   - `isDesktop2`   — enrolled AND NOT mobile device AND `beta-desktop-2` →
 *                      desktop chrome (app bar + pill; TileToolbar and
 *                      TileActions remain, no sheets).
 *   - `chromeActive` — either of the above; what App.vue branches on.
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
const _desktop2FlagOn = ref(false);

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
  const syncFlags = () => {
    _enrolled.value = flags.isEnabled(FEATURE_FLAGS.BETA_EARLY_ACCESS);
    _desktop2FlagOn.value = flags.isEnabled(FEATURE_FLAGS.BETA_DESKTOP_2);
  };
  syncFlags();
  if (hasPostHogKey()) {
    posthog.onFeatureFlags(syncFlags);
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
   * Whether the Early Access opt-in is offered to the user. Available on
   * every device so users can enroll anywhere. Kept as a computed so
   * availability can be tightened later without touching call sites.
   */
  const canUseEarlyAccess = computed(() => true);

  /** Whether the user is enrolled in the Early Access feature. */
  const isEarlyAccessEnrolled = readonly(_enrolled);

  /** Enrolled + mobile device → the phone chrome (sheets, no tile toolbars). */
  const isMobile2 = computed(() => isMobileDevice.value && _enrolled.value);

  /**
   * Enrolled + desktop/tablet + internal `beta-desktop-2` kill switch → the
   * desktop chrome (app bar + pill; TileToolbar/TileActions remain).
   */
  const isDesktop2 = computed(
    () => !isMobileDevice.value && _enrolled.value && _desktop2FlagOn.value,
  );

  /** The single gate App.vue branches on: any Grids 2.0 chrome active. */
  const chromeActive = computed(() => isMobile2.value || isDesktop2.value);

  /**
   * Opt the user in/out of the Early Access feature. Drives PostHog
   * enrollment (the source of truth); applied optimistically so the UI
   * responds immediately while PostHog reloads flags.
   */
  async function setEarlyAccessEnrolled(value: boolean): Promise<void> {
    _enrolled.value = value;
    if (hasPostHogKey()) {
      posthog.updateEarlyAccessFeatureEnrollment(
        FEATURE_FLAGS.BETA_EARLY_ACCESS,
        value,
      );
    }
  }

  return {
    /**
     * Touch-primary device, regardless of viewport size — unlike
     * `isMobileDevice`, which also requires a small viewport. Tile gestures key
     * off this alone: a touch-primary tablet at a wide viewport still has no
     * hover and still needs tap-to-activate before a drag.
     */
    isTouchDevice: readonly(_isTouchDevice),
    isMobileDevice,
    isSmallViewport,
    canUseEarlyAccess,
    isEarlyAccessEnrolled,
    isMobile2,
    isDesktop2,
    chromeActive,
    setEarlyAccessEnrolled,
  };
}
