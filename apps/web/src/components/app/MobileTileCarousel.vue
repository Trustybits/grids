<!--
  MobileTileCarousel.vue

  Horizontal, snap-scrolling row of tile-type cards shown above the command
  pill while Add-a-Tile is open. Purely presentational: the parent passes the
  (already filtered) tile types and handles what a selection does. Tile types
  come from useTileCreation's registry so this stays in sync with GridToolbar.

  Note: the Figma shows a 3D "coverflow" fan; that motion polish is deferred —
  a clean scroll-snap row keeps it accessible and touch-friendly for 5.1.
-->
<template>
  <div
    class="tile-carousel"
    :class="`tile-carousel--${layout}`"
    role="listbox"
    aria-label="Tile types"
  >
    <button
      v-for="type in types"
      :key="type.id"
      type="button"
      role="option"
      class="tile-carousel__card"
      :class="{ 'tile-carousel__card--selected': type.id === selectedId }"
      :aria-selected="type.id === selectedId"
      :aria-label="type.label"
      @click="emit('select', type.id)"
    >
      <span class="tile-carousel__icon">
        <component :is="type.icon" />
      </span>
      <span class="tile-carousel__label">{{ type.label }}</span>
    </button>

    <p v-if="!types.length" class="tile-carousel__empty">No matching tiles</p>
  </div>
</template>

<script setup lang="ts">
import type { TileTypeDescriptor } from "@/composables/useTileCreation";

withDefaults(
  defineProps<{
    types: TileTypeDescriptor[];
    layout?: "carousel" | "list";
    selectedId?: string | null;
  }>(),
  {
    layout: "carousel",
    selectedId: null,
  },
);

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<style lang="scss" scoped>
.tile-carousel {
  display: flex;
  align-items: stretch;
  gap: var(--spacing-sm);
  max-width: calc(100vw - var(--spacing-lg) * 2);
  padding: var(--spacing-xs);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
}

// Vertical list variant (view toggle). Rows of icon + label; the per-type
// "N times used" counts arrive with the subtype list in Phase 5.2.
.tile-carousel--list {
  flex-direction: column;
  align-items: stretch;
  gap: var(--spacing-2xs, 2px);
  max-height: 40vh;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-snap-type: none;

  .tile-carousel__card {
    flex-direction: row;
    justify-content: flex-start;
    width: 100%;
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    scroll-snap-align: none;

    &:hover,
    &:focus-visible {
      transform: none;
      background: var(--color-base-8);
    }
  }

  .tile-carousel__label {
    text-align: left;
  }
}

.tile-carousel__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 0 0 auto;
  width: 84px;
  padding: var(--spacing-sm) var(--spacing-xs);
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-lg);
  background: var(--color-tile-background);
  color: var(--color-text-primary);
  cursor: pointer;
  scroll-snap-align: center;
  transition:
    transform var(--duration-fast) var(--easing-spring),
    border-color var(--duration-fast) var(--easing-smooth),
    background-color var(--duration-fast) var(--easing-smooth);

  &:hover,
  &:focus-visible {
    transform: translateY(-2px);
    border-color: var(--color-content-default);
    outline: none;
  }

  &:active {
    transform: translateY(0);
  }
}

// Active command type (link / embed / map): stays highlighted while the user
// types the tile's content into the command input.
.tile-carousel__card--selected {
  border-color: var(--color-content-default);
  background: var(--color-base-8);
}

.tile-carousel__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  line-height: 0;
  color: var(--color-text-primary);

  :deep(svg) {
    width: 28px;
    height: 28px;
  }
}

.tile-carousel__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.tile-carousel__empty {
  margin: 0;
  padding: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-content-default);
}
</style>
