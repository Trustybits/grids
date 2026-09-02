import { computed, onBeforeUnmount, watch, type Ref } from "vue";
import { renderBackground, getBackgroundPreset, type BackgroundConfig } from "./backgrounds";

let styleTagCounter = 0;

/**
 * Wraps the background preset system for use in any Vue component. Injects a
 * scoped `<style>` tag holding the preset's `@keyframes` (when animated) and
 * returns reactive CSS/SVG output for `config`.
 */
export function useAnimatedBackground(config: Ref<BackgroundConfig>) {
  const styleId = `og-bg-style-${(styleTagCounter += 1)}`;
  let styleEl: HTMLStyleElement | null = null;

  const rendered = computed(() => renderBackground(config.value));

  const cssText = computed(() => rendered.value.css ?? "");
  const svgMarkup = computed(() => rendered.value.svgPattern ?? "");
  const filterDef = computed(() => rendered.value.filterDef ?? "");

  const styleObject = computed(() => {
    // Parse the semicolon-separated declaration string from the preset into a
    // style object so it can also be bound directly via `:style`.
    const out: Record<string, string> = {};
    for (const decl of cssText.value.split(";")) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const prop = decl.slice(0, idx).trim();
      const value = decl.slice(idx + 1).trim();
      if (!prop || !value) continue;
      out[prop] = value;
    }
    return out;
  });

  const cssVars = computed(() => ({
    "--bg-angle": `${config.value.angle ?? 0}deg`,
    "--bg-speed": `${config.value.speed ?? 12}s`,
  }));

  const ensureStyleTag = () => {
    if (typeof document === "undefined") return;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.setAttribute("data-og-bg-id", styleId);
      document.head.appendChild(styleEl);
    }
  };

  const syncKeyframes = () => {
    ensureStyleTag();
    if (!styleEl) return;
    const keyframesFn = getBackgroundPreset(config.value.presetId)?.animation;
    styleEl.textContent = keyframesFn ? keyframesFn(config.value) : "";
  };

  watch([config, rendered], syncKeyframes, { immediate: true, deep: true });

  onBeforeUnmount(() => {
    styleEl?.remove();
    styleEl = null;
  });

  return { cssVars, styleObject, svgMarkup, cssText, filterDef };
}
