<!--
  MobileImageSwapSheet.vue

  Mobile 2.0 background-image swap sheet. Rises from behind the bottom command
  pill once that pill has morphed into the `/background` command input (the same
  morph/rise/flush pattern as the `/GRID` settings sheet and the `/HEX` color
  picker), and rests flush on top of it as one surface.

  Opened by tapping the (already active) image tile in the Grid Settings sheet.
  Contents: a preview of the current background image, then a horizontally
  -scrollable strip of the user's archived images (newest first) to swap between,
  plus an Upload tile for adding a new one. Pasting an image URL to link (instead
  of uploading) is handled by the `/background` input the parent bar owns.

  Selecting a thumbnail / uploading routes through `useGridSettings` so the same
  active-source rules and undo history apply as everywhere else.
-->
<template>
  <div class="mis-panel" role="group" aria-label="Background image">
    <div class="mis-preview">
      <img
        v-if="backgroundImageSrc"
        :src="backgroundImageSrc"
        alt="Current background"
        class="mis-preview__img"
      />
      <span v-else class="mis-preview__empty">No image selected</span>
    </div>

    <div class="mis-strip" role="listbox" aria-label="Your images">
      <button
        type="button"
        class="mis-tile mis-tile--upload"
        aria-label="Upload a new image"
        @click="onUploadClick"
      >
        <PlusIcon :size="20" />
        <span class="mis-tile__label">Upload</span>
      </button>

      <span v-if="loading" class="mis-status" aria-live="polite">
        <SpinnerIcon :size="18" />
      </span>
      <template v-else>
        <button
          v-for="doc in images"
          :key="doc.hash"
          type="button"
          class="mis-tile"
          :class="{ 'is-selected': isSelected(doc) }"
          role="option"
          :aria-selected="isSelected(doc)"
          :aria-label="doc.displayName || 'Background image'"
          :style="doc.url ? { backgroundImage: `url(${doc.url})` } : undefined"
          @click="onPickArchive(doc)"
        />
        <span v-if="!images.length" class="mis-status">
          No images in your archive yet
        </span>
      </template>
    </div>

    <input
      ref="fileInput"
      type="file"
      class="mis-file"
      accept="image/*,image/svg+xml"
      @change.stop="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useFileArchive } from "@/composables/useFileArchive";
import { useGridSettings } from "@/composables/useGridSettings";
import PlusIcon from "@/components/icons/PlusIcon.vue";
import SpinnerIcon from "@/components/icons/SpinnerIcon.vue";
import type { UploadArchiveDocument } from "@grids/contracts/types";

const { uploads, loading, refresh } = useFileArchive();
const {
  backgroundImageSrc,
  backgroundImageHash,
  isImageBackgroundActive,
  uploadBackgroundImage,
  setBackgroundImageFromArchive,
} = useGridSettings();

const fileInput = ref<HTMLInputElement | null>(null);

const images = computed(() =>
  uploads.value.filter(
    (upload) => upload.kind === "images" && upload.status !== "failed",
  ),
);

// A thumbnail is the current background only while the image source is active,
// matched by hash for archive-backed images (falling back to URL for linked).
const isSelected = (doc: UploadArchiveDocument): boolean => {
  if (!isImageBackgroundActive.value) return false;
  if (backgroundImageHash.value && doc.hash) {
    return doc.hash === backgroundImageHash.value;
  }
  return !!doc.url && doc.url === backgroundImageSrc.value;
};

const onPickArchive = (doc: UploadArchiveDocument): void => {
  void setBackgroundImageFromArchive(doc);
};

const onUploadClick = (): void => {
  fileInput.value?.click();
};

const onFileChange = async (event: Event): Promise<void> => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  await uploadBackgroundImage(file);
  // Reflect the just-uploaded image in the strip.
  await refresh().catch(() => undefined);
  if (fileInput.value) fileInput.value.value = "";
};

onMounted(() => {
  void refresh().catch(() => undefined);
});
</script>

<style lang="scss" scoped>
.mis-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: 100%;
  padding: var(--spacing-md);
  background-color: var(--color-toolbar-background);
  border: var(--border-width) solid var(--color-stroke);
  // Square bottom corners so the panel lines up flush with the (top-squared)
  // `/background` command input resting directly beneath it.
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-xl);
}

.mis-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 120px;
  border-radius: var(--radius-md);
  background: var(--color-base-8);
  overflow: hidden;
}

.mis-preview__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mis-preview__empty {
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
}

.mis-strip {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mis-tile {
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  padding: 0;
  // Transparent→purple border (no offset) so the selection ring never clips at
  // the scroll-container edges; border-box keeps the layout from shifting.
  border: var(--border-width-lg) solid transparent;
  border-radius: var(--radius-md);
  background-color: var(--color-base-8);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  cursor: pointer;

  &.is-selected {
    border-color: var(--color-purple);
  }
}

.mis-tile--upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-style: dashed;
  border-color: var(--color-stroke);
  background: transparent;
  color: var(--color-content-low);
}

.mis-tile__label {
  font-size: var(--font-size-2xs, 10px);
  line-height: 1;
}

.mis-status {
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-sm);
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.mis-file {
  display: none;
}
</style>
