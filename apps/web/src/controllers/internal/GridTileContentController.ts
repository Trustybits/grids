import {
  ContentType,
  type AnyTileContent,
  type DocumentItem,
  type DocumentsContent,
  type TileContent,
} from "@grids/contracts/types";
import { adjustTilePosition } from "@/utils/GridPlacementUtils";
import { hasRecordChanges } from "../GridControllerHelpers";
import type { GridControllerStores } from "../GridControllerTypes";

export class GridTileContentController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly pushUndoSnapshot: (actionLabel: string) => void,
    private readonly scheduleSave: () => void,
  ) {}

  setTileContent(id: string, content: TileContent): void {
    const grid = this.stores.session.currentGrid;
    const tile = grid?.tiles.find((candidate) => candidate.i === id);
    if (!grid || !tile) return;

    this.pushUndoSnapshot("Change tile content");
    tile.content = content;
    if (content.type === ContentType.PROFILE) {
      tile.w = 4;
      tile.h = 4;
      adjustTilePosition(tile, grid.colNum);
    }
    this.scheduleSave();
  }

  patchTileContent(
    id: string,
    patch: Partial<AnyTileContent>,
  ): void {
    const grid = this.stores.session.currentGrid;
    const tile = grid?.tiles.find((candidate) => candidate.i === id);
    if (!tile) return;

    const currentContent = tile.content as AnyTileContent &
      Record<string, unknown>;
    const patchRecord = patch as Record<string, unknown>;
    if (!hasRecordChanges(currentContent, patchRecord)) return;

    const editing = this.stores.history.isEditing(id);
    if (!editing) {
      this.pushUndoSnapshot("Update tile");
    }
    tile.content = {
      ...currentContent,
      ...patchRecord,
    } as TileContent;
    // During an active edit transaction the final save is scheduled once by
    // commitEditing(); intermediate patches must not schedule.
    if (!editing) {
      this.scheduleSave();
    }
  }

  autosaveTileContent(
    id: string,
    patch: Partial<AnyTileContent>,
  ): void {
    if (!this.stores.history.isEditing(id)) {
      this.patchTileContent(id, patch);
      return;
    }

    const tile = this.stores.session.currentGrid?.tiles.find(
      (candidate) => candidate.i === id,
    );
    if (!tile) return;

    const currentContent = tile.content as AnyTileContent &
      Record<string, unknown>;
    const patchRecord = patch as Record<string, unknown>;
    if (!hasRecordChanges(currentContent, patchRecord)) return;

    tile.content = {
      ...currentContent,
      ...patchRecord,
    } as TileContent;
    this.scheduleSave();
  }

  patchDocumentItem(
    tileId: string,
    itemId: string,
    itemPatch: Partial<DocumentItem>,
  ): void {
    const tile = this.stores.session.currentGrid?.tiles.find(
      (candidate) => candidate.i === tileId,
    );
    if (!tile || tile.content.type !== ContentType.DOCUMENT) return;

    const editing = this.stores.history.isEditing(tileId);
    if (!editing) {
      this.pushUndoSnapshot("Update document");
    }
    const document = tile.content as DocumentsContent;
    tile.content = {
      ...document,
      items: document.items.map((item) =>
        item.id === itemId ? { ...item, ...itemPatch } : item,
      ),
    } as TileContent;
    // Intermediate document patches inside an edit transaction defer their
    // save to commitEditing().
    if (!editing) {
      this.scheduleSave();
    }
  }
}
