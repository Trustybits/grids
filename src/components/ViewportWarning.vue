<!--
  ViewportWarning.vue

  Reusable warning banner for viewport/display mismatch scenarios.
  Designed to be extensible — currently handles breakpoint preview warnings,
  but built to support future cases like fixed-dimension grids viewed on
  smaller-than-intended screens.

  Usage:
    <ViewportWarning
      type="breakpoint-preview"
      :dismissible="true"
    />

  The component reads layout store state to determine which warning (if any)
  to show. It renders nothing when no warning condition is active.
-->
<template>
  <Transition name="viewport-warning">
    <div
      v-if="warning && !dismissed"
      ref="bannerRef"
      class="viewport-warning"
      :class="[`viewport-warning--${warning.severity}`]"
    >
      <div class="viewport-warning__icon">
        <!-- Eye icon for view-only mode -->
        <svg
          v-if="warning.severity === 'info'"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <!-- Warning triangle for caution-level messages -->
        <svg
          v-else
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <span class="viewport-warning__message">{{ warning.message }}</span>

      <button
        v-if="dismissible"
        class="viewport-warning__close"
        aria-label="Dismiss warning"
        @click="dismissed = true"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useLayoutStore } from "@/stores/layout";
import type { Breakpoint } from "@/types/Tile";

/**
 * Warning types — extensible for future scenarios:
 *   "breakpoint-preview" — forced to a breakpoint larger than the viewport
 *   "viewport-too-small" — viewport is smaller than the grid's intended display size
 *                          (reserved for future fixed-dimension grids)
 */
const props = withDefaults(
  defineProps<{
    type: "breakpoint-preview" | "viewport-too-small";
    dismissible?: boolean;
  }>(),
  { dismissible: true },
);

const layoutStore = useLayoutStore();
const dismissed = ref(false);

// Numeric rank for comparing breakpoint "size": sm=0, md=1, lg=2
const breakpointRank = (bp: Breakpoint): number => {
  if (bp === "sm") return 0;
  if (bp === "md") return 1;
  return 2;
};

// Human-readable breakpoint labels
const breakpointLabel = (bp: Breakpoint): string => {
  if (bp === "sm") return "Mobile";
  if (bp === "md") return "Tablet";
  return "Desktop";
};

interface WarningState {
  message: string;
  severity: "info" | "caution";
}

const warning = computed<WarningState | null>(() => {
  if (props.type === "breakpoint-preview") {
    const forced = layoutStore.forcedBreakpoint;
    const viewport = layoutStore.viewportBreakpoint;

    // Only show when the user has forced a breakpoint larger than the viewport
    if (!forced) return null;
    if (breakpointRank(forced) <= breakpointRank(viewport)) return null;

    return {
      message: `Previewing ${breakpointLabel(forced)} layout — view only (your screen is ${breakpointLabel(viewport)} sized)`,
      severity: "info",
    };
  }

  // Future: "viewport-too-small" for fixed-dimension grids
  if (props.type === "viewport-too-small") {
    // Placeholder — will be implemented when fixed-dimension grids are added.
    // Would compare viewport px against the grid's intended min width/height.
    return null;
  }

  return null;
});

// Reset dismissed state whenever the warning condition changes
// (e.g. user switches to a different forced breakpoint)
watch(
  () => warning.value?.message,
  () => {
    dismissed.value = false;
  },
);

// ── Banner height → CSS custom property ────────────────────────
// The TopBar and floating BreakpointSwitcher use `position: fixed; top: 0`,
// so they'd overlap this banner. We set --viewport-warning-height on <html>
// whenever the banner is visible, and those fixed elements read it via
// `top: var(--viewport-warning-height, 0px)`.
const bannerRef = ref<HTMLElement | null>(null);

const updateBannerHeight = () => {
  nextTick(() => {
    const isVisible = warning.value && !dismissed.value;
    if (isVisible && bannerRef.value) {
      const h = bannerRef.value.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--viewport-warning-height",
        `${h}px`,
      );
    } else {
      document.documentElement.style.setProperty(
        "--viewport-warning-height",
        "0px",
      );
    }
  });
};

watch([warning, dismissed], updateBannerHeight, { immediate: true });

onMounted(updateBannerHeight);

onUnmounted(() => {
  document.documentElement.style.setProperty(
    "--viewport-warning-height",
    "0px",
  );
});
</script>

<style lang="scss" scoped>
.viewport-warning {
  /* Sticky at the very top of the page, above all other elements.
     Sits in normal document flow so it pushes content (TopBar, grid, etc.)
     below it when visible. z-index must beat the fixed TopBar. */
  position: sticky;
  top: 0;
  z-index: calc(var(--z-base, 1) + 10);

  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 8px 14px;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  backdrop-filter: blur(20px);

  /* No border-radius — full-width edge-to-edge banner */

  /* Info severity — view-only preview */
  &--info {
    background-color: color-mix(in srgb, var(--color-figma-purple, #a259ff) 18%, var(--color-tile-background));
    border-bottom: 1px solid color-mix(in srgb, var(--color-figma-purple, #a259ff) 30%, transparent);
    color: var(--color-text-primary);
  }

  /* Caution severity — potential issues (e.g. viewport too small for intended display) */
  &--caution {
    background-color: color-mix(in srgb, var(--color-figma-yellow, #f5a623) 18%, var(--color-tile-background));
    border-bottom: 1px solid color-mix(in srgb, var(--color-figma-yellow, #f5a623) 30%, transparent);
    color: var(--color-text-primary);
  }
}

.viewport-warning__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;

  .viewport-warning--info & {
    color: var(--color-figma-purple, #a259ff);
  }

  .viewport-warning--caution & {
    color: var(--color-figma-yellow, #f5a623);
  }
}

.viewport-warning__message {
  /* Don't flex-grow — let justify-content: center on the parent handle centering */
  flex-shrink: 1;
}

.viewport-warning__close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-content-default);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity var(--duration-fast) var(--easing-smooth);

  &:hover {
    opacity: 1;
  }
}

/* Transition for smooth enter/leave */
.viewport-warning-enter-active,
.viewport-warning-leave-active {
  transition:
    opacity 0.2s var(--easing-ease-out),
    transform 0.2s var(--easing-ease-out);
}

.viewport-warning-enter-from,
.viewport-warning-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
