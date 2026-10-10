<!--
  MobileToolPopover.vue

  The small card that floats 8px above the tile toolbar while a tool is open
  (plan S2): the tool's name, a Done pill, and that one tool's controls. The
  toolbar stays below it with the tool shown as selected.

  - Tapping another popover tool swaps the body in place and the card's height
    morphs; it never closes and reopens.
  - Changes show on the tile live and the visit is one undo step
    (`provideToolPopoverVisit`): Done, another tool, deselecting and unmounting
    all close it.
  - If the card would cover the tile, the page scrolls just enough to keep the
    tile in view above it. It doesn't scroll back on close.
  - Rides on the keyboard with the rest of the bottom bar.
-->
<template>
  <section
    ref="cardRef"
    class="mtp"
    role="dialog"
    :aria-label="title"
    :style="{ '--mtp-origin-x': originX }"
    data-tile-edit-surface
  >
    <header class="mtp__header">
      <h2 class="mtp__title">{{ title }}</h2>
      <button
        ref="doneRef"
        type="button"
        class="mtp__done"
        @click="close"
      >
        Done
      </button>
    </header>

    <div :key="toolId" class="mtp__body">
      <component :is="body" />
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Component,
} from "vue";
import type { Tile } from "@grids/contracts/types";
import {
  MOBILE_TOOLS,
  type MobileToolId,
} from "@/registries/tileToolbar/mobileTools";
import { useGridController } from "@/controllers/useGridController";
import { useMorphFlip } from "@/composables/useMorphFlip";
import { provideToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { getGridEngineBridge } from "@/composables/useGridEngineBridge";
import { MOBILE_POPOVER_BODIES } from "./popovers";

const props = defineProps<{ tile: Tile; toolId: MobileToolId }>();

const controller = useGridController();

const cardRef = ref<HTMLElement | null>(null);
const doneRef = ref<HTMLButtonElement | null>(null);

const tool = computed(() => MOBILE_TOOLS[props.toolId]);
const title = computed(() =>
  props.toolId === "mapStyle" ? "Map style" : tool.value.label,
);
const body = computed<Component | undefined>(
  () => MOBILE_POPOVER_BODIES[props.toolId],
);

const visit = provideToolPopoverVisit(
  () => [props.tile],
  () => `Edit ${title.value.toLowerCase()}`,
);

const close = () => controller.setMobileOpenTool(null);

// ── Swap in place ───────────────────────────────────────────────────────────
const { morph } = useMorphFlip(cardRef);
watch(
  () => props.toolId,
  () => {
    // One undo step per tool.
    visit.commit();
    void morph();
    updateOrigin();
  },
  { flush: "pre" },
);

// ── Grow out of the tool that opened it ─────────────────────────────────────
const originX = ref("50%");
const updateOrigin = () => {
  const card = cardRef.value;
  const button = document.querySelector<HTMLElement>(
    `.mtt [data-tool-id="${props.toolId}"]`,
  );
  if (!card || !button) return;
  const cardRect = card.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const x = buttonRect.left + buttonRect.width / 2 - cardRect.left;
  originX.value = `${Math.round(Math.min(Math.max(x, 0), cardRect.width))}px`;
};

// ── Keep the tile in view above the card ────────────────────────────────────
/** Clear space under the floating top pieces. */
const TOP_CHROME_PX = 96;
const GAP_PX = 12;

const revealTile = () => {
  const card = cardRef.value;
  const rect = getGridEngineBridge()?.tileRect(props.tile.i);
  if (!card || !rect) return;
  const limit = card.getBoundingClientRect().top - GAP_PX;
  const overlap = rect.top + rect.height - limit;
  if (overlap <= 0) return;
  // Never push the tile's top under the top chrome; a tall tile shows its top.
  const room = rect.top - TOP_CHROME_PX;
  const by = Math.min(overlap, room);
  if (by > 0) window.scrollBy({ top: by, behavior: "smooth" });
};

// Re-check whenever the card changes height (opening, a body swap, a body
// growing a row), once per frame.
let revealFrame = 0;
const scheduleReveal = () => {
  if (revealFrame) return;
  revealFrame = requestAnimationFrame(() => {
    revealFrame = 0;
    revealTile();
  });
};
let cardResize: ResizeObserver | null = null;

onMounted(async () => {
  updateOrigin();
  await nextTick();
  scheduleReveal();
  if (typeof ResizeObserver !== "undefined" && cardRef.value) {
    cardResize = new ResizeObserver(scheduleReveal);
    cardResize.observe(cardRef.value);
  }
});

// Focus returns to the tool that opened the card.
onBeforeUnmount(() => {
  cardResize?.disconnect();
  if (revealFrame) cancelAnimationFrame(revealFrame);
  if (!cardRef.value?.contains(document.activeElement)) return;
  document
    .querySelector<HTMLElement>(`.mtt [data-tool-id="${props.toolId}"]`)
    ?.focus({ preventScroll: true });
});

defineExpose({ close });
</script>

<style scoped>
/* Figma "Popover · Font & size" (146:22581): a solid card — the grid behind
   it must not show through, so no glass here (the toolbar keeps its own). */
.mtp {
  /* Taps act at once: no double-tap zoom wait on our controls. */
  touch-action: manipulation;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-height: min(60vh, 460px);
  padding: 12px 14px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-stroke);
  border-radius: 18px;
  background: var(--color-toolbar-background);
  box-shadow: var(--shadow-xl);
  color: var(--color-text-primary);
  transform-origin: var(--mtp-origin-x, 50%) 100%;
}

.mtp__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mtp__title {
  margin: 0;
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  color: var(--color-text-primary);
}

