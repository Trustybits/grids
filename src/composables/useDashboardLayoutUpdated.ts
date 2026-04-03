import { computed, toValue, type MaybeRefOrGetter } from "vue";
import type { Layout } from "@/types/Layout";
import { firestoreValueToDate } from "@/utils/firestoreTime";
import { formatRelativeSince } from "@/utils/relativeTime";

type LayoutTimestamps = Pick<Layout, "updatedAt" | "createdAt">;

/**
 * Label + tooltip for when a grid was last persisted (updatedAt, else createdAt).
 */
export function useDashboardLayoutUpdated(
  layoutSource: MaybeRefOrGetter<LayoutTimestamps>,
) {
  const updatedAtDate = computed(() => {
    const layout = toValue(layoutSource);
    return (
      firestoreValueToDate(layout.updatedAt) ||
      firestoreValueToDate(layout.createdAt)
    );
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
