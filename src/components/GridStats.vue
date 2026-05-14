<template>
  <div
    v-if="layoutStore.isOwner && layoutId"
    class="grid-stats-wrapper"
    ref="wrapperRef"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <div
      class="grid-stats-bar"
      :class="{ 'grid-stats-bar--hovered': hovered || menuOpen }"
    >
      <span class="gs-views">
        <span class="gs-num" data-tooltip="Views yesterday">{{
          yesterdayViews
        }}</span>
        <span class="gs-slash">/</span>
        <span class="gs-num" data-tooltip="Total views">{{
          lifetimeViews
        }}</span>
        <span class="gs-label">views</span>
      </span>
      <button
        :style="{ opacity: hovered || menuOpen ? 1 : 0 }"
        class="gs-chevron"
        :class="{ 'gs-chevron--open': menuOpen }"
        @click.stop="toggleMenu"
      >
        <Chevron :size="14" />
      </button>
    </div>

    <div v-if="menuOpen" class="gs-panel">
      <div class="gs-row">
        <span class="gs-row__label">Views yesterday</span>
        <span class="gs-row__value">{{ yesterdayViews }}</span>
      </div>
      <div class="gs-row">
        <span class="gs-row__label">Total views</span>
        <span class="gs-row__value">{{ lifetimeViews }}</span>
      </div>
      <div class="gs-row">
        <span class="gs-row__label">Unique views</span>
        <span class="gs-row__value">{{ uniqueViews }}</span>
      </div>
      <div class="gs-row">
        <span class="gs-row__label">Average time spent</span>
        <span class="gs-row__value">{{ averageTimeSpent }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { useLayoutStore } from "@/stores/layout";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import type { GridStats, DailyGridStats } from "@/types/Analytics";
import Chevron from "@/components/icons/Chevron.vue";

const layoutStore = useLayoutStore();

const wrapperRef = ref<HTMLElement | null>(null);
const hovered = ref(false);
const menuOpen = ref(false);

const aggregate = ref<GridStats | null>(null);
const yesterday = ref<DailyGridStats | null>(null);

const layoutId = computed(() => layoutStore.currentLayout?.id ?? null);

const lifetimeViews = computed(() => aggregate.value?.totalViews ?? 0);
const uniqueViews = computed(() => aggregate.value?.uniqueViewers ?? 0);
const yesterdayViews = computed(() => yesterday.value?.totalViews ?? 0);

const averageTimeSpent = computed(() => {
  const ms = aggregate.value?.averageTimeSpentMs ?? 0;
  if (ms <= 0) return "0s";
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${minutes >= 10 ? Math.round(minutes) : minutes.toFixed(1)}m`;
  }
  const hours = minutes / 60;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)}h`;
});

function utcDateString(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function loadStats(id: string) {
  const svc = getServiceFactory().getAnalyticsService();
  if (!svc) return;
  const date = utcDateString(1);
  try {
    const [agg, yest] = await Promise.all([
      svc.getGridStats(id),
      svc.getGridStatsForDate(id, date),
    ]);
    if (layoutId.value !== id) return;
    aggregate.value = agg;
    yesterday.value = yest;
  } catch (err) {
    console.error("Failed to load grid stats:", err);
  }
}

watch(
  layoutId,
  (id) => {
    aggregate.value = null;
    yesterday.value = null;
    if (id) void loadStats(id);
  },
  { immediate: true },
);

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value;
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

onUnmounted(() => {
  document.removeEventListener("mousedown", onClickOutside);
});
</script>

<style lang="scss" scoped>
.grid-stats-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.grid-stats-bar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  border: var(--tile-border-width) solid transparent;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    border-color var(--duration-fast) var(--easing-smooth);

  &--hovered {
    background-color: var(--bg-surface-color, var(--color-tile-background));
    border-color: var(--color-tile-stroke);
    backdrop-filter: blur(20px);
  }
}

.gs-views {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--bg-contrast-color, var(--color-content-default));
  line-height: 1;
}

.gs-num {
  cursor: default;
}

.gs-slash {
  opacity: 0.6;
}

.gs-label {
  margin-left: 2px;
}

.gs-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  margin-left: 2px;
  color: var(--bg-contrast-color, var(--color-content-default));
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: transform 0.2s ease;
  line-height: 0;

  &--open {
    transform: rotate(180deg);
  }
}

.gs-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 220px;
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-md);
  padding: 4px 0;
  z-index: calc(var(--z-topbar) + 2);
}

.gs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--color-content-default);

  &__label {
    font-weight: var(--font-weight-medium);
  }

  &__value {
    color: var(--color-content-high);
    font-variant-numeric: tabular-nums;
  }
}
</style>
