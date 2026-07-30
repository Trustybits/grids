<!--
  MobilePreviewToolbar.vue — Figma "PreviewMode" `Toolbar:Top` (1474:9257)

  Mobile 2.0 preview chrome, and while a preview is active the only chrome on
  screen: the app bar has slid up out of view and the bottom command pill down,
  so Close is the sole way back to editing.

  Sits flush against the top edge with only its bottom corners rounded, so it
  reads as hanging off the top of the viewport rather than floating over it —
  and drops into exactly the space the app bar vacates.

  This replaces `ViewControls` (the desktop breakpoint switcher) on mobile. The
  affordances it drops are ones preview makes redundant: no dimmed "eye" for
  breakpoints wider than the viewport, because everything is view-only in here,
  and no saved-override dot, because there is nothing to save.
-->
<template>
  <div class="mobile-preview-toolbar" role="toolbar" aria-label="Preview">
    <div class="mpt-group">
      <button
        v-for="bp in BREAKPOINTS"
        :key="bp.key"
        type="button"
        class="mpt-btn"
        :class="{ 'is-active': renderedBreakpoint === bp.key }"
        :aria-label="`Preview at ${bp.label} width`"
        :aria-pressed="renderedBreakpoint === bp.key"
        @click="select(bp.key)"
      >
        <component :is="bp.icon" :size="24" />
      </button>
    </div>

    <span class="mpt-divider" aria-hidden="true" />

    <button
      type="button"
      class="mpt-btn"
      aria-label="Close preview"
      @click="exitPreview"
    >
      <CloseIcon :size="24" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted } from "vue";
import type { Breakpoint } from "@grids/contracts/types";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useGridController } from "@/controllers/useGridController";
import { useGridPreview } from "@/composables/useGridPreview";
import PreviewDesktopIcon from "@/components/icons/PreviewDesktopIcon.vue";
import PreviewTabletIcon from "@/components/icons/PreviewTabletIcon.vue";
import PreviewMobileIcon from "@/components/icons/PreviewMobileIcon.vue";
import CloseIcon from "@/components/icons/CloseIcon.vue";

// Widest first, matching the Figma order and the desktop switcher.
const BREAKPOINTS = [
  {
    key: "lg" as Breakpoint,
    label: "desktop",
    icon: markRaw(PreviewDesktopIcon),
  },
  {
    key: "md" as Breakpoint,
    label: "tablet",
    icon: markRaw(PreviewTabletIcon),
  },
  {
    key: "sm" as Breakpoint,
    label: "mobile",
    icon: markRaw(PreviewMobileIcon),
  },
];

const viewportStore = useGridViewportStore();
const controller = useGridController();
const { exitPreview } = useGridPreview();

// Highlight what the canvas is actually rendering rather than what has been
// forced, so opening preview lands on the current device without having to
// force a breakpoint first.
const renderedBreakpoint = computed(() => viewportStore.renderedBreakpoint);

/**
 * Unlike the desktop switcher, tapping the active breakpoint does not clear the
 * override: falling back to the viewport would land on the same breakpoint
 * while dropping the highlight, so it reads as the button breaking. Exiting
 * preview is what clears it.
 */
const select = (bp: Breakpoint) => {
  if (renderedBreakpoint.value === bp) return;
  controller.setForcedBreakpoint(bp);
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") exitPreview();
};

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<style lang="scss" scoped>
.mobile-preview-toolbar {
  position: fixed;
  top: var(--app-status-banners-height, 0px);
  left: 50%;
  // Paired with the enter/leave transforms below, which have to restate the
  // centering because `transform` is a single property.
  transform: translate(-50%, 0);
  z-index: var(--z-topbar);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  max-width: calc(100% - var(--spacing-md));
  padding: 0 6px;
  background-color: var(--color-toolbar-background);
  // Flush to the top edge: no top border, and only the bottom corners rounded.
  border: var(--border-width) solid var(--color-stroke);
  border-top: none;
  border-bottom-left-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
  backdrop-filter: blur(20px);
}

.mpt-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

// 40x40 to match the app bar and command pill — the whole mobile chrome shares
// one touch-target size.
.mpt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-content-default);
  cursor: pointer;
  line-height: 0;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth);

  &:hover {
    background: var(--color-base-8);
    color: var(--color-text-primary);
  }

  &.is-active {
    color: var(--color-figma-purple);
  }
}

// A short centered tick rather than a full-height rule, per the Figma: it
// separates Close from the breakpoints without reading as a second border.
.mpt-divider {
  width: var(--border-width);
  height: var(--spacing-md);
  flex: 0 0 auto;
  margin: 0 2px;
  background: var(--color-stroke);
}

// Drops in from above as the app bar slides up out of the same space. Declared
// here rather than beside the `<transition>` in App.vue because these classes
// land on this component's root element, which carries this block's scope.
.mpt-drop-enter-active,
.mpt-drop-leave-active {
  transition: transform var(--duration-slow) var(--easing-gentle);
}

.mpt-drop-enter-from,
.mpt-drop-leave-to {
  transform: translate(-50%, calc(-100% - var(--app-status-banners-height, 0px)));
}
</style>
