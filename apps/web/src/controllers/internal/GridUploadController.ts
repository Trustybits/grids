import {
  ContentType,
  type DocumentsContent,
} from "@grids/contracts/types";
import type { GridUploadRecord } from "@/stores/grid/gridUploads";
import type { StartUploadInput } from "../GridCommands";
import type { GridControllerStores } from "../GridControllerTypes";

export class GridUploadController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly scheduleSave: () => void,
  ) {}

  startUpload(input: StartUploadInput): string | null {
    const scope = this.stores.session.getPersistenceScope();
    if (!scope || !this.uploadTargetExists(input.tileId, input.itemId)) {
      return null;
    }

    return this.stores.uploads.startUpload({
      uploadId: input.uploadId,
      gridId: scope.gridId,
      sessionGeneration: scope.sessionGeneration,
      tileId: input.tileId,
      documentItemId: input.itemId,
      progress: input.progress,
      ownedObjectUrl: input.ownedObjectUrl,
      task: input.task,
    });
  }

  progressUpload(uploadId: string, progress: number): boolean {
    if (!this.validateUpload(uploadId)) {
      this.stores.uploads.abandonUpload(uploadId);
      return false;
    }
    return this.stores.uploads.progressUpload(uploadId, progress);
  }

  resolveUpload(
    uploadId: string,
    url: string,
    hash?: string,
    final = true,
  ): boolean {
    const record = this.validateUpload(uploadId);
    if (!record) {
      this.stores.uploads.abandonUpload(uploadId);
      return false;
    }

    const resolved = this.stores.uploads.resolveUpload(
      uploadId,
      url,
      hash,
      final,
    );
    if (!resolved) return false;

    if (record.documentItemId) {
      this.stores.history.replaceBlobUrl(
        record.tileId,
        url,
        record.documentItemId,
      );
    } else {
      this.stores.history.replaceBlobUrl(record.tileId, url);
    }
    this.scheduleSave();
    return true;
  }

  failUpload(uploadId: string): boolean {
    return this.failUploadForCleanup(uploadId) !== null;
  }

  failUploadForCleanup(uploadId: string): GridUploadRecord | null {
    const record = this.validateUpload(uploadId);
    if (!record) {
      this.stores.uploads.abandonUpload(uploadId);
      return null;
    }
    if (!this.stores.uploads.failUpload(uploadId)) return null;
    return record;
  }

  abandonUpload(uploadId: string): boolean {
    return this.stores.uploads.abandonUpload(uploadId);
  }

  cancelUpload(uploadId: string): boolean {
    return this.stores.uploads.cancelUpload(uploadId);
  }

  revokeOwnedObjectUrl(url: string | undefined): boolean {
    return this.stores.uploads.revokeOwnedObjectUrl(url);
  }

  setTileUploading(tileId: string, progress: number): void {
    this.stores.uploads.setTileUploading(tileId, progress);
  }

  clearTileUploading(tileId: string): void {
    this.stores.uploads.clearTileUploading(tileId);
  }

  setResolvedUrl(tileId: string, url: string): void {
    this.stores.uploads.setResolvedUrl(tileId, url);
    this.stores.history.replaceBlobUrl(tileId, url);
  }

  setResolvedDocumentItemUrl(
    tileId: string,
    itemId: string,
    url: string,
  ): void {
    this.stores.uploads.setResolvedDocumentItemUrl(
      tileId,
      itemId,
      url,
    );
    this.stores.history.replaceBlobUrl(tileId, url, itemId);
  }

  getResolvedUrl(tileId: string): string | undefined {
    return this.stores.uploads.getResolvedUrl(tileId);
  }

  clearResolvedUrl(tileId: string): void {
    this.stores.uploads.clearResolvedUrl(tileId);
  }

  clearResolvedDocumentItemsForTile(tileId: string): void {
    this.stores.uploads.clearResolvedDocumentItemsForTile(tileId);
  }

  private validateUpload(uploadId: string): GridUploadRecord | null {
    const record = this.stores.uploads.uploadRecords[uploadId];
    if (!record || record.status !== "active") return null;
    if (!this.stores.uploads.isCurrentUpload(uploadId)) return null;
    if (
      !this.stores.session.matchesPersistenceScope({
        gridId: record.gridId,
        sessionGeneration: record.sessionGeneration,
      })
    ) {
      return null;
    }
    if (!this.uploadTargetExists(record.tileId, record.documentItemId)) {
      return null;
    }
    return record;
  }

  private uploadTargetExists(
    tileId: string,
    documentItemId?: string,
  ): boolean {
    const tile = this.stores.session.currentGrid?.tiles.find(
      (candidate) => candidate.i === tileId,
    );
    if (!tile) return false;
    if (!documentItemId) return true;
    if (tile.content.type !== ContentType.DOCUMENT) return false;
    return Boolean(
      (tile.content as DocumentsContent).items?.some(
        (item) => item.id === documentItemId,
      ),
    );
  }
}
