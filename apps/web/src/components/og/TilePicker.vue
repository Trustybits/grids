<template>
  <div class="tile-picker">
    <h4 class="tile-picker__title">Your Tiles</h4>
    <p v-if="!gridTiles.length" class="tile-picker__empty">
      Add tiles to your grid to place them on the share image.
    </p>
    <div v-else class="tile-picker__strip">
      <button
        v-for="tile in gridTiles"
        :key="tile.id"
        type="button"
        class="tile-picker__item"
        :class="{ 'is-active': activeTileIds.includes(tile.id) }"
        :style="{ background: tile.color }"
        :title="tile.label"
        :disabled="activeTileIds.includes(tile.id)"
        @click="$emit('add-tile', tile.id)"
      >
        <span class="tile-picker__label">{{ tile.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  gridTiles: Array<{ id: string; label: string; color: string }>;
  activeTileIds: string[];
}>();

defineEmits<{
  "add-tile": [tileId: string];
}>();
</script>

<style lang="scss" scoped>
.tile-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  height: 100%;
  padding: var(--spacing-md);
  overflow-y: auto;
}

.tile-picker__title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.tile-picker__empty {
  margin: 0;
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.tile-picker__strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: var(--spacing-sm);
}

.tile-picker__item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  transition:
    transform var(--duration-fast) var(--easing-smooth),
    border-color var(--duration-fast) var(--easing-smooth);

  &:hover:not(:disabled) {
    transform: scale(1.05);
    border-color: var(--color-figma-purple);
  }

  &.is-active {
    border-color: var(--color-figma-purple);
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.tile-picker__label {
  position: absolute;
  inset: auto 0 0 0;
  padding: 2px 4px;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}
</style>
