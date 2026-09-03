<template>
  <div class="tile-picker">
    <!-- Header with Create Custom Card Action -->
    <div class="tile-picker__header">
      <div>
        <h4 class="tile-picker__title">Cards & Tiles</h4>
        <span class="tile-picker__count">{{ totalCardsCount }} available</span>
      </div>
      <button
        type="button"
        class="tile-picker__create-btn"
        @click="showCreator = !showCreator"
      >
        {{ showCreator ? "✕ Close" : "+ Custom Card" }}
      </button>
    </div>

    <!-- Quick Custom Card Creator (Reversible) -->
    <div v-if="showCreator" class="tile-creator">
      <span class="tile-creator__label">CREATE CUSTOM CARD</span>

      <!-- Type Pills -->
      <div class="tile-creator__types">
        <button
          v-for="type in CREATOR_TYPES"
          :key="type.id"
          type="button"
          class="tile-creator__type-pill"
          :class="{ 'is-active': newCardType === type.id }"
          @click="newCardType = type.id"
        >
          {{ type.label }}
        </button>
      </div>

      <input
        type="text"
        class="tile-creator__input"
        v-model="newCardTitle"
        :placeholder="titlePlaceholder"
      />

      <input
        v-if="newCardType === 'link'"
        type="text"
        class="tile-creator__input"
        v-model="newCardExtra"
        placeholder="https://example.com"
      />

      <!-- Circular Color Selection -->
      <div class="tile-creator__color-row">
        <span class="tile-creator__color-label">Color</span>
        <div class="tile-creator__swatches">
          <button
            v-for="color in CREATOR_COLORS"
            :key="color"
            type="button"
            class="tile-creator__circle-swatch"
            :style="{ background: color }"
            :class="{ 'is-selected': newCardColor === color }"
            @click="newCardColor = color"
          />
        </div>
      </div>

      <Button
        variant="primary"
        size="sm"
        class="tile-creator__submit"
        :disabled="!newCardTitle.trim()"
        @click="handleCreateCard"
      >
        Add to Canvas
      </Button>
    </div>

    <!-- Custom Cards Section (if any created) -->
    <div v-if="customTiles && customTiles.length" class="tile-picker__section">
      <span class="tile-picker__section-title">CUSTOM CARDS</span>
      <div class="tile-picker__list">
        <div
          v-for="tileItem in customTiles"
          :key="getTileId(tileItem)"
          class="tile-picker__card"
          :class="{ 'is-active': activeTileIds.includes(getTileId(tileItem)) }"
          :style="{ '--picker-bg': getTileColor(tileItem) }"
        >
          <div class="tile-picker__thumb">
            <span class="tile-picker__type-tag">{{ getTileType(tileItem) }}</span>
          </div>

          <div class="tile-picker__details">
            <span class="tile-picker__name">{{ getTileLabel(tileItem) }}</span>
            <span class="tile-picker__meta">Custom</span>
          </div>

          <div class="tile-picker__card-actions">
            <button
              v-if="!activeTileIds.includes(getTileId(tileItem))"
              type="button"
              class="tile-picker__add-btn"
              @click.stop="$emit('add-tile', getTileId(tileItem))"
            >
              + Add
            </button>
            <span v-else class="tile-picker__added">Placed</span>

            <button
              type="button"
              class="tile-picker__del-btn"
              title="Delete custom card"
              @click.stop="$emit('delete-custom-tile', getTileId(tileItem))"
            >
              &times;
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Live Grid Tiles Section -->
    <div class="tile-picker__section">
      <span class="tile-picker__section-title">GRID TILES</span>
      <p v-if="!gridTiles.length" class="tile-picker__empty">
        No tiles on your grid yet. Use the <em>+ Custom Card</em> button above to create one!
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "@/components/ui-elements/Button.vue";
import { getTileDefinition } from "@/registries/tileRegistry";

const props = defineProps<{
  gridTiles: Array<any>;
  customTiles?: Array<any>;
  activeTileIds: string[];
}>();

const emit = defineEmits<{
  "add-tile": [tileId: string];
  "create-custom-tile": [tile: any];
  "delete-custom-tile": [tileId: string];
}>();

