<!--
  PopoverImageSource.vue

  Upload · Use image URL · Remove — shared by the link tile's Image and the
  profile's Photo. The parent does the work; this checks the URL is a direct
  image link first, the same rule as the desktop panels.
-->
<template>
  <div class="pp-stack">
    <div class="pp-list" role="group" :aria-label="label">
      <button type="button" class="pp-list__item" @click="$emit('upload')">
        <MobileToolIcon name="image" />
        <span>Upload image</span>
      </button>
      <button
        v-if="hasImage"
        type="button"
        class="pp-list__item pp-list__item--danger"
        @click="$emit('remove')"
      >
        <MobileToolIcon name="delete" />
        <span>{{ removeLabel }}</span>
      </button>
    </div>

    <form class="pp-field" novalidate @submit.prevent="submitUrl">
      <input
        v-model="draft"
        class="pp-field__input"
        type="url"
        inputmode="url"
        autocapitalize="off"
        autocomplete="off"
        spellcheck="false"
        placeholder="Use image URL"
        aria-label="Image URL"
        :aria-invalid="shownError ? 'true' : undefined"
        @input="localError = ''"
      />
      <button
        type="submit"
        class="pp-pill pp-pill--primary"
        :disabled="!draft.trim() || busy"
      >
        Use
      </button>
    </form>
    <p v-if="shownError" class="pp-error" role="alert">{{ shownError }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileToolIcon from "../MobileToolIcon.vue";
import { normalizeTileLink } from "@/utils/tileLink";
import { isDirectImageUrl } from "@/utils/TileUtils";

const props = withDefaults(
  defineProps<{
    label: string;
    hasImage: boolean;
    removeLabel?: string;
    /** An error from applying the URL (e.g. the import failed). */
    error?: string;
    busy?: boolean;
  }>(),
  { removeLabel: "Remove image", error: "", busy: false },
);

const emit = defineEmits<{
  upload: [];
  remove: [];
  url: [url: string];
}>();

const draft = ref("");
const localError = ref("");
const shownError = computed(() => localError.value || props.error);

const submitUrl = () => {
  const url = normalizeTileLink(draft.value);
  if (!url) {
    localError.value = "Enter a valid URL.";
    return;
  }
  if (!isDirectImageUrl(url)) {
    localError.value =
      "Only direct image URLs are supported (png, jpg, gif, webp, svg).";
    return;
  }
  draft.value = "";
  emit("url", url);
};
</script>
