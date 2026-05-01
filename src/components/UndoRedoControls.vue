<template>
  <div
    class="undo-redo-wrapper"
    ref="wrapperRef"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <div class="undo-redo-bar" :class="{ 'undo-redo-bar--hovered': hovered }">
      <button
        class="ur-btn"
        :class="{ 'ur-btn--active': layoutStore.canUndo }"
        :data-tooltip="layoutStore.canUndo ? `Undo ${layoutStore.undoActionLabel}` : undefined"
        @click="layoutStore.undo()"
      >
        Undo
      </button>
      <button
        class="ur-btn"
        :class="{ 'ur-btn--active': layoutStore.canRedo }"
        :data-tooltip="layoutStore.canRedo ? `Redo ${layoutStore.redoActionLabel}` : undefined"
        @click="layoutStore.redo()"
      >
        Redo
      </button>
      <button
        :style="{ 'opacity': hovered ? 100 : 0 }"
        class="ur-chevron"
        :class="{ 'ur-chevron--active': hasHistory, 'ur-chevron--history-open': menuOpen }"
        @click.stop="toggleMenu"
      >
        <Chevron :size="14" />
      </button>
    </div>

    <div v-if="menuOpen" class="ur-history" ref="historyRef">
      <div class="ur-history__scroll">
        <div
          v-for="item in historyItems"
          :key="item.snapshotId"
          class="ur-history-item"
          :class="{
            'ur-history-item--highlighted': item.isNextRedo,
            'ur-history-item--redo': item.isRedo,
          }"
          @click="goTo(item.snapshotId)"
          @mouseenter="onItemEnter($event, item)"
          @mouseleave="hoveredItem = null"
        >
          <div class="ur-history-item__indicator" />
          <span class="ur-history-item__label">{{ item.actionLabel }}</span>
          <span class="ur-history-item__time">{{ item.relativeTime }}</span>
        </div>
        <div v-if="historyItems.length === 0" class="ur-history-empty">
          No history
        </div>
      </div>
      <div
        v-if="hoveredItem"
        class="ur-history-tooltip"
        :style="tooltipStyle"
      >
        {{ hoveredItem.tooltip }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useLayoutStore } from "@/stores/layout";
import { formatRelativeSince } from "@/utils/relativeTime";
import Chevron from "@/components/icons/Chevron.vue";

const layoutStore = useLayoutStore();
const hovered = ref(false);
const menuOpen = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);
const historyRef = ref<HTMLElement | null>(null);

interface HistoryItem {
  snapshotId: number;
  actionLabel: string;
  relativeTime: string;
  isRedo: boolean;
  isNextRedo: boolean;
  tooltip: string;
}

const hoveredItem = ref<HistoryItem | null>(null);
const tooltipY = ref(0);

const hasHistory = computed(() => layoutStore.canUndo || layoutStore.canRedo);

const tooltipStyle = computed(() => ({
  top: `${tooltipY.value}px`,
}));

const onItemEnter = (e: MouseEvent, item: HistoryItem) => {
  hoveredItem.value = item;
  const target = e.currentTarget as HTMLElement;
  const historyEl = historyRef.value;
  if (!target || !historyEl) return;
  const historyRect = historyEl.getBoundingClientRect();
  const itemRect = target.getBoundingClientRect();
  tooltipY.value = itemRect.top - historyRect.top + itemRect.height / 2;
};

const historyItems = computed<HistoryItem[]>(() => {
  const { undoStack, redoStack } = layoutStore.undoRedoStacks;
  const now = Date.now();
  const items: HistoryItem[] = [];

  for (let i = 0; i < redoStack.length; i++) {
    const entry = redoStack[i];
    const isNextRedo = i === redoStack.length - 1;
    items.push({
      snapshotId: entry.snapshotId,
      actionLabel: entry.actionLabel,
      relativeTime: formatRelativeSince(new Date(entry.timestamp), now),
      isRedo: true,
      isNextRedo,
      tooltip: `Redo until ${entry.actionLabel}`,
    });
  }

  for (let i = undoStack.length - 1; i >= 0; i--) {
    const entry = undoStack[i];
    items.push({
      snapshotId: entry.snapshotId,
      actionLabel: entry.actionLabel,
      relativeTime: formatRelativeSince(new Date(entry.timestamp), now),
      isRedo: false,
      isNextRedo: false,
      tooltip: `Undo until ${entry.actionLabel}`,
    });
  }

  return items;
});

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value;
};

