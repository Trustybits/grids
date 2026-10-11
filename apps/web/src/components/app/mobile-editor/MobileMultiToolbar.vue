<!--
  MobileMultiToolbar.vue

  The bottom bar in multi-edit (plan S7): a header with how many tiles are
  picked and "All settings", over the tools they all share that are safe to
  apply to every one of them (`getSharedMobileTools`, plan §6).

  A tool changes every picked tile that supports it as one undo step. Where
  the tiles disagree (border on for some, off for others) the tool shows as
  mixed; picking a value sets it on all. Delete removes them all (one undo,
  then multi-edit ends); Duplicate copies them all and keeps the picks on the
  originals.
-->
<template>
  <div class="mtt" :class="{ 'mtt--sheet': expanded }" data-tile-edit-surface>
    <header class="mtt__header">
      <span class="mtt__title">{{ title }}</span>
      <span class="mtt__spacer"></span>
      <button
        type="button"
        class="mtt__settings"
        aria-controls="mmt-all-settings"
        :aria-expanded="expanded ? 'true' : 'false'"
        @click="controller.setMobileSheetExpanded(!expanded)"
      >
        All settings
        <MobileToolIcon name="chevron" class="mtt__chevron" />
      </button>
    </header>

    <MobileAllSettings
      v-if="expanded"
      id="mmt-all-settings"
      :tiles="multi.tiles.value"
      :tools="multi.tools.value"
      @action="run"
    />

    <div
      v-else
      class="mtt__tools"
      role="toolbar"
      :aria-label="`${title} tools`"
    >
      <MobileToolButton
        v-for="tool in multi.tools.value"
        :key="tool.id"
        :tool-id="tool.id"
        :icon="mobileToolIcon(tool.id)"
        :label="tool.label"
        :state="stateFor(tool)"
        @select="run(tool)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MobileToolButton, { type MobileToolState } from "./MobileToolButton.vue";
import MobileToolIcon from "./MobileToolIcon.vue";
import MobileAllSettings from "./MobileAllSettings.vue";
import {
  readAcrossTiles,
  WRITERS,
  type MobileTool,
} from "@/registries/tileToolbar/mobileTools";
import { MIXED } from "@/utils/richText/docTransforms";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridController } from "@/controllers/useGridController";
import { useMobileMultiEdit } from "@/composables/useMobileMultiEdit";
import { mobileToolIcon } from "@/composables/useMobileToolActions";

const ui = useGridUiStore();
const controller = useGridController();
const multi = useMobileMultiEdit();

const title = computed(() => {
  const count = multi.tiles.value.length;
  return `${count} ${count === 1 ? "TILE" : "TILES"}`;
});

const expanded = computed(() => ui.mobileSheetExpanded);

const stateFor = (tool: MobileTool): MobileToolState => {
  if (tool.danger) return "danger";
  if (ui.mobileOpenToolId === tool.id) return "selected";
  const tiles = multi.tiles.value;
  if (tool.id === "border") {
    const on = readAcrossTiles(WRITERS.border, tiles);
    if (on === MIXED) return "mixed";
    if (on) return "on";
  }
  if (tool.id === "link") {
    const link = readAcrossTiles(WRITERS.link, tiles);
    if (link === MIXED) return "mixed";
    if (link) return "on";
  }
  return "default";
};

const run = (tool: MobileTool) => {
  if (tool.id === "delete") return multi.removeAll();
  if (tool.id === "duplicate") return multi.duplicateAll();
  controller.setMobileOpenTool(ui.mobileOpenToolId === tool.id ? null : tool.id);
};
</script>

<style scoped>
/* Shares the tile toolbar's look (MobileTileToolbar), repeated here because
   its styles are scoped. */
.mtt {
  display: flex;
  touch-action: manipulation;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  animation: mmt-in var(--duration-morph) var(--easing-snap) both;
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
}

.mtt__tools::-webkit-scrollbar {
  display: none;
}

@keyframes mmt-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mtt {
    animation: none;
  }
}
</style>