const showCreator = ref(false);
const newCardType = ref<"text" | "link" | "profile">("text");
const newCardTitle = ref("");
const newCardExtra = ref("");
const newCardColor = ref("#6366f1");

const CREATOR_TYPES = [
  { id: "text" as const, label: "Text" },
  { id: "link" as const, label: "Link" },
  { id: "profile" as const, label: "Profile" },
];

const CREATOR_COLORS = [
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#10b981",
  "#3b82f6",
  "#18181b",
];

const titlePlaceholder = computed(() => {
  switch (newCardType.value) {
    case "link": return "Link title (e.g. My Portfolio)";
    case "profile": return "Name / Handle";
    case "text":
    default: return "Card text or quote";
  }
});

const totalCardsCount = computed(
  () => props.gridTiles.length + (props.customTiles?.length || 0),
);

const handleCreateCard = () => {
  const id = `custom_${Date.now()}`;
  let content: any = {};

  if (newCardType.value === "link") {
    content = {
      type: "link",
      title: newCardTitle.value.trim(),
      url: newCardExtra.value.trim() || "https://grids.so",
      backgroundColor: newCardColor.value,
    };
  } else if (newCardType.value === "profile") {
    content = {
      type: "profile_bio",
      name: newCardTitle.value.trim(),
      bio: "Creator & Designer",
      backgroundColor: newCardColor.value,
    };
  } else {
    content = {
      type: "text",
      text: newCardTitle.value.trim(),
      backgroundColor: newCardColor.value,
    };
  }

  const newTile = {
    i: id,
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: newCardTitle.value.trim(),
    content,
  };

  emit("create-custom-tile", newTile);
  newCardTitle.value = "";
  newCardExtra.value = "";
  showCreator.value = false;
};

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

.tile-picker__create-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid rgba(168, 85, 247, 0.35);
  border-radius: 6px;
  color: var(--color-figma-purple, #a855f7);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(168, 85, 247, 0.25);
    border-color: var(--color-figma-purple, #a855f7);
  }
}

/* ── Custom Card Creator ─────────────────────────────────────────────────── */
.tile-creator {
  background: #141417;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tile-creator__label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #71717a;
  text-transform: uppercase;
}

.tile-creator__types {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  padding: 3px;
  border-radius: 8px;
}

.tile-creator__type-pill {
  flex: 1;
  padding: 4px;
  font-size: 11px;
  font-weight: 600;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #71717a;
  cursor: pointer;

  &:hover {
    color: #ffffff;
  }

  &.is-active {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }
}

.tile-creator__input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  background: #0d0d10;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #ffffff;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: var(--color-figma-purple, #a855f7);
  }
}

.tile-creator__color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tile-creator__color-label {
  font-size: 11px;
  color: #71717a;
}

.tile-creator__swatches {
  display: flex;
  gap: 6px;
}

.tile-creator__circle-swatch {
  width: 20px !important;
  height: 20px !important;
  border-radius: 50% !important;
  aspect-ratio: 1 !important;
  padding: 0 !important;
  margin: 0 !important;
  border: 2px solid transparent !important;
  box-sizing: border-box !important;
  cursor: pointer;
  transition: transform 0.15s ease;

  &:hover {
    transform: scale(1.15);
  }

  &.is-selected {
    border-color: #ffffff !important;
    outline: 2px solid var(--color-figma-purple, #a855f7) !important;
  }
}

.tile-creator__submit {
  width: 100%;
  justify-content: center;
}

/* ── Section & Lists ─────────────────────────────────────────────────────── */
.tile-picker__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tile-picker__section-title {
  font-size: 10px;
  font-weight: 700;
  color: #71717a;
  letter-spacing: 0.05em;
  text-transform: uppercase;
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

.tile-picker__card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
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

.tile-picker__del-btn {
  background: transparent;
  border: none;
  color: #71717a;
  font-size: 16px;
  padding: 0 4px;
  cursor: pointer;

  &:hover {
    color: #ef4444;
  }
}

.tile-picker__empty {
  margin: 0;
  font-size: 12px;
  color: #71717a;
  line-height: 1.4;

  em {
    color: var(--color-figma-purple, #a855f7);
    font-style: normal;
  }
}
</style>
