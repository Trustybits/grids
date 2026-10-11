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
    class="mtp pp-scope"
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

/** One tile when a tile is selected; several in multi-edit. */
const props = defineProps<{ tiles: Tile[]; toolId: MobileToolId }>();

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
  () => props.tiles,
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
  // In multi-edit the picks can be anywhere; keep the first one in view.
  const first = props.tiles[0];
  const rect = first ? getGridEngineBridge()?.tileRect(first.i) : null;
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

@media (prefers-reduced-motion: reduce) {
  .mtp__body {
    animation: none;
  }
}
</style>
