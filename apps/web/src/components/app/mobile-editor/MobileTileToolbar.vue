<!--
  MobileTileToolbar.vue

  The selected tile's floating toolbar (Figma "Toolbar", 162:6782): a header
  with the tile type, its live size and "All settings", over a row of that
  tile's tools that scrolls sideways (`mobileTools`, plan §5).

  Lives inside the bottom bar's pill, so the pill itself morphs from the home
  buttons into this — no second surface appears.

  "All settings" (or a swipe up on the header) grows the toolbar into the All
  settings sheet in place of the tools row; a swipe down or the chevron
  shrinks it back.

  Tool behaviour (`useMobileToolActions`): instant tools act (Duplicate, Delete, Open, Copy, Download,
  Re-center, Preview); Arrange enters move/resize; popover tools open their
  card above the bar (`MobileToolPopover`, mounted by the bottom bar); Crop,
  Pan and Interact put the tile in its mode and the bar becomes the mode bar
  (`MobileModeBar`); Edit (link, documents, profile) starts typing in the
  tile's fields.
-->
<template>
  <div class="mtt" :class="{ 'mtt--sheet': expanded }" data-tile-edit-surface>
    <!-- Swipe up on the header opens All settings, swipe down closes it. -->
    <header
      class="mtt__header"
      @touchstart.passive="onHeaderTouchStart"
      @touchend="onHeaderTouchEnd"
    >
      <span class="mtt__title">{{ title }}</span>
      <span class="mtt__size">{{ sizeLabel }}</span>
      <span class="mtt__spacer"></span>
      <button
        type="button"
        class="mtt__settings"
        aria-controls="mtt-all-settings"
        :aria-expanded="expanded ? 'true' : 'false'"
        @click="toggleSheet"
      >
        All settings
        <MobileToolIcon name="chevron" class="mtt__chevron" />
      </button>
    </header>

    <MobileAllSettings v-if="expanded" id="mtt-all-settings" :tile="tile" />

    <div
      v-else
      ref="rowRef"
      class="mtt__tools"
      role="toolbar"
      :aria-label="`${title} tools`"
    >
      <MobileToolButton
        v-for="tool in tools"
        :key="tool.id"
        :tool-id="tool.id"
        :icon="iconFor(tool.id)"
        :label="tool.label"
        :state="stateFor(tool)"
        :href="tool.id === 'open' ? openHref : undefined"
        @select="run(tool)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, proxyRefs, ref, watch } from "vue";
import type { Tile } from "@grids/contracts/types";
import MobileToolButton from "./MobileToolButton.vue";
import MobileToolIcon from "./MobileToolIcon.vue";
import MobileAllSettings from "./MobileAllSettings.vue";
import { getTileDefinition } from "@/registries/tileRegistry";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridController } from "@/controllers/useGridController";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useMobileToolActions } from "@/composables/useMobileToolActions";
import { arrangeLiveSize } from "@/composables/useTouchTileGestures";

const props = defineProps<{ tile: Tile }>();

const ui = useGridUiStore();
const controller = useGridController();
const gridView = proxyRefs(useGridViewContext());
const { tools, stateFor, run, iconFor, openHref } = useMobileToolActions(
  () => props.tile,
);

const rowRef = ref<HTMLElement | null>(null);

// ── Header ──────────────────────────────────────────────────────────────────
const title = computed(() => {
  const label = getTileDefinition(props.tile.content.type)?.label ?? "Tile";
  return `${label} tile`.toUpperCase();
});

/** The size as laid out right now (the phone breakpoint), not the desktop one. */
const sizeLabel = computed(() => {
  // A corner drag in progress shows the size it would land at.
  const live = arrangeLiveSize.value;
  if (live && ui.mobileArrangeTileId === props.tile.i) {
    return `${live.w}×${live.h}`;
  }
  const placed = gridView.displayPositions.find(
    (item) => item.i === props.tile.i,
  );
  const w = placed?.w ?? props.tile.w;
  const h = placed?.h ?? props.tile.h;
  return `${w}×${h}`;
});

// ── All settings ────────────────────────────────────────────────────────────
// The toolbar grows into a sheet of every control for the tile (plan S3).
const expanded = computed(() => ui.mobileSheetExpanded);
const toggleSheet = () => controller.setMobileSheetExpanded(!expanded.value);

const SWIPE_PX = 36;
let headerTouchY: number | null = null;
const onHeaderTouchStart = (event: TouchEvent) => {
  headerTouchY = event.touches[0]?.clientY ?? null;
};
const onHeaderTouchEnd = (event: TouchEvent) => {
  const startY = headerTouchY;
  headerTouchY = null;
  const endY = event.changedTouches[0]?.clientY;
  if (startY === null || endY === undefined) return;
  const dy = endY - startY;
  if (dy < -SWIPE_PX && !expanded.value) controller.setMobileSheetExpanded(true);
  else if (dy > SWIPE_PX && expanded.value) {
    controller.setMobileSheetExpanded(false);
  }
};

// ── Tools ───────────────────────────────────────────────────────────────────
// Keep the active tool in view as the row scrolls sideways.
watch(
  () => ui.mobileOpenToolId,
  async (id) => {
    if (!id) return;
    await nextTick();
    rowRef.value
      ?.querySelector<HTMLElement>(`[data-tool-id="${id}"]`)
      ?.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: "smooth" });
  },
);
</script>

<style scoped>
/* Figma "Toolbar": header 46px over a 76px tools row, min 376 wide. */
.mtt {
  display: flex;
  /* Taps act at once: no double-tap zoom wait on our controls. */
  touch-action: manipulation;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  animation: mtt-in var(--duration-morph) var(--easing-snap) both;
}

.mtt__header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px 0 16px;
  border-bottom: 1px solid var(--color-divider);
}

.mtt__title {
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.mtt__size {
  font-family: "Roboto Mono", ui-monospace, monospace;
  font-size: 14px;
  color: var(--color-content-low);
  white-space: nowrap;
}

.mtt__spacer {
  flex: 1 1 auto;
}

.mtt__settings {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-content-high);
  white-space: nowrap;
  cursor: pointer;
}

.mtt__settings:disabled {
  cursor: default;
  opacity: 0.45;
}

/* Figma's chevron points down and is rotated to read "expand up"; open, it
   points down again ("collapse"). */
.mtt__chevron {
  width: 16px;
  height: 16px;
  transform: rotate(180deg);
  transition: transform var(--duration-morph) var(--easing-snap);
}

.mtt--sheet .mtt__chevron {
  transform: none;
}

.mtt__tools {
  display: flex;
  gap: 2px;
  padding: 6px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  /* Soft edges hint that the row scrolls sideways. */
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 8px,
    #000 calc(100% - 16px),
    transparent 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 8px,
    #000 calc(100% - 16px),
    transparent 100%
  );
}

.mtt__tools::-webkit-scrollbar {
  display: none;
}

@keyframes mtt-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mtt {
    animation: none;
  }
}
</style>
