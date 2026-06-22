import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGridStore,
  createLoadedGridStore,
  gridHarness,
  makeGrid,
  resetGridHarness,
} from "./gridTestHarness";

describe("grid store session behavior", () => {
  beforeEach(() => {
    resetGridHarness();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    document.cookie = "showMetaData=true; path=/";
    document.cookie = "showMetaDataVerbose=true; path=/";
  });

  it("loads an owned grid and performs all session side effects", async () => {
    const loaded = makeGrid({ id: "grid-2", userId: "user-1" });
    const listEntry = makeGrid({
      id: "grid-2",
      userId: "user-1",
      lastOpenedAt: null,
    });
    gridHarness.gridService.fetchGrid.mockResolvedValueOnce(loaded);
    const store = await createGridStore();
    store.grids = [listEntry];

    await store.loadGrid("grid-2");

    expect(gridHarness.gridService.fetchGrid).toHaveBeenCalledWith("grid-2");
    expect(store.currentGrid).toEqual(loaded);
    expect(store.isOwner).toBe(true);
    expect(store.isDemoGrid).toBe(false);
    expect(store.showMetaData).toBe(true);
    expect(store.showMetaDataVerbose).toBe(true);
    expect(store.recentGridIds).toEqual(["grid-2"]);
    expect(gridHarness.gridService.touchLastOpenedAt).toHaveBeenCalledWith(
      "grid-2",
    );
    expect(store.grids[0]?.lastOpenedAt).toBeInstanceOf(Date);
    expect(gridHarness.undoManagers).toHaveLength(1);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("loads a foreign grid as read-only", async () => {
    const store = await createGridStore();
    gridHarness.gridService.fetchGrid.mockResolvedValueOnce(
      makeGrid({ userId: "another-user" }),
    );

    await store.loadGrid("grid-1");

    expect(store.isOwner).toBe(false);
    expect(store.canEdit).toBe(false);
  });

  it("loads a grid as read-only when no user is authenticated", async () => {
    gridHarness.authProvider.getCurrentUserId.mockReturnValue(null);
    const store = await createGridStore();

    await store.loadGrid("grid-1");

    expect(store.currentGrid).not.toBeNull();
    expect(store.isOwner).toBe(false);
  });

  it("exposes load failures and always leaves loading state", async () => {
    gridHarness.gridService.fetchGrid.mockRejectedValueOnce(
      new Error("load failed"),
    );
    const store = await createGridStore();

    await store.loadGrid("grid-1");

    expect(store.error).toBe("Failed to load grid.");
    expect(store.isLoading).toBe(false);
    expect(store.currentGrid).toBeNull();
    expect(gridHarness.gridService.touchLastOpenedAt).not.toHaveBeenCalled();
  });

  it("replaces prior history with a fresh manager on each load", async () => {
    const store = await createGridStore();
    const { useGridHistoryStore } = await import(
      "@/stores/grid/gridHistory"
    );

    await store.loadGrid("grid-1");
    const firstManager = gridHarness.undoManagers[0];
    store.pushUndoSnapshot("Before reload");
    store.beginEditing("tile-1");
    store.beginMove();
    store.beginResize();

    gridHarness.gridService.fetchGrid.mockResolvedValueOnce(
      makeGrid({ id: "grid-2" }),
    );
    await store.loadGrid("grid-2");

    expect(firstManager?.clear).toHaveBeenCalled();
    expect(gridHarness.undoManagers).toHaveLength(2);
    expect(store.canUndo).toBe(false);
    expect(useGridHistoryStore().editingTileId).toBeNull();
    expect(useGridHistoryStore().pendingEditSnapshot).toBeNull();
    expect(useGridHistoryStore().pendingMoveSnapshot).toBeNull();
    expect(useGridHistoryStore().pendingResizeSnapshot).toBeNull();
  });

  it("loads a demo grid without persistence, ownership, or history setup", async () => {
    const demo = makeGrid({ id: "demo", userId: "demo-user" });
    const store = await createGridStore();
    store.isLoading = true;
    store.error = "old error";

    store.loadDemoGrid(demo);

    expect(store.currentGrid).toEqual(demo);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.isOwner).toBe(false);
    expect(store.isDemoGrid).toBe(true);
    expect(gridHarness.gridService.fetchGrid).not.toHaveBeenCalled();
    expect(gridHarness.undoManagers).toHaveLength(0);
  });

  it("queues the active grid and resolved URL maps when editable", async () => {
    const store = await createLoadedGridStore();
    store.setResolvedUrl("tile-1", "https://cdn.example/media");
    store.setResolvedDocumentItemUrl(
      "tile-1",
      "item-1",
      "https://cdn.example/document",
    );
    gridHarness.gridService.queueSave.mockClear();

    await store.saveGrid();

    expect(gridHarness.gridService.queueSave).toHaveBeenCalledWith(
      store.currentGrid,
      { "tile-1": "https://cdn.example/media" },
      {
        "tile-1": {
          "item-1": "https://cdn.example/document",
        },
      },
    );
  });

  it("does not save without a current grid or edit permission", async () => {
    const store = await createGridStore();

    await store.saveGrid();
    expect(console.warn).toHaveBeenCalledWith("No grid to save.");

    store.currentGrid = makeGrid();
    store.isOwner = false;
    await store.saveGrid();

    store.isOwner = true;
    store.viewportBreakpoint = "sm";
    store.forcedBreakpoint = "lg";
    await store.saveGrid();

    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();
  });

  it("exposes queue failures through session error state", async () => {
    const store = await createLoadedGridStore();
    gridHarness.gridService.queueSave.mockRejectedValueOnce(
      new Error("save failed"),
    );

    await store.saveGrid();

    expect(store.error).toBe("Failed to save grid.");
  });

  it("clears active session, UI, viewport, edit, and history state", async () => {
    const store = await createLoadedGridStore();
    const { useGridHistoryStore } = await import(
      "@/stores/grid/gridHistory"
    );
    store.setPanelActive("tile-1", "settings");
    store.setDisplayPositions([{ i: "tile-1", x: 1, y: 2, w: 3, h: 4 }]);
    store.setForcedBreakpoint("sm");
    store.setViewportBreakpoint("md");
    store.beginEditing("tile-1");
    store.beginMove();
    store.beginResize();
    store.pushUndoSnapshot("Edit tile");
    store.setTileUploading("tile-1", 0.5);
    store.setResolvedUrl("tile-1", "https://cdn.example/media");
    store.setResolvedDocumentItemUrl(
      "tile-1",
      "item-1",
      "https://cdn.example/document",
    );
    const manager = gridHarness.undoManagers[0];

    store.clearCurrentGrid();

    expect(store.currentGrid).toBeNull();
    expect(store.isOwner).toBe(false);
    expect(store.isDemoGrid).toBe(false);
    expect(store.displayPositions).toEqual([]);
    expect(store.activeTileId).toBeNull();
    expect(store.activePanelId).toBeNull();
    expect(store.forcedBreakpoint).toBeNull();
    expect(store.viewportBreakpoint).toBe("lg");
    expect(store.uploadingTiles).toEqual({});
    expect(store.resolvedUrls).toEqual({});
    expect(store.resolvedDocumentItemUrls).toEqual({});
    expect(manager?.clear).toHaveBeenCalled();
    expect(store.canUndo).toBe(false);
    expect(useGridHistoryStore().manager).toBeNull();
    expect(useGridHistoryStore().editingTileId).toBeNull();
    expect(useGridHistoryStore().pendingEditSnapshot).toBeNull();
    expect(useGridHistoryStore().pendingMoveSnapshot).toBeNull();
    expect(useGridHistoryStore().pendingResizeSnapshot).toBeNull();
  });
});
