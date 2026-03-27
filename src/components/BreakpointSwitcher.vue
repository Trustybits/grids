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
      <!-- Device icon — fades out on hover when this is a view-only breakpoint -->
      <span class="bp-icon bp-icon--device">
        <component :is="bp.icon" />
      </span>
      <!-- Full-size eye icon — fades in on hover for view-only breakpoints.
           Always rendered in the DOM for smooth transitions, but invisible
           (opacity 0) unless hovered on a view-only button. -->
      <span
        v-if="isLargerThanViewport(bp.key)"
        class="bp-icon bp-icon--eye"
        aria-hidden="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <!-- Dot indicator when a saved override exists for this breakpoint -->
      <span
        v-if="!isLargerThanViewport(bp.key) && bp.key !== 'lg' && hasOverride(bp.key)"
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

  &:hover {
    background-color: var(--color-base-55);
    /* Purple tint on hover for all buttons, matching nav bar style */
    .bp-icon--device svg {
      opacity: 1;
      color: var(--color-figma-purple, #a259ff);
    }
  }

  /* Active breakpoint (auto-detected or forced) */
  &.bp-btn--active .bp-icon--device svg {
    opacity: 0.85;
  }

  /* Explicitly forced breakpoint — stronger highlight */
  &.bp-btn--forced {
    background-color: var(--color-base-34);
    .bp-icon--device svg {
      opacity: 1;
      color: var(--color-text-primary);
    }
  }

  /* ── View-only breakpoints ──────────────────────────────────── */
  /* Device icon is dimmed; on hover it fades out and the full-size
     eye icon fades in with a purple tint (matching nav bar hover). */
  &.bp-btn--view-only {
    .bp-icon--device svg {
      opacity: 0.3;
    }

    &:hover {
      /* Cross-fade: device out, eye in */
      .bp-icon--device svg {
        opacity: 0;
      }
      .bp-icon--eye svg {
        opacity: 1;
      }
    }

    /* When forced AND view-only, keep the forced bg but soften the device icon;
       the eye icon is still revealed on hover. */
    &.bp-btn--forced .bp-icon--device svg {
      opacity: 0.5;
    }
  }
}

/* ── Icon wrapper — device & eye are stacked in the same space ── */
.bp-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;

  svg {
    width: 20px;
    height: 20px;
    transition:
      opacity var(--duration-normal, 0.2s) var(--easing-smooth),
      color var(--duration-normal, 0.2s) var(--easing-smooth);
  }
}

.bp-icon--device svg {
  opacity: 0.55;
}

/* Eye icon: hidden by default, purple-tinted, fades in on hover */
.bp-icon--eye svg {
  opacity: 0;
  color: var(--color-figma-purple, #a259ff);
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
  /* Offset below both the ViewportWarning banner and the TopBar.
     --viewport-warning-height is set dynamically by ViewportWarning.vue.
     --topbar-height is set dynamically by App.vue when the TopBar is visible. */
  top: calc(var(--viewport-warning-height, 0px) + var(--spacing-md));
  left: 50%;
  transform: translateX(-50%);
  /* Must sit above the TopBar (--z-topbar: 2000) so it's never obscured */
  z-index: calc(var(--z-topbar) + 1);
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
