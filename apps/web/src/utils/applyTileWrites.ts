import type { GridViewContext } from "@/grid-context/GridViewContext";
import type { TileWrite } from "@/registries/tileToolbar/mobileTools";

/** The slice of the grid view a write needs. */
export type TileWriteTarget = Pick<
  GridViewContext,
  | "beginHistoryBatch"
  | "commitHistoryBatch"
  | "patchTileContent"
  | "setTileBorder"
  | "updateCaption"
>;

export interface PlannedTileWrite {
  tileId: string;
  write: TileWrite;
}

/**
 * Apply tool writes to one or many tiles as a single undo step.
 *
 * Opens a history batch unless one is already open (a popover visit opens its
 * own and commits on close), so a bulk change — every selected tile's fill,
 * say — undoes in one go. Only the opener commits.
 */
export function applyTileWrites(
  target: TileWriteTarget,
  writes: readonly PlannedTileWrite[],
  actionLabel: string,
): void {
  if (writes.length === 0) return;
  const opened = target.beginHistoryBatch(actionLabel);
  try {
    for (const { tileId, write } of writes) {
      if (write.content) target.patchTileContent(tileId, write.content);
      if (write.borderEnabled !== undefined) {
        target.setTileBorder(tileId, write.borderEnabled);
      }
      if (write.caption !== undefined) {
        target.updateCaption({ tileId, caption: write.caption });
      }
    }
  } finally {
    if (opened) target.commitHistoryBatch();
  }
}
