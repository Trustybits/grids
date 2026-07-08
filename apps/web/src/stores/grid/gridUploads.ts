import { defineStore } from "pinia";
import { markRaw } from "vue";

/** Minimal handle the store needs to cancel an in-flight upload. */
export interface CancelableUploadTask {
  cancel(): void;
}

export type GridUploadStatus =
  | "active"
  | "resolved"
  | "failed"
  | "abandoned"
  | "cancelled";

export interface GridUploadRecord {
  uploadId: string;
  gridId: string;
  sessionGeneration: number;
  tileId: string;
  documentItemId?: string;
  progress: number;
  ownedObjectUrl?: string;
  resolvedUrl?: string;
  resolvedHash?: string;
  status: GridUploadStatus;
  generation: number;
  task?: CancelableUploadTask;
}

export interface StartGridUploadInput {
  uploadId?: string;
  gridId: string;
  sessionGeneration: number;
  tileId: string;
  documentItemId?: string;
  progress?: number;
  ownedObjectUrl?: string;
  task?: CancelableUploadTask;
}

const isBlobUrl = (url: string | undefined): url is string =>
  typeof url === "string" && url.startsWith("blob:");

const targetKey = (tileId: string, documentItemId?: string) =>
  documentItemId ? `${tileId}::${documentItemId}` : tileId;

const isActive = (record: GridUploadRecord) =>
  record.status === "active";

const hasOtherActiveTileUpload = (
  records: Record<string, GridUploadRecord>,
  tileId: string,
  uploadId: string,
) =>
  Object.values(records).some(
    (record) =>
      record.uploadId !== uploadId &&
      record.tileId === tileId &&
      isActive(record),
  );

