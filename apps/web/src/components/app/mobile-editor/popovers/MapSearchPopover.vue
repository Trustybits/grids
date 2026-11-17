<!--
  MapSearchPopover.vue — Search (map): an address, place or zip, or the
  phone's own location. The live map does the geocoding and the fly-to.
-->
<template>
  <div class="pp-stack">
    <form class="pp-field" @submit.prevent="search">
      <input
        v-model="query"
        class="pp-field__input"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        placeholder="Address, place or zip"
        aria-label="Search the map"
      />
      <button
        type="submit"
        class="pp-pill pp-pill--primary"
        :disabled="!query.trim()"
      >
        Search
      </button>
    </form>
    <button type="button" class="pp-list__item" @click="locate">
      <MobileToolIcon name="recenter" />
      <span>Use my location</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileToolIcon from "../MobileToolIcon.vue";
import { useMobileTileEdit } from "@/composables/useMobileTileEdit";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { useGridController } from "@/controllers/useGridController";
import type { MapTileChild } from "@/types/Tile";

const visit = useToolPopoverVisit();
const { handle } = useMobileTileEdit();
const controller = useGridController();

const child = computed(
  () => (handle.value?.childComponent.value ?? null) as MapTileChild | null,
);

const query = ref(
  (visit.tiles.value[0]?.content as { searchQuery?: string } | undefined)
    ?.searchQuery ?? "",
);

const done = () => {
  (document.activeElement as HTMLElement | null)?.blur?.();
  controller.setMobileOpenTool(null);
};

const search = () => {
  const map = child.value;
  if (!map?.handleSearch || !query.value.trim()) return;
  map.searchInput = query.value;
  void map.handleSearch();
  done();
};

const locate = () => {
  child.value?.useMyLocation?.();
  done();
};
</script>
