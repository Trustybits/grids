<!--
  MediaUnavailable.vue

  Shared empty-state for a media tile whose source will not load — the file was
  deleted, the upload never finished, or the URL rotted (a storage migration
  moving objects to content-addressed paths will do this to any reference that
  was not rewritten).

  Before this existed, a dead source rendered as the browser's default broken
  image glyph with no explanation and no way to act on it, so an orphaned tile
  was indistinguishable from one that was merely slow.

  Owners get the reason plus a way to remove the tile. Visitors get the label
  only — they cannot act on it, and a broken glyph reads worse than a quiet
  "unavailable".
-->
<template>
  <div class="media-unavailable" :class="{ 'is-owner': canEdit }">
    <AlertCircleIcon class="media-unavailable__icon" :size="iconSize" />
    <p class="media-unavailable__label">{{ label }}</p>
    <template v-if="canEdit">
      <p v-if="showDetail" class="media-unavailable__hint">
        The file may have been deleted, or the upload never finished.
      </p>
      <button
        v-if="showDetail"
        type="button"
        class="media-unavailable__action"
        @click.stop="$emit('remove')"
      >
        Remove tile
      </button>
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, inject, type ComputedRef } from "vue";
import AlertCircleIcon from "../icons/AlertCircleIcon.vue";

export default defineComponent({
  components: { AlertCircleIcon },
  emits: ["remove"],
  props: {
    /** Short noun phrase, e.g. "Image unavailable". */
    label: {
      type: String,
      default: "Media unavailable",
    },
    /** Owners get the explanation and the remove action; visitors do not. */
    canEdit: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    // Tiles can be as small as 1x1, where an icon plus three lines of copy is
    // illegible. Below the threshold we keep the icon and label only, matching
    // how the tile content components themselves collapse at small sizes.
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);

    const showDetail = computed(() => {
      const w = gridTileW?.value ?? 4;
      const h = gridTileH?.value ?? 4;
      return w >= 3 && h >= 2;
    });

    const iconSize = computed(() => (showDetail.value ? 32 : 24));

    return { showDetail, iconSize };
  },
});
</script>

<style scoped>
.media-unavailable {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  text-align: center;
  box-sizing: border-box;
  color: color-mix(in srgb, var(--tile-text-color, currentColor) 55%, transparent);
}

.media-unavailable__icon {
  flex: 0 0 auto;
  opacity: 0.7;
}

.media-unavailable__label {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}

.media-unavailable__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  max-width: 28ch;
  color: color-mix(in srgb, var(--tile-text-color, currentColor) 40%, transparent);
}

.media-unavailable__action {
  margin-top: 2px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  color: var(--tile-text-color, currentColor);
  background: color-mix(in srgb, var(--tile-text-color, currentColor) 10%, transparent);
  border: 1px solid
    color-mix(in srgb, var(--tile-text-color, currentColor) 22%, transparent);
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
    border-color var(--duration-fast) var(--easing-ease-in-out);
}

.media-unavailable__action:hover {
  background: color-mix(in srgb, var(--tile-text-color, currentColor) 18%, transparent);
  border-color: color-mix(in srgb, var(--tile-text-color, currentColor) 36%, transparent);
}
</style>
