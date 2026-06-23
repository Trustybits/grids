import type { AnyTileContent } from "@grids/contracts/types";
import { useGridStore } from "@/stores/grid";

/**
 * Provides the two canonical content-write paths shared by editor-backed tile
 * content components (text, smart text, link, profile bio):
 *
 * - `patchContent` — a discrete edit. Captures history (outside an edit
 *   transaction) and schedules a save through the controller command path.
 * - `autosaveContent` — a debounced editor autosave. While an edit transaction
 *   is active it persists paused text mid-edit without adding a history entry.
 *
 * Both fall back to mutating the local content object directly when the tile is
 * rendered without a `tileId` (e.g. isolated previews), where there is no
 * canonical grid to persist to. `getContent` is read lazily so the fallback
 * always targets the component's current `content` prop.
 */
export function useTileContentWriter<T extends AnyTileContent>(
  tileId: string | null,
  getContent: () => T,
) {
  const gridStore = useGridStore();

  const write = (
    patch: Partial<T>,
    persist: (id: string, patch: Partial<AnyTileContent>) => void,
  ) => {
    if (tileId) {
      persist(tileId, patch as Partial<AnyTileContent>);
      return;
    }
    Object.assign(getContent(), patch);
  };

  const patchContent = (patch: Partial<T>) =>
    write(patch, gridStore.patchTileContent);

  const autosaveContent = (patch: Partial<T>) =>
    write(patch, gridStore.autosaveTileContent);

  return { patchContent, autosaveContent };
}