.mtp__done {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 16px;
  background: var(--color-tool-on-bg);
  color: var(--color-tool-active);
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mtp__done:active {
  transform: scale(0.95);
}

.mtp__body {
  animation: mtp-body-in 120ms ease-out both;
}

@keyframes mtp-body-in {
  from {
    opacity: 0;
  }
}

/* ── Shared body pieces (the bodies are scoped to themselves) ─────────────── */
.mtp :deep(.pp-stack) {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* A labelled group: "Font", "Size", … over its control. */
.mtp :deep(.pp-section) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mtp :deep(.pp-label) {
  margin: 0;
  font-family: "Inter", sans-serif;
  font-size: 14px;
  line-height: 1;
  color: var(--color-content-default);
}

.mtp :deep(.pp-select) {
  position: relative;
  display: flex;
  align-items: center;
  height: 58px;
  border: 2px solid var(--color-tool-active);
  border-radius: 12px;
  background: var(--color-input-edit);
}

.mtp :deep(.pp-select select) {
  appearance: none;
  width: 100%;
  height: 100%;
  padding: 0 44px 0 12px;
  border: none;
  border-radius: inherit;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 17px;
  outline: none;
}

.mtp :deep(.pp-select__chevron) {
  position: absolute;
  right: 12px;
  width: 24px;
  height: 24px;
  pointer-events: none;
}

.mtp :deep(.pp-stepper) {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 4px 0 12px;
  border-radius: 10px;
  background: var(--color-input-edit);
}

.mtp :deep(.pp-stepper__label) {
  flex: 1 1 auto;
  font-family: "Inter", sans-serif;
  font-size: 14px;
  color: var(--color-content-high);
}

.mtp :deep(.pp-stepper__btn) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  /* A 44px target around the 26px circle. */
  margin: -9px;
  padding: 9px;
  box-sizing: content-box;
  border: none;
  border-radius: 50%;
  background: var(--color-content-high);
  background-clip: content-box;
  color: var(--color-toolbar-background);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.mtp :deep(.pp-stepper__btn:disabled) {
  opacity: 0.35;
}

.mtp :deep(.pp-stepper__value) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 64px;
  height: 32px;
  margin: 0 10px;
  border-radius: 8px;
  background: var(--color-tool-selected-bg);
  font-family: "Roboto Mono", ui-monospace, monospace;
  font-size: 14px;
  font-weight: 500;
}

.mtp :deep(.pp-stepper__input) {
  width: 30px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  /* 16px keeps iOS from zooming into the field. */
  font-size: 16px;
  text-align: right;
  outline: none;
}

.mtp :deep(.pp-stepper__unit) {
  color: var(--color-content-high);
}

.mtp :deep(.pp-mark) {
  font-family: "Inter", sans-serif;
  font-size: 16px;
}

.mtp :deep(.pp-mark--bold) {
  font-weight: 800;
}

.mtp :deep(.pp-mark--italic) {
  font-style: italic;
  font-family: "Times New Roman", serif;
}

.mtp :deep(.pp-mark--underline) {
  text-decoration: underline;
}

.mtp :deep(.pp-mark--strike) {
  text-decoration: line-through;
}

.mtp :deep(.pp-mark--code) {
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 13px;
}

.mtp :deep(.pp-field) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 48px;
  padding: 0 6px 0 12px;
  border-radius: 10px;
  background: var(--color-input-edit);
}

.mtp :deep(.pp-field__input) {
  flex: 1 1 auto;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  /* 16px keeps iOS from zooming into the field. */
  font-size: 16px;
  outline: none;
}

.mtp :deep(.pp-field__input::placeholder) {
  color: var(--color-content-low);
}

.mtp :deep(.pp-pill) {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 16px;
  background: var(--color-tool-selected-bg);
  color: var(--color-text-primary);
  font-family: "Inter", sans-serif;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.mtp :deep(.pp-pill:disabled) {
  opacity: 0.4;
  cursor: default;
}

.mtp :deep(.pp-pill--primary) {
  background: var(--color-tool-active);
  color: #fff;
}

.mtp :deep(.pp-pill--danger) {
  color: var(--color-tool-danger);
}

.mtp :deep(.pp-link) {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mtp :deep(.pp-link__url) {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--color-content-high);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mtp :deep(.pp-note),
.mtp :deep(.pp-error) {
  margin: 0;
  font-size: 12px;
  color: var(--color-content-default);
}

.mtp :deep(.pp-error) {
  color: var(--color-tool-danger);
}

.mtp :deep(.pp-list) {
  display: flex;
  flex-direction: column;
  margin: 0 -6px;
}

.mtp :deep(.pp-list__item) {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 0 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-primary);
  font-family: "Inter", sans-serif;
  font-size: 14px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.mtp :deep(.pp-list__item:active) {
  background: var(--color-input-edit);
}

.mtp :deep(.pp-list__item--danger) {
  color: var(--color-tool-danger);
}

.mtp :deep(.pp-slider) {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 0 12px;
  border-radius: 10px;
  background: var(--color-input-edit);
}

.mtp :deep(.pp-slider__label) {
  width: 56px;
  font-size: 14px;
  color: var(--color-content-high);
}

.mtp :deep(.pp-slider input) {
  flex: 1 1 auto;
  min-width: 0;
  accent-color: var(--color-tool-active);
}

.mtp :deep(.pp-slider__value) {
  width: 24px;
  font-family: "Roboto Mono", ui-monospace, monospace;
  font-size: 14px;
  text-align: right;
  color: var(--color-content-high);
}

@media (prefers-reduced-motion: reduce) {
  .mtp__body {
    animation: none;
  }
}
</style>
