<!--
  MobileTopChrome.vue

  The floating top pieces while a tile is being edited (S1–S7). The full app
  bar tucks away (its back button and grid name have no job here) and these
  pop in where it was:

    left   the "Multi edit" pill (Figma 164:17221)
    right  an Undo circle, with a Redo circle sliding out beside it only when
           there is something to redo

  Also hosts the editor's housekeeping (empty-space taps, pruning, preview,
  blur budget), since it is mounted exactly while the floating editor is.
-->
<template>
  <div
    class="mobile-top-chrome"
    :class="{ 'mobile-top-chrome--shown': shown }"
    :aria-hidden="shown ? undefined : 'true'"
  >
    <button
      type="button"
      class="mtc-pill"
      :class="{ 'mtc-pill--tucked': !showsMultiEdit }"
      :tabindex="showsMultiEdit ? 0 : -1"
      aria-label="Multi edit"
      @click="onMultiEdit"
    >
      <MobileToolIcon name="multi-edit" class="mtc-pill__icon" />
      <span class="mtc-pill__label">Multi edit</span>
    </button>

    <div class="mtc-history">
      <transition name="mtc-redo">
        <button
          v-if="history.canRedo"
          type="button"
          class="mtc-circle"
          aria-label="Redo"
          :tabindex="shown ? 0 : -1"
          @click="controller.redo()"
        >
          <UndoIcon :size="24" class="mtc-redo-icon" />
        </button>
      </transition>
      <button
        type="button"
        class="mtc-circle"
        aria-label="Undo"
        :tabindex="shown ? 0 : -1"
        :disabled="!history.canUndo"
        @click="controller.undo()"
      >
        <UndoIcon :size="24" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MobileToolIcon from "./MobileToolIcon.vue";
import UndoIcon from "@/components/icons/UndoIcon.vue";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useGridController } from "@/controllers/useGridController";
import { useMobileEditorView } from "@/composables/useMobileEditorView";
import { useMobileEditorLifecycle } from "@/composables/useMobileEditorLifecycle";

const history = useGridHistoryStore();
const controller = useGridController();
const { view } = useMobileEditorView();
useMobileEditorLifecycle(view);

/** Shown whenever something is being edited. */
const shown = computed(() => view.value.kind !== "home");
/** While typing or in a tool mode only Undo stays; multi-edit isn't on offer. */
const showsMultiEdit = computed(
  () => shown.value && view.value.kind !== "typing" && view.value.kind !== "mode",
);

// Multi-edit lands in its own step; the pill is in place so the top reads as
// designed, and starts multi-select once that bottom toolbar exists.
const onMultiEdit = () => {};
</script>

<style scoped>
/* Same row the app bar occupies, so the pieces appear where it was. */
.mobile-top-chrome {
  position: fixed;
  top: calc(var(--app-status-banners-height, 0px) + var(--spacing-sm));
  left: var(--spacing-sm);
  right: var(--spacing-sm);
  z-index: var(--z-topbar);
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.mtc-pill,
.mtc-circle {
  pointer-events: auto;
  height: 48px;
  border: var(--border-width) solid var(--color-stroke);
  background: var(--color-glass-bar);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  color: var(--color-text-primary);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  /* Hidden: shrunk toward the edge they came from, so showing them reads as
     the app bar collapsing into them. */
  opacity: 0;
  transition:
    opacity var(--duration-fast) var(--easing-smooth),
    transform var(--duration-morph) var(--easing-snap);
}

.mtc-pill {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px 0 12px;
  border-radius: var(--radius-md);
  transform: scale(0.85) translateX(-8px);
  transform-origin: left center;
}

.mtc-pill__icon {
  width: 24px;
  height: 24px;
}

/* Figma "Grids mobile/Title". */
.mtc-pill__label {
  font-family: "Inter", sans-serif;
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
}

.mtc-history {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.mtc-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  padding: 0;
  border-radius: var(--radius-full);
  transform: scale(0.6);
  transform-origin: right center;
}

.mtc-circle:disabled {
  color: var(--color-content-low);
  cursor: default;
}

.mtc-redo-icon {
  transform: scaleX(-1);
}

.mobile-top-chrome--shown .mtc-pill,
.mobile-top-chrome--shown .mtc-circle {
  opacity: 1;
  transform: none;
}

.mobile-top-chrome--shown .mtc-pill.mtc-pill--tucked {
  opacity: 0;
  transform: scale(0.85) translateX(-8px);
  pointer-events: none;
}

.mtc-pill:active,
.mtc-circle:active:not(:disabled) {
  transform: scale(0.95);
}

/* Redo slides out from behind Undo. */
.mtc-redo-enter-active,
.mtc-redo-leave-active {
  transition:
    opacity var(--duration-fast) var(--easing-smooth),
    transform var(--duration-morph) var(--easing-snap);
}

.mtc-redo-enter-from,
.mtc-redo-leave-to {
  opacity: 0;
  transform: translateX(28px) scale(0.6);
}

@media (prefers-reduced-motion: reduce) {
  .mtc-pill,
  .mtc-circle,
  .mtc-redo-enter-active,
  .mtc-redo-leave-active {
    transition: opacity var(--duration-fast) linear;
    transform: none;
  }
}
</style>
