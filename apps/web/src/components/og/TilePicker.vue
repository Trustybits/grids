<template>
  <div class="tile-picker">
    <div class="tile-picker__header">
      <h4 class="tile-picker__title">Your Tiles</h4>
      <span class="tile-picker__count">{{ gridTiles.length }} available</span>
    </div>

    <p v-if="!gridTiles.length" class="tile-picker__empty">
      Add tiles to your grid to place them on the share image.
    </p>
    <div v-else class="tile-picker__list">
      <button
        v-for="tileItem in gridTiles"
        :key="getTileId(tileItem)"
        type="button"
        class="tile-picker__card"
        :class="{ 'is-active': activeTileIds.includes(getTileId(tileItem)) }"
        :style="{ '--picker-bg': getTileColor(tileItem) }"
        :disabled="activeTileIds.includes(getTileId(tileItem))"
        @click.stop="$emit('add-tile', getTileId(tileItem))"
      >
        <div class="tile-picker__thumb">
          <component
            :is="getTileDef(tileItem)?.icon"
            v-if="getTileDef(tileItem)?.icon"
            class="tile-picker__icon"
          />
          <span v-else class="tile-picker__type-tag">{{ getTileType(tileItem) }}</span>
        </div>

        <div class="tile-picker__details">
          <span class="tile-picker__name">{{ getTileLabel(tileItem) }}</span>
          <span class="tile-picker__meta">{{ getTileType(tileItem) }}</span>
        </div>

        <span v-if="activeTileIds.includes(getTileId(tileItem))" class="tile-picker__added">
          Placed
        </span>
        <span v-else class="tile-picker__add-btn">+ Add</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getTileDefinition } from "@/registries/tileRegistry";

defineProps<{
  gridTiles: Array<any>;
  activeTileIds: string[];
}>();

defineEmits<{
  "add-tile": [tileId: string];
}>();

const getTileId = (item: any): string => item.i ?? item.id ?? "";

const getTileType = (item: any): string => {
  const type = item.content?.type ?? item.type ?? "tile";
  return type.replace(/_/g, " ").toUpperCase();
};

const getTileDef = (item: any) => {
  const type = item.content?.type;
  if (!type) return undefined;
  return getTileDefinition(type);
};

const getTileColor = (item: any): string => {
  const c = item.content;
  return (
    c?.backgroundColor ||
    c?.color ||
    item.color ||
    "rgba(255, 255, 255, 0.08)"
  );
};

const getTileLabel = (item: any): string => {
  const c = item.content;
  const label =
    item.caption?.trim() ||
    c?.title ||
    c?.label ||
    c?.name ||
    item.label ||
    getTileDef(item)?.label ||
    "Tile";
  return label;
};
</script>

<style lang="scss" scoped>
.tile-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  height: 100%;
  padding: var(--spacing-md);
  overflow-y: auto;
}

.tile-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tile-picker__title {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tile-picker__count {
  font-size: 11px;
  color: var(--color-content-low);
  font-weight: 500;
}

.tile-picker__empty {
  margin: 0;
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.tile-picker__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.tile-picker__card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background: var(--color-tile-background, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--color-stroke, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: all var(--duration-fast) var(--easing-smooth);
  color: var(--color-text-primary);

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--color-figma-purple);
    transform: translateY(-1px);
  }

  &.is-active {
    opacity: 0.55;
    background: rgba(255, 255, 255, 0.02);
    cursor: default;
    border-color: transparent;
  }

  &:disabled {
    cursor: default;
  }
}

.tile-picker__thumb {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--picker-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.tile-picker__icon {
  width: 18px;
  height: 18px;
  color: var(--color-text-primary);
}

.tile-picker__type-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.tile-picker__details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.tile-picker__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.tile-picker__meta {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-content-low);
  letter-spacing: 0.02em;
}

.tile-picker__added {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-content-low);
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-xs);
  flex-shrink: 0;
}

.tile-picker__add-btn {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-figma-purple, #a855f7);
  padding: 3px 8px;
  background: rgba(168, 85, 247, 0.12);
  border-radius: var(--radius-xs);
  flex-shrink: 0;
  transition: background 0.15s ease;

  .tile-picker__card:hover:not(:disabled) & {
    background: rgba(168, 85, 247, 0.25);
  }
}
</style>
