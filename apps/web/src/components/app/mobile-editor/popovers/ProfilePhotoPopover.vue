<!--
  ProfilePhotoPopover.vue — Photo (profile): upload a photo, import one by
  URL, or remove it. The live tile owns the upload and the import, so this
  hands the URL to it and shows its error if the import fails.
-->
<template>
  <p v-if="compact" class="pp-note">
    Make the tile bigger to show a photo.
  </p>
  <PopoverImageSource
    v-else
    label="Profile photo"
    :has-image="hasPhoto"
    remove-label="Remove photo"
    :error="error"
    :busy="busy"
    @upload="child?.openCustomImagePicker?.()"
    @url="useUrl"
    @remove="child?.removeCustomImage?.()"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import PopoverImageSource from "./PopoverImageSource.vue";
import { useMobileTileEdit } from "@/composables/useMobileTileEdit";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";

/** The profile tile's members this popover drives. */
interface ProfileChild {
  isCompactProfileLayout?: boolean;
  openCustomImagePicker?: () => void;
  removeCustomImage?: () => Promise<void>;
  applyAvatarUrl?: () => Promise<void>;
  draftAvatarUrl?: string;
  urlError?: string;
  showUrlInput?: boolean;
}

const visit = useToolPopoverVisit();
const { handle } = useMobileTileEdit();

const child = computed(
  () => (handle.value?.childComponent.value ?? null) as ProfileChild | null,
);

const compact = computed(() => !!child.value?.isCompactProfileLayout);

const hasPhoto = computed(
  () =>
    !!(visit.tiles.value[0]?.content as { profilePhotoUrl?: string } | undefined)
      ?.profilePhotoUrl,
);

const error = ref("");
const busy = ref(false);

const useUrl = async (url: string) => {
  const tile = child.value;
  if (!tile?.applyAvatarUrl) return;
  error.value = "";
  busy.value = true;
  tile.draftAvatarUrl = url;
  try {
    await tile.applyAvatarUrl();
  } finally {
    busy.value = false;
  }
  error.value = tile.urlError ?? "";
  // The tile's own URL popover stays shut; this card shows the error.
  tile.showUrlInput = false;
};
</script>
