import { computed, toValue, type MaybeRefOrGetter } from "vue";
import type { Grid } from "@/types/Grid";
import { valueToDate } from "@/utils/TimeConversion";
import { formatRelativeSince } from "@/utils/RelativeTime";

type GridTimestamps = Pick<Grid, "updatedAt" | "createdAt">;

/**
 * Label + tooltip for when a grid was last persisted (updatedAt, else createdAt).
 */
export function useDashboardGridUpdated(
  gridSource: MaybeRefOrGetter<GridTimestamps>,
) {
  const updatedAtDate = computed(() => {
    const grid = toValue(gridSource);
    return valueToDate(grid.updatedAt) || valueToDate(grid.createdAt);
  });

  const label = computed(() => {
    const d = updatedAtDate.value;
    if (!d) return "—";
    return formatRelativeSince(d);
  });

  const title = computed(() => {
    const d = updatedAtDate.value;
    if (!d) return "";
    return `Last updated ${d.toLocaleString()}`;
  });

  return { updatedAtDate, label, title };
}
