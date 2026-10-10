<!--
  MorePopover.vue — More: the tile's leftover actions as a short list.
  Text: Copy text · Open link (when one is set). Link: Remove favicon.
-->
<template>
  <div class="pp-list" role="menu" aria-label="More actions">
    <button
      v-if="canCopy"
      type="button"
      class="pp-list__item"
      role="menuitem"
      @click="copy"
    >
      <MobileToolIcon name="copy" />
      <span>Copy text</span>
    </button>
    <a
      v-if="isText && actions.hasLink.value"
      class="pp-list__item"
      role="menuitem"
      :href="actions.resolvedTileUrl.value"
      target="_blank"
      rel="noopener noreferrer"
    >
      <MobileToolIcon name="open" />
      <span>Open link</span>
    </a>
    <button
      v-if="hasFavicon"
      type="button"
      class="pp-list__item"
      role="menuitem"
      @click="removeFavicon"
    >
      <MobileToolIcon name="delete" />
      <span>Remove favicon</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, proxyRefs } from "vue";
import { ContentType } from "@grids/contracts/types";
import MobileToolIcon from "../MobileToolIcon.vue";
import { useTileActions } from "@/composables/useTileActions";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridController } from "@/controllers/useGridController";

// More is a single-tile tool: it never shows in multi-edit.
const visit = useToolPopoverVisit();
const tile = computed(() => visit.tiles.value[0]);

const gridView = proxyRefs(useGridViewContext());
const ui = useGridUiStore();
const controller = useGridController();
const actions = useTileActions(tile);

const isText = computed(
  () =>
    tile.value.content.type === ContentType.TEXT ||
    tile.value.content.type === ContentType.SMART_TEXT,
);

const canCopy = computed(() => isText.value && actions.hasCopyable.value);

const hasFavicon = computed(
  () =>
    tile.value.content.type === ContentType.LINK &&
    !!(tile.value.content as { faviconUrl?: string }).faviconUrl,
);

const close = () => {
  if (ui.mobileOpenToolId === "more") controller.setMobileOpenTool(null);
};

const copy = async () => {
  await actions.copyToClipboard();
  close();
};

const removeFavicon = () => {
  gridView.patchTileContent(tile.value.i, { faviconUrl: undefined } as never);
  close();
};
</script>
