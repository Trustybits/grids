/**
 * useMobileExperience — app-chrome + device signals
 *
 * The Mobile 2.0 chrome (top app bar, bottom command bar, sheets) is now the
 * universal design for every device and viewport, so `isMobile2` is always on;
 * the touch + beta-enrollment gate has been retired. Where the chrome renders is
 * still decided by the page/route gating in App.vue (grid ownership, dashboard).
 *
 * This composable also still exposes the genuine device signals `isMobileDevice`
 * and `isSmallViewport`, which other consumers (tile creation, profile/chat
 * content, grid stats) use to tailor real touch behavior — independent of which
 * chrome is shown.
 *
 * `initMobileExperience()` must be called once in App.vue (same pattern as
 * `initTier`) to wire the shared device listeners. State is module-level so
 * every consumer shares one set of listeners.
 */

import { computed, ref } from "vue";
import {
  calculateViewportColumnCount,
  columnCountToBreakpoint,
} from "@/utils/GridLayoutUtils";

// Default grid metrics (Grid.vue) — the device check uses the same column
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

// ── Module-level reactive state ────────────────────────────────────────────

const _isTouchDevice = ref(false);
const _viewportWidth = ref(0);

let _cleanup: (() => void) | null = null;

// ── Bootstrap ──────────────────────────────────────────────────────────────

/**
 * Bootstrap the shared device listeners (touch-primary media query + viewport
 * width). Call once in App.vue.
 */
export function initMobileExperience(
  environment: MobileExperienceEnvironment = defaultEnvironment,
): void {
  _cleanup?.();

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
   * The single gate the app chrome branches on. Mobile 2.0 is the universal
   * design for every device and viewport, so this is always on. The page/route
   * gating in App.vue (grid ownership, dashboard) still decides *where* the
   * chrome renders.
   */
  const isMobile2 = computed(() => true);

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
    isMobile2,
  };
}
