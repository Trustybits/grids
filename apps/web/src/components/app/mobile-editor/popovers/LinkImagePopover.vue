<!--
  LinkImagePopover.vue — Image (link tile): upload a picture, use one by URL,
  or remove it. Runs through the live tile, which owns the upload.
-->
<template>
  <PopoverImageSource
    label="Link image"
    :has-image="hasImage"
    @upload="child?.openCustomImagePicker?.()"
    @url="useUrl"
    @remove="remove"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import PopoverImageSource from "./PopoverImageSource.vue";
import { useMobileTileEdit } from "@/composables/useMobileTileEdit";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { useGridController } from "@/controllers/useGridController";

const visit = useToolPopoverVisit();
const { handle } = useMobileTileEdit();
const controller = useGridController();

const child = computed(() => handle.value?.childComponent.value ?? null);

const hasImage = computed(() => {
  const content = visit.tiles.value[0]?.content as
    | { customImageUrl?: string; metaImageUrl?: string }
    | undefined;
  return !!(content?.customImageUrl || content?.metaImageUrl);
});

const useUrl = (url: string) => {
  child.value?.applyImageUrlFromToolbar?.(url);
  controller.setMobileOpenTool(null);
};

const remove = () => child.value?.removeImage?.();
</script>
