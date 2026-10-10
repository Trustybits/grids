<!--
  MobileTileToolbar.vue

  The selected tile's floating toolbar (Figma "Toolbar", 162:6782): a header
  with the tile type, its live size and "All settings", over a row of that
  tile's tools that scrolls sideways (`mobileTools`, plan §5).

  Lives inside the bottom bar's pill, so the pill itself morphs from the home
  buttons into this — no second surface appears.

  Tool behaviour today: instant tools act (Duplicate, Delete, Open, Copy,
  Download, Re-center, Preview); Arrange enters move/resize; popover and mode
  tools show as selected and their panels arrive with the popover step.
-->
<template>
  <div class="mtt" data-tile-edit-surface>
    <header class="mtt__header">
      <span class="mtt__title">{{ title }}</span>
      <span class="mtt__size">{{ sizeLabel }}</span>
      <span class="mtt__spacer"></span>
      <button
        type="button"
        class="mtt__settings"
        aria-label="All settings"
        :aria-expanded="ui.mobileSheetExpanded ? 'true' : 'false'"
        disabled
      >
        All settings
        <MobileToolIcon name="chevron" class="mtt__chevron" />
      </button>
    </header>

    <div
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
        :href="tool.id === 'open' ? actions.resolvedTileUrl.value : undefined"
        @select="onSelect(tool)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, proxyRefs, ref, watch } from "vue";
import type { Tile } from "@grids/contracts/types";
import MobileToolButton, { type MobileToolState } from "./MobileToolButton.vue";
import MobileToolIcon from "./MobileToolIcon.vue";
import {
  getMobileTools,
  WRITERS,
  type MobileTool,
  type MobileToolId,
} from "@/registries/tileToolbar/mobileTools";
import { getTileDefinition } from "@/registries/tileRegistry";
import { getTileToolbarButtons } from "@/registries/tileToolbar";
import type { ToolbarContext } from "@/types/TileToolbar";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useToastStore } from "@/stores/toast";
import { useGridController } from "@/controllers/useGridController";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useMobileExperience } from "@/composables/useMobileExperience";
import { useMobileTileEdit } from "@/composables/useMobileTileEdit";
import { useTileActions } from "@/composables/useTileActions";
import { getGridEngineBridge } from "@/composables/useGridEngineBridge";

const props = defineProps<{ tile: Tile }>();

const ui = useGridUiStore();
const history = useGridHistoryStore();
const toastStore = useToastStore();
const controller = useGridController();
const gridView = proxyRefs(useGridViewContext());
const { isUnifiedText } = useMobileExperience();
const { handle } = useMobileTileEdit();
const actions = useTileActions(() => props.tile);

const rowRef = ref<HTMLElement | null>(null);

// ── Header ──────────────────────────────────────────────────────────────────
const title = computed(() => {
  const label = getTileDefinition(props.tile.content.type)?.label ?? "Tile";
  return `${label} tile`.toUpperCase();
});

/** The size as laid out right now (the phone breakpoint), not the desktop one. */
const sizeLabel = computed(() => {
  const placed = gridView.displayPositions.find(
    (item) => item.i === props.tile.i,
  );
  const w = placed?.w ?? props.tile.w;
  const h = placed?.h ?? props.tile.h;
  return `${w}×${h}`;
});

// ── Tools ───────────────────────────────────────────────────────────────────
const tools = computed(() =>
  getMobileTools({
    tile: props.tile,
    unifiedText: isUnifiedText.value,
    canDownload: actions.hasDownload.value,
  }),
);

const ICON_BY_TOOL: Partial<Record<MobileToolId, string>> = {
  mapStyle: "map-style",
};
const iconFor = (id: MobileToolId) => ICON_BY_TOOL[id] ?? id;

