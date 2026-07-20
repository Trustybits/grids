<!--
  MobileTileListSheet.vue

  Mobile 2.0 Add-a-Tile *list* view. Rises from behind the pill once it has
  morphed into the `/TILE` command input and rests flush on top of it as one
  connected surface — the same rise/flush pattern as the `/GRID` settings sheet,
  the `/HEX` color picker and the `/background` image swap sheet.

  This is the list-view counterpart to MobileTileCarousel: it is deliberately a
  separate component (not a layout variant of the carousel) so the two can
  diverge later. For now it shows effectively the same tile-type list; the
  per-type "N times used" counts and subtype list arrive in Phase 5.2.
-->
<template>
  <div class="mtl-panel" role="listbox" aria-label="Tile types">
    <button
      v-for="type in types"
      :key="type.id"
      type="button"
      role="option"
      class="mtl-row"
      :class="{ 'mtl-row--selected': type.id === selectedId }"
      :aria-selected="type.id === selectedId"
      :aria-label="type.label"
      @click="emit('select', type.id)"
    >
      <span class="mtl-row__icon">
        <component :is="type.icon" />
      </span>
      <span class="mtl-row__label">{{ type.label }}</span>
    </button>

    <p v-if="!types.length" class="mtl-empty">No matching tiles</p>
  </div>
</template>

<script setup lang="ts">
import type { TileTypeDescriptor } from "@/composables/useTileCreation";

withDefaults(
  defineProps<{
    types: TileTypeDescriptor[];
    selectedId?: string | null;
  }>(),
  {
    selectedId: null,
  },
);

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<style lang="scss" scoped>
.mtl-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xs, 2px);
  width: 100%;
  // Scrolls if the list overflows; caps like the other connected sheets so it
  // never grows taller than the space above the bar.
  max-height: 33.5vh;
  padding: var(--spacing-sm) var(--spacing-xs);
  overflow-y: auto;
  overflow-x: hidden;
  background-color: var(--color-toolbar-background);
  border: var(--border-width) solid var(--color-stroke);
  // Square bottom corners so the panel lines up flush with the (top-squared)
  // `/TILE` command input resting directly beneath it.
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  box-shadow: var(--shadow-xl);
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mtl-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-smooth);

  &:hover,
  &:focus-visible {
    background: var(--color-base-8);
    outline: none;
  }
}

// Active command type (link / embed / map): stays highlighted while the user
// types the tile's content into the command input.
.mtl-row--selected {
  background: var(--color-base-8);
}

.mtl-row__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  line-height: 0;
  color: var(--color-text-primary);

  :deep(svg) {
    width: 22px;
    height: 22px;
  }
}

.mtl-row__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: var(--font-weight-medium);
}

.mtl-empty {
  margin: 0;
  padding: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-content-default);
}
</style>
