import type { AnyTileContent, DocumentItem } from "@grids/contracts/types";
import type { StorageUploadTask } from "@grids/contracts/dao";

/**
 * Typed command inputs for discrete grid mutations.
 *
 * These describe the controller's semantic command surface. They live next to
 * the controller (not in `@grids/contracts`) because they are app-orchestration
 * concerns, not persisted contracts.
 */

export interface PatchTileContentInput {
  tileId: string;
  patch: Partial<AnyTileContent>;
}

export interface PatchDocumentItemInput {
  tileId: string;
  itemId: string;
  patch: Partial<DocumentItem>;
}

export interface UpdateCaptionInput {
  tileId: string;
  caption: string;
}

export interface ResizeTileInput {
  tileId: string;
  width: number;
  height: number;
}


export interface StartUploadInput {
  uploadId?: string;
  tileId: string;
  itemId?: string;
  progress?: number;
  ownedObjectUrl?: string;
  task?: StorageUploadTask;
}
