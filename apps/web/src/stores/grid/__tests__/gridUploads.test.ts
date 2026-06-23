import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGridUploadsStore } from "../gridUploads";

describe("gridUploads store", () => {
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  it("starts with independent empty upload maps", () => {
    const store = useGridUploadsStore();

    expect(store.uploadingTiles).toEqual({});
    expect(store.resolvedUrls).toEqual({});
    expect(store.resolvedDocumentItemUrls).toEqual({});
  });

  it.each([-1, 0, 0.5, 1])(
    "stores determinate or indeterminate upload progress %s",
    (progress) => {
      const store = useGridUploadsStore();

      store.setTileUploading("tile-1", progress);
      expect(store.uploadingTiles["tile-1"]).toBe(progress);

      store.clearTileUploading("tile-1");
      expect(store.uploadingTiles).toEqual({});
    },
  );

  it("creates explicit upload records with target generations while keeping progress maps compatible", () => {
    const store = useGridUploadsStore();

    const first = store.startUpload({
      gridId: "grid-1",
      sessionGeneration: 2,
      tileId: "tile-1",
      progress: 0.25,
      ownedObjectUrl: "blob:first",
    });
    const second = store.startUpload({
      gridId: "grid-1",
      sessionGeneration: 2,
      tileId: "tile-1",
      progress: 0.5,
      ownedObjectUrl: "blob:second",
    });

    expect(first).toBe("upload-1");
    expect(second).toBe("upload-2");
    expect(store.uploadRecords[first]).toEqual(
      expect.objectContaining({
        uploadId: first,
        gridId: "grid-1",
        sessionGeneration: 2,
        tileId: "tile-1",
        progress: 0.25,
        status: "abandoned",
        generation: 1,
      }),
    );
    expect(store.uploadRecords[second]).toEqual(
      expect.objectContaining({
        uploadId: second,
        tileId: "tile-1",
        progress: 0.5,
        status: "active",
        generation: 2,
      }),
    );
    expect(store.uploadingTiles).toEqual({ "tile-1": 0.5 });
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
  });

  it("progresses and resolves upload records into legacy media and document maps", () => {
    const store = useGridUploadsStore();
    const media = store.startUpload({
      uploadId: "media-upload",
      gridId: "grid-1",
      sessionGeneration: 1,
      tileId: "media",
    });
    const document = store.startUpload({
      uploadId: "document-upload",
      gridId: "grid-1",
      sessionGeneration: 1,
      tileId: "document",
      documentItemId: "item-1",
    });

    expect(store.progressUpload(media, 0.75)).toBe(true);
    expect(store.resolveUpload(media, "https://cdn/media")).toBe(true);
    expect(
      store.resolveUpload(document, "https://cdn/document", false),
    ).toBe(true);

    expect(store.uploadRecords[media]).toEqual(
      expect.objectContaining({
        resolvedUrl: "https://cdn/media",
        status: "resolved",
      }),
    );
    expect(store.resolvedUrls).toEqual({
      media: "https://cdn/media",
    });
    expect(store.resolvedDocumentItemUrls).toEqual({
      document: { "item-1": "https://cdn/document" },
    });
    expect(store.uploadingTiles.media).toBeUndefined();
    expect(store.uploadingTiles.document).toBe(0);
  });

  it("cancels active tile uploads and revokes owned object URLs exactly once when clearing tile state", () => {
    const store = useGridUploadsStore();
    const task = { cancel: vi.fn(), done: vi.fn(), onProgress: vi.fn() };
    const uploadId = store.startUpload({
      gridId: "grid-1",
      sessionGeneration: 1,
      tileId: "tile-1",
      ownedObjectUrl: "blob:owned",
      task,
    });
    store.revokeOwnedObjectUrl("blob:owned");

    store.clearTileState("tile-1", [
      "blob:owned",
      "blob:content",
      "https://cdn/content",
    ]);

    expect(task.cancel).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenNthCalledWith(1, "blob:owned");
    expect(revokeObjectURL).toHaveBeenNthCalledWith(
      2,
      "blob:content",
    );
    expect(store.uploadRecords[uploadId]).toBeUndefined();
    expect(store.uploadingTiles).toEqual({});
  });

  it("stores, retrieves, and clears resolved media URLs", () => {
    const store = useGridUploadsStore();

    expect(store.getResolvedUrl("tile-1")).toBeUndefined();

    store.setResolvedUrl("tile-1", "https://example.com/media");
    expect(store.getResolvedUrl("tile-1")).toBe(
      "https://example.com/media",
    );

    store.clearResolvedUrl("tile-1");
    expect(store.getResolvedUrl("tile-1")).toBeUndefined();
  });

  it("stores document item URLs by tile and item", () => {
    const store = useGridUploadsStore();

    store.setResolvedDocumentItemUrl(
      "tile-1",
      "item-1",
      "https://example.com/one",
    );
    store.setResolvedDocumentItemUrl(
      "tile-1",
      "item-2",
      "https://example.com/two",
    );
    store.setResolvedDocumentItemUrl(
      "tile-1",
      "item-1",
      "https://example.com/replaced",
    );

    expect(store.resolvedDocumentItemUrls).toEqual({
      "tile-1": {
        "item-1": "https://example.com/replaced",
        "item-2": "https://example.com/two",
      },
    });

    store.clearResolvedDocumentItemsForTile("tile-1");
    expect(store.resolvedDocumentItemUrls).toEqual({});
  });

  it("clears every local upload map entry for one tile only", () => {
    const store = useGridUploadsStore();
    store.setTileUploading("tile-1", 0.5);
    store.setTileUploading("tile-2", 0.75);
    store.setResolvedUrl("tile-1", "one");
    store.setResolvedUrl("tile-2", "two");
    store.setResolvedDocumentItemUrl("tile-1", "item-1", "doc-one");
    store.setResolvedDocumentItemUrl("tile-2", "item-2", "doc-two");

    store.clearTileState("tile-1");

    expect(store.uploadingTiles).toEqual({ "tile-2": 0.75 });
    expect(store.resolvedUrls).toEqual({ "tile-2": "two" });
    expect(store.resolvedDocumentItemUrls).toEqual({
      "tile-2": { "item-2": "doc-two" },
    });
  });

  it("reset clears all maps and replaces their references", () => {
    const store = useGridUploadsStore();
    const initialUploading = store.uploadingTiles;
    const initialResolved = store.resolvedUrls;
    const initialDocuments = store.resolvedDocumentItemUrls;

    store.startUpload({
      gridId: "grid-1",
      sessionGeneration: 1,
      tileId: "tile-2",
      ownedObjectUrl: "blob:reset",
    });
    store.setTileUploading("tile-1", -1);
    store.setResolvedUrl("tile-1", "media");
    store.setResolvedDocumentItemUrl("tile-1", "item-1", "document");
    store.reset();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:reset");
    expect(store.uploadRecords).toEqual({});
    expect(store.uploadingTiles).toEqual({});
    expect(store.uploadingTiles).not.toBe(initialUploading);
    expect(store.resolvedUrls).toEqual({});
    expect(store.resolvedUrls).not.toBe(initialResolved);
    expect(store.resolvedDocumentItemUrls).toEqual({});
    expect(store.resolvedDocumentItemUrls).not.toBe(initialDocuments);
  });
});
