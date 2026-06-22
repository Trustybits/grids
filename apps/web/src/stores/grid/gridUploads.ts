import { defineStore } from "pinia";

export const useGridUploadsStore = defineStore("gridUploads", {
  state: () => ({
    uploadingTiles: {} as Record<string, number>,
    resolvedUrls: {} as Record<string, string>,
    resolvedDocumentItemUrls: {} as Record<
      string,
      Record<string, string>
    >,
  }),

  actions: {
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
    },

    setResolvedDocumentItemUrl(
      tileId: string,
      itemId: string,
      url: string,
    ) {
      this.resolvedDocumentItemUrls[tileId] ??= {};
      this.resolvedDocumentItemUrls[tileId][itemId] = url;
    },

    clearResolvedDocumentItemsForTile(tileId: string) {
      delete this.resolvedDocumentItemUrls[tileId];
    },

    clearTileState(tileId: string) {
      this.clearTileUploading(tileId);
      this.clearResolvedUrl(tileId);
      this.clearResolvedDocumentItemsForTile(tileId);
    },

    reset() {
      this.$reset();
    },
  },
});
