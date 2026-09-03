<template>
  <div class="tile-picker">
    <!-- Header -->
    <div class="tile-picker__header">
      <div>
        <h4 class="tile-picker__title">Cards & Tiles</h4>
        <span class="tile-picker__count">
          {{ searchQuery.trim() ? `${filteredTiles.length} of ${gridTiles.length}` : `${gridTiles.length} available` }}
        </span>
      </div>
    </div>

    <!-- Search Input Slot -->
    <div v-if="gridTiles.length > 0" class="tile-picker__search-wrap">
      <SearchIcon class="tile-picker__search-icon" />
      <input
        v-model="searchQuery"
        type="text"
        class="tile-picker__search-input"
        placeholder="Search tiles (e.g. photo, link, music)..."
      />
      <button
        v-if="searchQuery"
        type="button"
        class="tile-picker__search-clear"
        aria-label="Clear search"
        @click="searchQuery = ''"
      >
        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- Live Grid Tiles Section -->
    <div class="tile-picker__section">
      <div class="tile-picker__section-header">
        <span class="tile-picker__section-title">GRID TILES</span>
        <span v-if="activeTileIds.length > 0" class="tile-picker__placed-badge">
          {{ activeTileIds.length }} on canvas
        </span>
      </div>

      <p v-if="!gridTiles.length" class="tile-picker__empty">
        No tiles on your grid yet.
      </p>

      <!-- No search match -->
      <div v-else-if="searchQuery.trim() && !filteredTiles.length" class="tile-picker__no-match">
        <p>No tiles match "{{ searchQuery }}"</p>
        <button type="button" class="tile-picker__clear-btn" @click="searchQuery = ''">
          Clear Search
        </button>
      </div>

      <div v-else class="tile-picker__list">
        <button
          v-for="tileItem in filteredTiles"
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { getTileDefinition } from "@/registries/tileRegistry";
import SearchIcon from "@/components/icons/toolbar/SearchIcon.vue";

const props = defineProps<{
  gridTiles: Array<any>;
  activeTileIds: string[];
}>();

defineEmits<{
  "add-tile": [tileId: string];
}>();

const searchQuery = ref("");

const filteredTiles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.gridTiles;
  return props.gridTiles.filter((item) => {
    const label = getTileLabel(item).toLowerCase();
    const type = getTileType(item).toLowerCase();
    const caption = (item.caption || "").toLowerCase();
    const contentTitle = (item.content?.title || item.content?.label || item.content?.name || "").toLowerCase();
    return label.includes(q) || type.includes(q) || caption.includes(q) || contentTitle.includes(q);
  });
});

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
  gap: 16px;
  height: 100%;
  padding: 16px;
  overflow-y: auto;
  user-select: none;
}

.tile-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tile-picker__title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tile-picker__count {
  font-size: 11px;
  color: #a1a1aa;
  font-weight: 500;
}

/* ── Search Input Bar ────────────────────────────────────────────────────── */
.tile-picker__search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.tile-picker__search-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  color: #71717a;
  pointer-events: none;
}

.tile-picker__search-input {
  width: 100%;
  height: 34px;
  padding: 0 30px 0 32px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #ffffff;
  font-size: 12px;
  outline: none;
  transition: all 0.15s ease;

  &::placeholder {
    color: #71717a;
  }

  &:focus {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--color-figma-purple, #a855f7);
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.15);
  }
}

.tile-picker__search-clear {
  position: absolute;
  right: 8px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  border-radius: 50%;
  color: #ffffff;
  cursor: pointer;
  padding: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }
}

/* ── Section & Lists ─────────────────────────────────────────────────────── */
.tile-picker__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tile-picker__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tile-picker__section-title {
  font-size: 10px;
  font-weight: 700;
  color: #71717a;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tile-picker__placed-badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-figma-purple, #a855f7);
  background: rgba(168, 85, 247, 0.15);
  padding: 2px 7px;
  border-radius: 9999px;
}

.tile-picker__no-match {
  padding: 24px 12px;
  text-align: center;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 10px;

  p {
    margin: 0 0 10px;
    font-size: 12px;
    color: #71717a;
  }
}

.tile-picker__clear-btn {
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.18);
  }
}

.tile-picker__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tile-picker__card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #141417;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  color: #ffffff;
  width: 100%;

  &:hover:not(:disabled) {
    background: #1e1e24;
    border-color: var(--color-figma-purple, #a855f7);
    transform: translateY(-1px);
  }

  &.is-active {
    opacity: 0.55;
    background: #0d0d10;
    cursor: default;
    border-color: transparent;
  }

  &:disabled {
    cursor: default;
  }
}

.tile-picker__thumb {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  background: var(--picker-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  overflow: hidden;
}

.tile-picker__icon {
  width: 16px;
  height: 16px;
  color: #ffffff;
}

.tile-picker__type-tag {
  font-size: 8px;
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
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-picker__meta {
  font-size: 10px;
  color: #71717a;
}

.tile-picker__added {
  font-size: 10px;
  font-weight: 600;
  color: #71717a;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
}

.tile-picker__add-btn {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-figma-purple, #a855f7);
  padding: 3px 8px;
  background: rgba(168, 85, 247, 0.12);
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(168, 85, 247, 0.25);
  }
}

.tile-picker__empty {
  margin: 0;
  font-size: 12px;
  color: #71717a;
  line-height: 1.4;
}
</style>