const stateFor = (tool: MobileTool): MobileToolState => {
  if (tool.danger) return "danger";
  if (ui.mobileOpenToolId === tool.id) return "selected";
  if (tool.id === "arrange" && ui.mobileArrangeTileId === props.tile.i) {
    return "selected";
  }
  // Toggles that are on read as "on" while their panel is closed.
  if (tool.id === "border" && WRITERS.border.read(props.tile) === true) {
    return "on";
  }
  if (tool.id === "link" && WRITERS.link.read(props.tile)) return "on";
  return "default";
};

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

/** Run a desktop registry action against the live tile (map re-center). */
const runRegistryAction = (buttonId: string) => {
  const tileHandle = handle.value;
  if (!tileHandle) return;
  const context: ToolbarContext = {
    tile: props.tile,
    childComponent: tileHandle.childComponent,
    gridView,
    resizeTile: tileHandle.resizeTile,
    isEditing: tileHandle.isEditing,
    isExitingCropMode: tileHandle.isExitingCropMode,
  };
  getTileToolbarButtons(props.tile.content.type, context)
    .find((button) => button.id === buttonId)
    ?.action(context);
};

/**
 * Scroll a tile so it sits in the band between the top chrome and the bottom
 * bar. Griddle only renders tiles near the viewport, so a fresh copy below the
 * fold doesn't exist yet — bringing it into view is what mounts it (and lets
 * it register as the selection).
 */
const scrollTileIntoView = (tileId: string) => {
  const rect = getGridEngineBridge()?.tileRect(tileId);
  if (!rect) return;
  const top = 96;
  const bottomChrome =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--mobile-bottom-chrome-h",
      ),
    ) || 160;
  const bottom = window.innerHeight - bottomChrome - 16;
  if (rect.top >= top && rect.top + rect.height <= bottom) return;
  window.scrollBy({ top: rect.top - top, behavior: "smooth" });
};

const duplicate = async () => {
  const newId = gridView.duplicateTile(props.tile.i);
  if (!newId) return;
  // You usually duplicate in order to change the copy, so it becomes the
  // selection; it registers its handle once it mounts.
  controller.setMobileEditTile(newId);
  toastStore.addToast("Tile duplicated", "success");
  await nextTick();
  scrollTileIntoView(newId);
};

const remove = () => {
  const tileId = props.tile.i;
  // The tile's own exit animation when its handle is live; otherwise straight
  // through the engine (a selection that hasn't mounted yet).
  const handleRemove = handle.value?.remove;
  if (handleRemove) handleRemove();
  else getGridEngineBridge()?.removeTiles([tileId]);
  toastStore.addToast("Tile deleted", "info", 5000, {
    label: "Undo",
    // Only while the delete is still the latest step; anything newer would
    // be undone instead.
    run: () => {
      if (history.undoActionLabel === "Remove tile") void controller.undo();
    },
  });
};

const onSelect = (tool: MobileTool) => {
  switch (tool.id) {
    case "duplicate":
      return void duplicate();
    case "delete":
      return remove();
    case "open":
      // A real link; the browser follows it.
      return;
    case "copy":
      return void actions.copyToClipboard();
    case "download":
      return void actions.download();
    case "recenter":
      return runRegistryAction("map-recenter");
    case "preview":
      return handle.value?.childComponent.value?.openPreview?.();
    case "arrange":
      return controller.setMobileArrangeTile(
        ui.mobileArrangeTileId === props.tile.i ? null : props.tile.i,
      );
    default:
      // Popover and mode tools: selecting is the visible state; their panels
      // come with the popover step. A second tap closes.
      return controller.setMobileOpenTool(
        ui.mobileOpenToolId === tool.id ? null : tool.id,
      );
  }
};
</script>

<style scoped>
/* Figma "Toolbar": header 46px over a 76px tools row, min 376 wide. */
.mtt {
  display: flex;
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

/* Figma's chevron points down and is rotated to read "expand up". */
.mtt__chevron {
  width: 16px;
  height: 16px;
  transform: rotate(180deg);
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
