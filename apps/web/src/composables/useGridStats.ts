import { computed, ref, watch } from "vue";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { formatDuration } from "@/utils/RelativeTime";
import type { GridStats, DailyGridStats } from "@grids/contracts/types";

/**
 * Loads the current grid's view analytics (lifetime aggregate + yesterday's
 * daily snapshot) and exposes them as display-ready computeds. Shared by the
 * desktop grid-stats bar (`GridStats.vue`) and the Mobile 2.0 menu drawer's
 * inline Analytics section so both read from one loading path.
 *
 * Stats reload whenever the active grid changes; a stale in-flight response for
 * a previous grid is discarded.
 */
export function useGridStats() {
  const sessionStore = useGridSessionStore();

  const aggregate = ref<GridStats | null>(null);
  const yesterday = ref<DailyGridStats | null>(null);

  const gridId = computed(() => sessionStore.currentGrid?.id ?? null);

  const lifetimeViews = computed(() => aggregate.value?.totalViews ?? 0);
  const uniqueViewers = computed(() => aggregate.value?.uniqueViewers ?? 0);
  const yesterdayViews = computed(() => yesterday.value?.totalViews ?? 0);
  const averageTimeSpent = computed(() =>
    formatDuration(aggregate.value?.averageTimeSpentMs ?? 0),
  );

  function utcDateString(daysAgo: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  }

  async function loadStats(id: string): Promise<void> {
    const svc = getServiceFactory().getAnalyticsService();
    if (!svc) return;
    const date = utcDateString(1);
    try {
      const [agg, yest] = await Promise.all([
        svc.getGridStats(id),
        svc.getGridStatsForDate(id, date),
      ]);
      // Discard a response that resolved after the active grid changed.
      if (gridId.value !== id) return;
      aggregate.value = agg;
      yesterday.value = yest;
    } catch (err) {
      console.error("Failed to load grid stats:", err);
    }
  }

  watch(
    gridId,
    (id) => {
      aggregate.value = null;
      yesterday.value = null;
      if (id) void loadStats(id);
    },
    { immediate: true },
  );

  return {
    gridId,
    aggregate,
    yesterday,
    lifetimeViews,
    uniqueViewers,
    yesterdayViews,
    averageTimeSpent,
  };
}
