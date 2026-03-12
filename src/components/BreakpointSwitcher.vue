<!--
  BreakpointSwitcher.vue
  
  Owner-only control to force the grid into a specific breakpoint (sm / md / lg)
  without resizing the browser window. Supports three visual placements via the
  `variant` prop so we can A/B test different UI positions:
  
    - "inline"      (Option A) — sits inside the tile-add toolbar row
    - "floating"    (Option B) — fixed pill near the top of the viewport
    - "toolbar-row" (Option D) — second row stacked below the tile-add toolbar
  
  Breakpoints smaller than or equal to the viewport are fully editable.
  Breakpoints larger than the viewport are available as view-only previews,
  shown with a dimmed "eye" indicator to communicate that editing is locked.
  
  Clicking the currently-active breakpoint resets to auto (viewport-based).
  A small dot indicator shows when a saved override exists for that breakpoint.
-->
<template>
  <div
    class="breakpoint-switcher"
    :class="[`breakpoint-switcher--${variant}`]"
  >
    <button
      v-for="bp in breakpoints"
      :key="bp.key"
      class="bp-btn"
      :class="{
        'bp-btn--active': isActive(bp.key),
        'bp-btn--forced': layoutStore.forcedBreakpoint === bp.key,
        'bp-btn--view-only': isLargerThanViewport(bp.key),
      }"
      :data-tooltip="tooltipFor(bp)"
      @click="toggle(bp.key)"
    >
      <component :is="bp.icon" />
      <!-- Eye badge when this breakpoint is larger than viewport (view-only) -->
      <span
        v-if="isLargerThanViewport(bp.key)"
        class="bp-view-only-badge"
        title="View only — larger than your screen"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <!-- Dot indicator when a saved override exists for this breakpoint -->
      <span
        v-else-if="bp.key !== 'lg' && hasOverride(bp.key)"
        class="bp-override-dot"
        :title="`Saved ${bp.label} override`"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { markRaw } from "vue";
import { useLayoutStore } from "@/stores/layout";
import type { Breakpoint } from "@/types/Tile";
import DeviceDesktopIcon from "./icons/DeviceDesktopIcon.vue";
import DeviceTabletIcon from "./icons/DeviceTabletIcon.vue";
import DeviceMobileIcon from "./icons/DeviceMobileIcon.vue";

defineProps<{
  /**
   * Controls the visual styling / positioning of the switcher:
   *   "inline"      — blends into the tile-add toolbar row (Option A)
   *   "floating"    — fixed pill near the top of the page (Option B)
   *   "toolbar-row" — second row below the tile-add toolbar (Option D)
   */
  variant: "inline" | "floating" | "toolbar-row";
}>();

const layoutStore = useLayoutStore();

// Numeric rank for comparing breakpoint "size": sm=0, md=1, lg=2
const breakpointRank = (bp: Breakpoint): number => {
  if (bp === "sm") return 0;
  if (bp === "md") return 1;
  return 2;
};

// Breakpoint definitions in the order they should render (desktop → mobile)
const breakpoints = [
  { key: "lg" as Breakpoint, label: "Desktop", tooltip: "Desktop (12 col)", icon: markRaw(DeviceDesktopIcon) },
  { key: "md" as Breakpoint, label: "Tablet",  tooltip: "Tablet (8 col)",   icon: markRaw(DeviceTabletIcon) },
  { key: "sm" as Breakpoint, label: "Mobile",  tooltip: "Mobile (4 col)",   icon: markRaw(DeviceMobileIcon) },
];

/** Whether this breakpoint requires a larger screen than the current viewport */
const isLargerThanViewport = (bp: Breakpoint): boolean => {
  return breakpointRank(bp) > breakpointRank(layoutStore.viewportBreakpoint);
};

/** Build context-aware tooltip: appends "(view only)" for upscaled breakpoints */
const tooltipFor = (bp: { key: Breakpoint; tooltip: string }): string => {
  if (isLargerThanViewport(bp.key)) {
    return `${bp.tooltip} — view only`;
  }
  return bp.tooltip;
};

/**
 * A breakpoint button is "active" if either:
 *  - it's the forced breakpoint, or
 *  - no breakpoint is forced and it matches the viewport-derived activeBreakpoint
 */
