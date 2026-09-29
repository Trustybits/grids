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
