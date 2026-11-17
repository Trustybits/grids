/**
 * One popover visit on the phone toolbar: what the open tool edits, and how its
 * changes land in undo.
 *
 * The popover shell provides it; each tool body injects it. Bodies read and
 * write through the tool's pure writers (`mobileTools.WRITERS`) over a list of
 * tiles — one tile for a selected tile, several in multi-edit — so the same
 * body serves both.
 *
 * Undo: the first change of a visit opens a history batch and the visit's end
 * (Done, another tool, deselect, unmount) commits it, so dragging through
 * twenty colours is one step. The batch is opened lazily, not on open: a visit
 * that changes nothing leaves no trace, and if Undo commits the batch mid-visit
 * the next change simply opens a new one.
 */

import {
  computed,
  inject,
  onBeforeUnmount,
  proxyRefs,
  provide,
  type ComputedRef,
  type InjectionKey,
} from "vue";
import type { Tile } from "@grids/contracts/types";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import {
  readAcrossTiles,
  type ToolWriter,
} from "@/registries/tileToolbar/mobileTools";
import { applyTileWrites } from "@/utils/applyTileWrites";
import type { Mixed } from "@/utils/richText/docTransforms";

export interface ToolPopoverVisit {
  /** The tiles this visit edits, read live from the grid. */
  tiles: ComputedRef<Tile[]>;
  /** The value across the tiles, or "mixed". */
  read<V>(writer: ToolWriter<V>): V | Mixed;
  /** Set `value` on every tile it changes. */
  write<V>(writer: ToolWriter<V>, value: V): void;
  /** Close the visit's undo step now (the popover stays open). */
  commit(): void;
}

const VISIT_KEY: InjectionKey<ToolPopoverVisit> = Symbol("toolPopoverVisit");

export function provideToolPopoverVisit(
  tiles: () => Tile[],
  label: () => string,
): ToolPopoverVisit {
  const gridView = proxyRefs(useGridViewContext());
  const history = useGridHistoryStore();
  let opened = false;

  const tileList = computed(tiles);

  const commit = () => {
    if (!opened) return;
    opened = false;
    // Undo/redo already closed it.
    if (history.isBatching) gridView.commitHistoryBatch();
  };

  const visit: ToolPopoverVisit = {
    tiles: tileList,
    read: (writer) => readAcrossTiles(writer, tileList.value),
    write: (writer, value) => {
      const writes = tileList.value.flatMap((tile) => {
        const write = writer.patch(tile, value);
        return write ? [{ tileId: tile.i, write }] : [];
      });
      if (writes.length === 0) return;
      if (!history.isBatching) opened = gridView.beginHistoryBatch(label());
      applyTileWrites(gridView, writes, label());
    },
    commit,
  };

  provide(VISIT_KEY, visit);
  onBeforeUnmount(commit);
  return visit;
}

export function useToolPopoverVisit(): ToolPopoverVisit {
  const visit = inject(VISIT_KEY, null);
  if (!visit) {
    throw new Error("useToolPopoverVisit() needs a MobileToolPopover above it");
  }
  return visit;
}
