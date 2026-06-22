import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGridUploadsStore } from "../gridUploads";

describe("gridUploads store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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

    store.setTileUploading("tile-1", -1);
    store.setResolvedUrl("tile-1", "media");
    store.setResolvedDocumentItemUrl("tile-1", "item-1", "document");
    store.reset();

    expect(store.uploadingTiles).toEqual({});
    expect(store.uploadingTiles).not.toBe(initialUploading);
    expect(store.resolvedUrls).toEqual({});
    expect(store.resolvedUrls).not.toBe(initialResolved);
    expect(store.resolvedDocumentItemUrls).toEqual({});
    expect(store.resolvedDocumentItemUrls).not.toBe(initialDocuments);
  });
});
