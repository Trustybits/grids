import { ref } from "vue";

/**
 * Early Access gate state, owned and written by `useMobileExperience`.
 *
 * Kept in its own module, with no PostHog import, so code that only needs to
 * *read* a gate outside a component (the tile registry's component loaders)
 * doesn't pull the PostHog client into the registry's import graph.
 */
export const earlyAccessEnrolled = ref(false);
export const unifiedTextFlagOn = ref(false);

/**
 * Whether text and smart text tiles render through the unified rich-text
 * component: enrolled in Early Access and `editor-unified-text` on. Reactive
 * when read inside a computed or watcher.
 */
export function isUnifiedTextActive(): boolean {
  return earlyAccessEnrolled.value && unifiedTextFlagOn.value;
}

const TOUCH_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

/**
 * Whether text formatting lives in the floating toolbar instead of the tile
 * toolbar's "More" menu: the unified editor on a pointer device. Touch devices
 * keep the menu (and the Mobile 2.0 sheet) until the keyboard-docked bar.
 */
export function isFloatingFormatToolbarActive(): boolean {
  if (!isUnifiedTextActive()) return false;
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia(TOUCH_MEDIA_QUERY).matches;
}
