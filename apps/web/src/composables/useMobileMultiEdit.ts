/**
 * Multi-edit on the phone toolbar (plan S7): the picked tiles, the tools they
 * all share that are safe to apply to every one of them, and the bulk Delete
 * and Duplicate — each a single undo step.
 *
 * Bulk changes go straight to the tile data (through the grid view), never
 * through each tile's live component, so they reach tiles that aren't
 * mounted or selected.
 */

import { computed, proxyRefs } from "vue";
import type { Tile } from "@grids/contracts/types";
import { getSharedMobileTools } from "@/registries/tileToolbar/mobileTools";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useToastStore } from "@/stores/toast";
import { useGridController } from "@/controllers/useGridController";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useMobileExperience } from "@/composables/useMobileExperience";
import { getGridEngineBridge } from "@/composables/useGridEngineBridge";

const DELETE_LABEL = "Delete tiles";
const DUPLICATE_LABEL = "Duplicate tiles";

const plural = (count: number) => (count === 1 ? "tile" : "tiles");

export function useMobileMultiEdit() {
  const ui = useGridUiStore();
  const session = useGridSessionStore();
  const history = useGridHistoryStore();
  const toastStore = useToastStore();
  const controller = useGridController();
  const gridView = proxyRefs(useGridViewContext());
  const { isUnifiedText } = useMobileExperience();

  const ids = computed(() => ui.mobileMultiSelectIds);
  const active = computed(() => ids.value !== null);

  /** The picked tiles, in the order they were picked. */
  const tiles = computed<Tile[]>(() => {
    const picked = ids.value;
    const all = session.currentGrid?.tiles ?? [];
    if (!picked) return [];
    return picked
      .map((id) => all.find((tile) => tile.i === id))
      .filter((tile): tile is Tile => !!tile);
  });

  /** Tools every picked tile has that are safe to apply to all of them. */
  const tools = computed(() =>
    getSharedMobileTools(
      tiles.value.map((tile) => ({ tile, unifiedText: isUnifiedText.value })),
    ),
  );

  const enter = () => controller.enterMobileMultiSelect();
  const toggle = (tileId: string) => controller.toggleMobileMultiSelectTile(tileId);
  const exit = () => controller.clearMobileEditor();

  /** Run `change` as one undo step labelled `label`. */
  const asOneStep = (label: string, change: () => void) => {
    const opened = gridView.beginHistoryBatch(label);
    try {
      change();
    } finally {
      if (opened) gridView.commitHistoryBatch();
    }
  };

  /** Delete every picked tile (one undo), then leave multi-edit. */
  const removeAll = () => {
    const picked = tiles.value.map((tile) => tile.i);
    if (picked.length === 0) return;
    asOneStep(DELETE_LABEL, () => {
      const bridge = getGridEngineBridge();
      if (bridge) bridge.removeTiles(picked);
      else for (const id of picked) gridView.removeTile(id);
    });
    exit();
    toastStore.addToast(
      `${picked.length} ${plural(picked.length)} deleted`,
      "info",
      5000,
      {
        label: "Undo",
        run: () => {
          if (history.undoActionLabel === DELETE_LABEL) void controller.undo();
        },
      },
    );
  };

  /** Copy every picked tile (one undo); the picks stay on the originals. */
  const duplicateAll = () => {
    const picked = tiles.value.map((tile) => tile.i);
    if (picked.length === 0) return;
    let copies = 0;
    asOneStep(DUPLICATE_LABEL, () => {
      for (const id of picked) if (gridView.duplicateTile(id)) copies += 1;
    });
    if (copies > 0) {
      toastStore.addToast(`${copies} ${plural(copies)} duplicated`, "success");
    }
  };

  return { ids, active, tiles, tools, enter, toggle, exit, removeAll, duplicateAll };
}
