/**
 * Duplicate and delete as the phone editor does them — one implementation for
 * the toolbar and the hold menu, so both behave identically:
 *
 *  - Duplicate selects the copy (you usually duplicate to change the copy)
 *    and scrolls it into view: Griddle only renders tiles near the viewport,
 *    so a copy below the fold doesn't exist until it is brought into view.
 *  - Delete plays the tile's exit animation when its handle is live, else
 *    goes straight through the engine, then offers Undo — but only while that
 *    delete is still the latest step.
 */

import { proxyRefs } from "vue";
import type { Tile } from "@grids/contracts/types";
import { useGridController } from "@/controllers/useGridController";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useToastStore } from "@/stores/toast";
import { useMobileTileEdit } from "@/composables/useMobileTileEdit";
import { getGridEngineBridge } from "@/composables/useGridEngineBridge";

export function useMobileTileCommands() {
  const controller = useGridController();
  const gridView = proxyRefs(useGridViewContext());
  const history = useGridHistoryStore();
  const toastStore = useToastStore();
  const { handle } = useMobileTileEdit();

  const duplicate = async (tile: Tile): Promise<string | null> => {
    const newId = gridView.duplicateTile(tile.i);
    if (!newId) return null;
    controller.setMobileEditTile(newId);
    toastStore.addToast("Tile duplicated", "success");
    // Selecting the copy brings it into view (useKeepEditedTileInView).
    return newId;
  };

  const remove = (tile: Tile): void => {
    const handleRemove = handle.value?.remove;
    if (handleRemove) handleRemove();
    else getGridEngineBridge()?.removeTiles([tile.i]);
    toastStore.addToast("Tile deleted", "info", 5000, {
      label: "Undo",
      run: () => {
        if (history.undoActionLabel === "Remove tile") void controller.undo();
      },
    });
  };

  return { duplicate, remove };
}
