import { computed, proxyRefs, shallowRef, type ComputedRef } from "vue";
import type { AnyTileContent } from "@grids/contracts/types";
import { useGridViewContext } from "@/grid-context/useGridViewContext";

/**
 * A tile's content with refreshed data layered on top. Editors save the
 * refreshed data to the grid without an undo step; visitors can't write to
 * the grid, so for them it lives only in this view.
 */
export function useRefreshedTileContent<T extends AnyTileContent>(
  stored: () => T,
  tileId: string | null,
): {
  content: ComputedRef<T>;
  applyRefresh: (patch: Partial<T>) => void;
} {
  const gridView = proxyRefs(useGridViewContext());
  const refreshed = shallowRef<Partial<T>>({});
  const content = computed<T>(() => ({ ...stored(), ...refreshed.value }));

  const applyRefresh = (patch: Partial<T>) => {
    if (gridView.canEdit && tileId) {
      gridView.patchTileContentSilently(tileId, patch);
    } else {
      refreshed.value = { ...refreshed.value, ...patch };
    }
  };

  return { content, applyRefresh };
}