const isActive = (bp: Breakpoint): boolean => {
  if (layoutStore.forcedBreakpoint) {
    return layoutStore.forcedBreakpoint === bp;
  }
  return layoutStore.activeBreakpoint === bp;
};

/** Check if the layout has a saved override for a given breakpoint */
const hasOverride = (bp: Breakpoint): boolean => {
  return layoutStore.hasBreakpointOverride(bp);
};

/**
 * Toggle a breakpoint: if it's already forced, clear back to auto;
 * otherwise force to this breakpoint. Larger-than-viewport breakpoints
 * are still selectable but will render in view-only mode.
 */
const toggle = (bp: Breakpoint) => {
  if (layoutStore.forcedBreakpoint === bp) {
    // Clicking the active forced breakpoint clears back to auto
    layoutStore.setForcedBreakpoint(null);
  } else {
    layoutStore.setForcedBreakpoint(bp);
  }
};
</script>

<style lang="scss" scoped>
/* ── Shared base styles ──────────────────────────────────────── */

.breakpoint-switcher {
  display: flex;
  gap: 4px;
}

.bp-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-content-default);
  cursor: pointer;
  padding: 0;
  line-height: 0;
  transition: all var(--duration-fast) var(--easing-smooth);

  svg {
    width: 20px;
    height: 20px;
    opacity: 0.55;
    transition: opacity var(--duration-fast) var(--easing-smooth);
  }

  &:hover {
    background-color: var(--color-base-55);
    svg {
      opacity: 1;
    }
  }

  /* Active breakpoint (auto-detected or forced) */
  &.bp-btn--active svg {
    opacity: 0.85;
  }

  /* Explicitly forced breakpoint — stronger highlight */
  &.bp-btn--forced {
    background-color: var(--color-base-34);
    svg {
      opacity: 1;
      color: var(--color-text-primary);
    }
  }

  /* Breakpoint larger than the viewport — dimmed to signal view-only */
  &.bp-btn--view-only {
    svg {
      opacity: 0.3;
    }

    &:hover svg {
      opacity: 0.6;
    }

    /* When forced AND view-only, keep the forced bg but soften the icon */
    &.bp-btn--forced svg {
      opacity: 0.7;
    }
  }
}

/* Tooltip (same pattern as .toolbarAlpha buttons) */
.bp-btn[data-tooltip] {
  position: relative;

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) scale(0.9);
    white-space: nowrap;
    font-size: 11px;
    line-height: 1;
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    background-color: var(--color-text-primary);
    color: var(--color-tile-background);
    pointer-events: none;
    opacity: 0;
    transition:
      opacity var(--duration-fast) var(--easing-ease-out),
      transform var(--duration-fast) var(--easing-ease-out);
    z-index: var(--z-tooltip);
  }

  &:hover::after {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}

/* View-only eye badge — shown on breakpoints larger than the viewport */
.bp-view-only-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0.5;

  svg {
    /* Override the parent .bp-btn svg sizing */
    width: 10px !important;
    height: 10px !important;
    opacity: 1 !important;
    color: var(--color-content-default);
  }
}

/* Override dot — shows when a saved override exists for that breakpoint */
.bp-override-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-figma-purple, #a259ff);
  pointer-events: none;
}

/* ── Variant: inline (Option A) ──────────────────────────────── */
/* Sits directly inside the toolbar row, separated by a left border */

.breakpoint-switcher--inline {
  padding-left: 8px;
  margin-left: 4px;
  border-left: 1px solid var(--color-tile-stroke);
}

/* ── Variant: floating (Option B) ────────────────────────────── */
/* Fixed pill near the top of the viewport, centered horizontally */

.breakpoint-switcher--floating {
  position: fixed;
  top: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-dropdown);
  padding: 6px;
  background-color: var(--color-tile-background);
  border-radius: var(--radius-md);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-md);
}

/* ── Variant: toolbar-row (Option D) ─────────────────────────── */
/* Matches the tile-add toolbar styling but sits as a separate row */

.breakpoint-switcher--toolbar-row {
  padding: 6px;
  background-color: var(--color-tile-background);
  border-radius: var(--radius-md);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  backdrop-filter: blur(20px);
  justify-content: center;
}
</style>