export const useGridUploadsStore = defineStore("gridUploads", {
  state: () => ({
    uploadRecords: {} as Record<string, GridUploadRecord>,
    uploadGenerations: {} as Record<string, number>,
    revokedObjectUrls: {} as Record<string, true>,
    nextUploadOrdinal: 0,
    uploadingTiles: {} as Record<string, number>,
    resolvedUrls: {} as Record<string, string>,
    resolvedDocumentItemUrls: {} as Record<
      string,
      Record<string, string>
    >,
    resolvedHashes: {} as Record<string, string>,
    resolvedDocumentItemHashes: {} as Record<
      string,
      Record<string, string>
    >,
  }),

  actions: {
    startUpload(input: StartGridUploadInput): string {
      const key = targetKey(input.tileId, input.documentItemId);
      const generation = (this.uploadGenerations[key] ?? 0) + 1;
      this.uploadGenerations[key] = generation;

      for (const record of Object.values(this.uploadRecords)) {
        if (
          record.tileId === input.tileId &&
          record.documentItemId === input.documentItemId &&
          isActive(record)
        ) {
          this.abandonUpload(record.uploadId);
        }
      }

      const uploadId =
        input.uploadId ?? `upload-${++this.nextUploadOrdinal}`;
      const progress = input.progress ?? 0;
      this.uploadRecords[uploadId] = {
        uploadId,
        gridId: input.gridId,
        sessionGeneration: input.sessionGeneration,
        tileId: input.tileId,
        documentItemId: input.documentItemId,
        progress,
        ownedObjectUrl: input.ownedObjectUrl,
        status: "active",
        generation,
        task: input.task ? markRaw(input.task) : undefined,
      };
      this.uploadingTiles[input.tileId] = progress;
      return uploadId;
    },

    progressUpload(uploadId: string, progress: number): boolean {
      const record = this.uploadRecords[uploadId];
      if (!record || !isActive(record)) return false;

      record.progress = progress;
      this.uploadingTiles[record.tileId] = progress;
      return true;
    },

    isCurrentUpload(uploadId: string): boolean {
      const record = this.uploadRecords[uploadId];
      if (!record || !isActive(record)) return false;

      return (
        this.uploadGenerations[
          targetKey(record.tileId, record.documentItemId)
        ] === record.generation
      );
    },

    resolveUpload(
      uploadId: string,
      url: string,
      hash?: string,
      final = true,
    ): boolean {
      const record = this.uploadRecords[uploadId];
      if (!record || !isActive(record)) return false;

      record.status = "resolved";
      record.resolvedUrl = url;
      record.resolvedHash = hash;
      if (record.documentItemId) {
        this.setResolvedDocumentItemUrl(
          record.tileId,
          record.documentItemId,
          url,
        );
        if (hash) {
          this.setResolvedDocumentItemHash(
            record.tileId,
            record.documentItemId,
            hash,
          );
        }
      } else {
        this.setResolvedUrl(record.tileId, url);
        if (hash) {
          this.setResolvedHash(record.tileId, hash);
        }
      }
      if (final) {
        this.clearTileUploading(record.tileId);
      }
      return true;
    },

    failUpload(uploadId: string): boolean {
      const record = this.uploadRecords[uploadId];
      if (!record || record.status !== "active") return false;

      record.status = "failed";
      this.revokeOwnedObjectUrl(record.ownedObjectUrl);
      if (
        !hasOtherActiveTileUpload(
          this.uploadRecords,
          record.tileId,
          uploadId,
        )
      ) {
        this.clearTileUploading(record.tileId);
      }
      return true;
    },

    abandonUpload(uploadId: string): boolean {
      const record = this.uploadRecords[uploadId];
      if (!record || record.status !== "active") return false;

      record.status = "abandoned";
      this.revokeOwnedObjectUrl(record.ownedObjectUrl);
      if (
        !hasOtherActiveTileUpload(
          this.uploadRecords,
          record.tileId,
          uploadId,
        )
      ) {
        this.clearTileUploading(record.tileId);
      }
      return true;
    },

    cancelUpload(uploadId: string): boolean {
      const record = this.uploadRecords[uploadId];
      if (!record || record.status !== "active") return false;

      try {
        record.task?.cancel();
      } catch {
        // Cancellation is best-effort; late callbacks are rejected by identity.
      }
      record.status = "cancelled";
      this.revokeOwnedObjectUrl(record.ownedObjectUrl);
      if (
        !hasOtherActiveTileUpload(
          this.uploadRecords,
          record.tileId,
          uploadId,
        )
      ) {
        this.clearTileUploading(record.tileId);
      }
      return true;
    },

    revokeOwnedObjectUrl(url: string | undefined): boolean {
      if (!isBlobUrl(url) || this.revokedObjectUrls[url]) {
        return false;
      }
      this.revokedObjectUrls[url] = true;
      URL.revokeObjectURL(url);
      return true;
    },

    setTileUploading(tileId: string, progress: number) {
      this.uploadingTiles[tileId] = progress;
    },

    clearTileUploading(tileId: string) {
      delete this.uploadingTiles[tileId];
    },

    setResolvedUrl(tileId: string, url: string) {
      this.resolvedUrls[tileId] = url;
    },

    getResolvedUrl(tileId: string): string | undefined {
      return this.resolvedUrls[tileId];
    },

    clearResolvedUrl(tileId: string) {
      delete this.resolvedUrls[tileId];
      delete this.resolvedHashes[tileId];
    },

    setResolvedHash(tileId: string, hash: string) {
      this.resolvedHashes[tileId] = hash;
    },

    getResolvedHash(tileId: string): string | undefined {
      return this.resolvedHashes[tileId];
    },

    setResolvedDocumentItemUrl(
      tileId: string,
      itemId: string,
      url: string,
    ) {
      this.resolvedDocumentItemUrls[tileId] ??= {};
      this.resolvedDocumentItemUrls[tileId][itemId] = url;
    },

    setResolvedDocumentItemHash(
      tileId: string,
      itemId: string,
      hash: string,
    ) {
      this.resolvedDocumentItemHashes[tileId] ??= {};
      this.resolvedDocumentItemHashes[tileId][itemId] = hash;
    },

    clearResolvedDocumentItemsForTile(tileId: string) {
      delete this.resolvedDocumentItemUrls[tileId];
      delete this.resolvedDocumentItemHashes[tileId];
    },

    /**
     * Reassign an upload record (and any resolved URL/hash, generation, and
     * progress it owns) from its current tile to a surviving tile that still
     * displays the same blob URL. Used when the tile that started an upload is
     * removed while a duplicate sharing its blob URL remains: keeps the upload
     * alive (validation requires the owning tile to exist) and preserves the
     * resolved URL under a tile that will actually be persisted.
     */
    reassignUploadOwner(
      uploadId: string,
      record: GridUploadRecord,
      newTileId: string,
    ) {
      const oldKey = targetKey(record.tileId, record.documentItemId);
      const newKey = targetKey(newTileId, record.documentItemId);
      const generation = this.uploadGenerations[oldKey];
      if (generation !== undefined) {
        this.uploadGenerations[newKey] = generation;
        delete this.uploadGenerations[oldKey];
      }

      const progress = this.uploadingTiles[record.tileId];

      if (record.documentItemId) {
        const url =
          this.resolvedDocumentItemUrls[record.tileId]?.[
            record.documentItemId
          ];
        if (url) {
          this.setResolvedDocumentItemUrl(
            newTileId,
            record.documentItemId,
            url,
          );
        }
        const hash =
          this.resolvedDocumentItemHashes[record.tileId]?.[
            record.documentItemId
          ];
        if (hash) {
          this.setResolvedDocumentItemHash(
            newTileId,
            record.documentItemId,
            hash,
          );
        }
      } else {
        const url = this.resolvedUrls[record.tileId];
        if (url) this.setResolvedUrl(newTileId, url);
        const hash = this.resolvedHashes[record.tileId];
        if (hash) this.setResolvedHash(newTileId, hash);
      }

      record.tileId = newTileId;

      if (isActive(record) && progress !== undefined) {
        this.uploadingTiles[newTileId] = progress;
      }
    },

    /**
     * Tear down all upload/resolved state for a removed tile. A blob URL (and
     * the upload/resolved state tied to it) is only revoked or cleared when no
     * surviving tile still displays it: `survivingBlobOwners` maps each still-in-use
     * blob URL to the id of a remaining tile that shows it, so shared uploads are
     * reassigned to that tile instead of being destroyed.
     */
    clearTileState(
      tileId: string,
      ownedObjectUrls: string[] = [],
      survivingBlobOwners: Record<string, string> = {},
    ) {
      for (const [uploadId, record] of Object.entries(
        this.uploadRecords,
      )) {
        if (record.tileId !== tileId) continue;

        const blob = record.ownedObjectUrl;
        const newOwner = blob ? survivingBlobOwners[blob] : undefined;
        if (newOwner && newOwner !== tileId) {
          this.reassignUploadOwner(uploadId, record, newOwner);
          continue;
        }

        if (isActive(record)) {
          this.cancelUpload(uploadId);
        } else {
          this.revokeOwnedObjectUrl(record.ownedObjectUrl);
        }
        delete this.uploadRecords[uploadId];
        delete this.uploadGenerations[
          targetKey(record.tileId, record.documentItemId)
        ];
      }

      for (const url of ownedObjectUrls) {
        if (survivingBlobOwners[url]) continue;
        this.revokeOwnedObjectUrl(url);
      }

      this.clearTileUploading(tileId);
      this.clearResolvedUrl(tileId);
      this.clearResolvedDocumentItemsForTile(tileId);
    },

    reset() {
      for (const [uploadId, record] of Object.entries(
        this.uploadRecords,
      )) {
        if (isActive(record)) {
          this.cancelUpload(uploadId);
        } else {
          this.revokeOwnedObjectUrl(record.ownedObjectUrl);
        }
      }
      this.$reset();
    },
  },
});