const goTo = (snapshotId: number) => {
  layoutStore.undoRedoUntil(snapshotId);
  menuOpen.value = false;
};

const onClickOutside = (e: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
    menuOpen.value = false;
  }
};

watch(menuOpen, (open) => {
  if (open) {
    document.addEventListener("mousedown", onClickOutside);
  } else {
    document.removeEventListener("mousedown", onClickOutside);
  }
});

onMounted(() => {
  if (menuOpen.value) {
    document.addEventListener("mousedown", onClickOutside);
  }
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onClickOutside);
});
</script>

<style lang="scss" scoped>
.undo-redo-wrapper {
  position: fixed;
  top: calc(var(--viewport-warning-height, 0px) + var(--spacing-md));
  right: var(--spacing-md);
  z-index: calc(var(--z-topbar) + 1);
}

.undo-redo-bar {
  display: flex;
  align-items: center;
  gap: 0;
  border-radius: var(--radius-md);
  transition: background-color var(--duration-fast) var(--easing-smooth),
    border-color var(--duration-fast) var(--easing-smooth);
  padding: 4px 8px;
  border: var(--tile-border-width) solid transparent;

  &--hovered {
    background-color: var(--color-tile-background);
    border-color: var(--color-tile-stroke);
    backdrop-filter: blur(20px);
  }
}

.ur-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--color-content-default);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color var(--duration-fast) var(--easing-smooth);
  line-height: 1;

  &--active {
    color: var(--color-content-high);
  }

  &:hover {
    color: var(--color-content-high);
  }

  &:not(.ur-btn--active) {
    cursor: default;
    opacity: 0.5;
  }
}

.ur-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  margin-left: 2px;
  color: var(--color-content-default);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color var(--duration-fast) var(--easing-smooth);
  transition: transform 0.2s ease;
  line-height: 0;

  &--active {
    color: var(--color-content-high);
  }

  &--history-open {
    transition: transform 0.2s ease;
    transform: rotate(180deg);
  }
}

.ur-history {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 240px;
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-md);
  overflow: visible;

  &__scroll {
    max-height: 320px;
    overflow-y: auto;
    padding: 0;
  }
}

.ur-history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  position: relative;
  transition: color var(--duration-fast) var(--easing-smooth);
  color: var(--color-content-default);


  &__indicator {
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 2px;
    border-radius: 1px;
    background: transparent;
    transition: background-color var(--duration-fast) var(--easing-smooth);
  }

  &__label {
    flex: 1;
    font-size: 13px;
    font-weight: var(--font-weight-medium);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__time {
    font-size: 11px;
    color: var(--color-content-low);
    white-space: nowrap;
    flex-shrink: 0;
  }

  &:hover {
    color: var(--color-content-high);

    .ur-history-item__indicator {
      background: var(--color-figma-purple);
    }
  }

  &--highlighted {
    border: 1px solid var(--color-figma-purple);
    border-radius: 12px;
    margin: 0;
    padding: 8px 12px;
  }
}

.ur-history-tooltip {
  position: absolute;
  right: calc(100% + 6px);
  transform: translateY(-50%);
  white-space: nowrap;
  font-size: 11px;
  line-height: 1;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--color-text-primary);
  color: var(--color-tile-background);
  pointer-events: none;
  z-index: var(--z-tooltip);
}

.ur-history-empty {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--color-content-low);
  text-align: center;
}
</style>
