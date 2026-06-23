import { beforeEach, describe, expect, it } from "vitest";
import {
  ContentType,
  type DocumentsContent,
  type ImageContent,
} from "@grids/contracts/types";
import {
  createLoadedGridStore,
  gridHarness,
  makeGrid,
  makeTile,
  resetGridHarness,
} from "./gridTestHarness";

describe("grid store upload bookkeeping", () => {
  beforeEach(() => {
    resetGridHarness();
  });

  it("sets, updates, and clears determinate or indeterminate progress", async () => {
    const store = await createLoadedGridStore();

    store.setTileUploading("tile-1", -1);
    expect(store.uploadingTiles).toEqual({ "tile-1": -1 });

    store.setTileUploading("tile-1", 0.75);
    expect(store.uploadingTiles).toEqual({ "tile-1": 0.75 });

    store.clearTileUploading("tile-1");
    expect(store.uploadingTiles).toEqual({});
  });

  it("stores, retrieves, and clears a resolved media URL", async () => {
    const store = await createLoadedGridStore();

    store.setResolvedUrl("tile-1", "https://cdn.example/media");

    expect(store.getResolvedUrl("tile-1")).toBe(
      "https://cdn.example/media",
    );
    expect(store.getResolvedUrl("missing")).toBeUndefined();

    store.clearResolvedUrl("tile-1");
    expect(store.getResolvedUrl("tile-1")).toBeUndefined();
  });

  it("replaces blob media URLs in undo and pending transaction snapshots", async () => {
    const media = makeTile({
      content: {
        type: ContentType.IMAGE,
        src: "blob:media",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as ImageContent,
    });
    const store = await createLoadedGridStore(makeGrid({ tiles: [media] }));
    const manager = gridHarness.undoManagers[0]!;
    store.pushUndoSnapshot("Existing history");
    store.beginEditing("tile-1");
    store.beginMove();
    store.beginResize();

    store.setResolvedUrl("tile-1", "https://cdn.example/media");

    expect(store.resolvedUrls).toEqual({
      "tile-1": "https://cdn.example/media",
    });
    expect(manager.replaceBlobUrl).toHaveBeenCalledWith(
      "tile-1",
      "https://cdn.example/media",
    );
    expect(
      (
        manager.undoStack[0]?.tiles[0]?.content as unknown as {
          src: string;
        }
      ).src,
    ).toBe("https://cdn.example/media");

    store.currentGrid!.tiles[0]!.caption = "Changed";
    store.commitEditing();
    store.commitMove();
    store.commitResize();

    const transactionSnapshots = manager.pushSnapshot.mock.calls
      .slice(1)
      .map(([snapshot]) => snapshot);
    expect(transactionSnapshots).toHaveLength(3);
    for (const snapshot of transactionSnapshots) {
      expect(
        (
          snapshot.tiles[0].content as {
            src: string;
          }
        ).src,
      ).toBe("https://cdn.example/media");
    }
  });

  it("keeps resolved media URLs through undo and redo without adding history entries", async () => {
    const media = makeTile({
      content: {
        type: ContentType.IMAGE,
        src: "blob:media",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as ImageContent,
    });
    const store = await createLoadedGridStore(makeGrid({ tiles: [media] }));
    const manager = gridHarness.undoManagers[0]!;
    store.pushUndoSnapshot("Edit media tile");
    store.currentGrid!.tiles[0]!.caption = "After";
    const uploadId = store.startUpload({
      tileId: "tile-1",
      ownedObjectUrl: "blob:media",
    });
    expect(uploadId).toBe("upload-1");
    manager.pushSnapshot.mockClear();
    gridHarness.persistenceScheduler.schedule.mockClear();

    expect(store.resolveUpload(uploadId!, "https://cdn.example/media")).toBe(
      true,
    );

    expect(manager.pushSnapshot).not.toHaveBeenCalled();
    expect(gridHarness.persistenceScheduler.schedule).toHaveBeenCalledTimes(1);

    await store.undo();

    expect(store.currentGrid?.tiles[0]?.caption).toBe("");
    expect(
      (store.currentGrid?.tiles[0]?.content as ImageContent).src,
    ).toBe("https://cdn.example/media");

    await store.redo();

    expect(store.currentGrid?.tiles[0]?.caption).toBe("After");
    expect(
      (store.currentGrid?.tiles[0]?.content as ImageContent).src,
    ).toBe("https://cdn.example/media");
  });

  it("resolves media uploads during continuous transactions without creating extra history", async () => {
    const media = makeTile({
      content: {
        type: ContentType.IMAGE,
        src: "blob:media",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as ImageContent,
    });
    const store = await createLoadedGridStore(makeGrid({ tiles: [media] }));
    const manager = gridHarness.undoManagers[0]!;
    store.beginEditing("tile-1");
    store.beginMove();
    store.beginResize();
    const uploadId = store.startUpload({
      tileId: "tile-1",
      ownedObjectUrl: "blob:media",
    });
    manager.pushSnapshot.mockClear();

    expect(store.resolveUpload(uploadId!, "https://cdn.example/media")).toBe(
      true,
    );

    expect(manager.pushSnapshot).not.toHaveBeenCalled();

    store.currentGrid!.tiles[0]!.caption = "Changed";
    store.commitEditing();
    store.commitMove();
    store.commitResize();

    expect(manager.pushSnapshot).toHaveBeenCalledTimes(3);
    for (const [snapshot] of manager.pushSnapshot.mock.calls) {
      expect((snapshot.tiles[0].content as ImageContent).src).toBe(
        "https://cdn.example/media",
      );
    }
  });

  it("does not replace a permanent media URL in history snapshots", async () => {
    const media = makeTile({
      content: {
        type: ContentType.IMAGE,
        src: "https://existing.example/media",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as ImageContent,
    });
    const store = await createLoadedGridStore(makeGrid({ tiles: [media] }));
    const manager = gridHarness.undoManagers[0]!;
    store.pushUndoSnapshot("Existing history");

    store.setResolvedUrl("tile-1", "https://new.example/media");

    expect(
      (
        manager.undoStack[0]?.tiles[0]?.content as unknown as {
          src: string;
        }
      ).src,
    ).toBe("https://existing.example/media");
  });

  it("stores and clears resolved document item URLs by tile", async () => {
    const store = await createLoadedGridStore();

    store.setResolvedDocumentItemUrl(
      "documents",
      "item-1",
      "https://cdn.example/one",
    );
    store.setResolvedDocumentItemUrl(
      "documents",
      "item-2",
      "https://cdn.example/two",
    );

    expect(store.resolvedDocumentItemUrls).toEqual({
      documents: {
        "item-1": "https://cdn.example/one",
        "item-2": "https://cdn.example/two",
      },
    });

    store.clearResolvedDocumentItemsForTile("documents");
    expect(store.resolvedDocumentItemUrls).toEqual({});
  });

  it("replaces a blob document item URL in history and pending snapshots", async () => {
    const documentTile = makeTile({
      content: {
        type: ContentType.DOCUMENT,
        items: [
          { id: "item-1", fileName: "one.pdf", url: "blob:one" },
          {
            id: "item-2",
            fileName: "two.pdf",
            url: "https://cdn.example/two",
          },
        ],
      } as DocumentsContent,
    });
    const store = await createLoadedGridStore(
      makeGrid({ tiles: [documentTile] }),
    );
    const manager = gridHarness.undoManagers[0]!;
    store.pushUndoSnapshot("Existing history");
    store.beginEditing("tile-1");
    store.beginMove();
    store.beginResize();

    store.setResolvedDocumentItemUrl(
      "tile-1",
      "item-1",
      "https://cdn.example/one",
    );

    expect(manager.replaceBlobUrl).toHaveBeenCalledWith(
      "tile-1",
      "https://cdn.example/one",
      "item-1",
    );
    expect(
      (
        manager.undoStack[0]?.tiles[0]?.content as unknown as {
          items: Array<{ id: string; url: string }>;
        }
      ).items,
    ).toEqual([
      {
        id: "item-1",
        fileName: "one.pdf",
        url: "https://cdn.example/one",
      },
      {
        id: "item-2",
        fileName: "two.pdf",
        url: "https://cdn.example/two",
      },
    ]);

    store.currentGrid!.tiles[0]!.caption = "Changed";
    store.commitEditing();
    store.commitMove();
    store.commitResize();

    const transactionSnapshots = manager.pushSnapshot.mock.calls
      .slice(1)
      .map(([snapshot]) => snapshot);
    expect(transactionSnapshots).toHaveLength(3);
    for (const snapshot of transactionSnapshots) {
      const items = (
        snapshot.tiles[0].content as {
          items: Array<{ id: string; url: string }>;
        }
      ).items;
      expect(items.find((item) => item.id === "item-1")?.url).toBe(
        "https://cdn.example/one",
      );
      expect(items.find((item) => item.id === "item-2")?.url).toBe(
        "https://cdn.example/two",
      );
    }
  });

  it("keeps resolved document item URLs through undo and redo", async () => {
    const documentTile = makeTile({
      content: {
        type: ContentType.DOCUMENT,
        items: [
          { id: "item-1", fileName: "one.pdf", url: "blob:one" },
        ],
      } as DocumentsContent,
    });
    const store = await createLoadedGridStore(
      makeGrid({ tiles: [documentTile] }),
    );
    store.pushUndoSnapshot("Edit document tile");
    store.currentGrid!.tiles[0]!.caption = "After";
    const uploadId = store.startUpload({
      tileId: "tile-1",
      itemId: "item-1",
      ownedObjectUrl: "blob:one",
    });
    expect(uploadId).toBe("upload-1");

    expect(
      store.resolveUpload(uploadId!, "https://cdn.example/one"),
    ).toBe(true);

    await store.undo();

    expect(store.currentGrid?.tiles[0]?.caption).toBe("");
    expect(
      (
        store.currentGrid?.tiles[0]?.content as DocumentsContent
      ).items[0]?.url,
    ).toBe("https://cdn.example/one");

    await store.redo();

    expect(store.currentGrid?.tiles[0]?.caption).toBe("After");
    expect(
      (
        store.currentGrid?.tiles[0]?.content as DocumentsContent
      ).items[0]?.url,
    ).toBe("https://cdn.example/one");
  });
});
