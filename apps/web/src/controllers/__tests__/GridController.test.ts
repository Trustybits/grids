import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPinia,
  setActivePinia,
  type Pinia,
} from "pinia";
import type { AuthProvider } from "@grids/contracts/auth";
import {
  ContentType,
  type ChatContent,
  type Grid,
  type ImageContent,
  type Tile,
} from "@grids/contracts/types";
import type { AnalyticsServiceInterface } from "@/services/interfaces/AnalyticsServiceInterface";
import type { ChatServiceInterface } from "@/services/interfaces/ChatServiceInterface";
import type { GridServiceInterface } from "@/services/interfaces/GridServiceInterface";
import type { GridPersistenceSchedulerInterface } from "@/services/interfaces/GridPersistenceSchedulerInterface";
import { GridSnapshotCodec } from "@/undo/GridSnapshotCodec";
import type { Snapshot } from "@/undo/UndoTypes";
import { useGridCollectionStore } from "@/stores/grid/gridCollection";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useGridPreviewStore } from "@/stores/grid/gridPreview";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridUploadsStore } from "@/stores/grid/gridUploads";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useThemeStore } from "@/stores/theme";
import { useToastStore } from "@/stores/toast";
import {
  GridController,
  type GridControllerDependencies,
  type GridControllerStores,
} from "../GridController";

const defaultDependencyHarness = vi.hoisted(() => ({
  getServiceFactory: vi.fn(),
  getAuthProvider: vi.fn(),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: defaultDependencyHarness.getServiceFactory,
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: defaultDependencyHarness.getAuthProvider,
}));

import { useGridController } from "../useGridController";

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    backgroundColor: "",
    ogImageSrc: "",
    themeId: "theme-a",
    tiles: [],
    overrides: {},
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeSnapshot(
  overrides: Partial<Snapshot> = {},
): Snapshot {
  return {
    tiles: [],
    overrides: {},
    verticalCompact: true,
    themeId: "theme-a",
    backgroundImageSrc: "",
    backgroundEmbed: false,
    backgroundColor: "",
    ogImageSrc: "",
    forcedBreakpoint: "lg",
    actionLabel: "",
    ...overrides,
  };
}

function createStores(pinia: Pinia): GridControllerStores {
  return {
    collection: useGridCollectionStore(pinia),
    history: useGridHistoryStore(pinia),
    preview: useGridPreviewStore(pinia),
    session: useGridSessionStore(pinia),
    ui: useGridUiStore(pinia),
    uploads: useGridUploadsStore(pinia),
    viewport: useGridViewportStore(pinia),
    theme: useThemeStore(pinia),
    toast: useToastStore(pinia),
  };
}

function createGridServiceMock(): GridServiceInterface {
  return {
    fetchGrid: vi.fn(),
    subscribeToGrid: vi.fn(() => () => {}),
    saveGrid: vi.fn(),
    updateGrid: vi.fn(),
    deleteGrid: vi.fn(),
    fetchGridsByUserId: vi.fn(),
    generateId: vi.fn(),
    createGrid: vi.fn(),
    duplicateGrid: vi.fn(),
    touchLastOpenedAt: vi.fn(),
    loadRecentGridIds: vi.fn(),
    saveRecentGridIds: vi.fn(),
    createGridWithStarterTiles: vi.fn(),
    cloneAndPersistGrid: vi.fn(),
  };
}

function createControllerHarness() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const stores = createStores(pinia);
  const gridService = createGridServiceMock();
  vi.mocked(gridService.fetchGrid).mockResolvedValue(makeGrid());
  vi.mocked(gridService.touchLastOpenedAt).mockResolvedValue(undefined);
  vi.mocked(gridService.saveRecentGridIds).mockResolvedValue(undefined);
  vi.mocked(gridService.deleteGrid).mockResolvedValue(undefined);

  const authProvider = {
    getCurrentUserId: vi.fn(() => "user-1"),
  } as unknown as AuthProvider;
  const persistenceScheduler: GridPersistenceSchedulerInterface = {
    schedule: vi.fn(),
    flush: vi.fn(async () => null),
  };
  const chatService = {
    deleteAllMessages: vi.fn(async () => undefined),
  } as unknown as ChatServiceInterface;
  const dependencies: GridControllerDependencies = {
    getGridService: vi.fn(() => gridService),
    persistenceScheduler,
    getAuthProvider: vi.fn(() => authProvider),
    getAnalyticsService: vi.fn(
      () => ({}) as AnalyticsServiceInterface,
    ),
    getChatService: vi.fn(() => chatService),
    generateUuid: vi.fn(() => "uuid"),
    delay: vi.fn(async () => undefined),
    now: vi.fn(() => new Date("2026-06-22T12:00:00Z")),
    measureViewportGridRow: vi.fn(() => 0),
    readMetadataPreferences: vi.fn(() => ({
      showMetaData: true,
      showMetaDataVerbose: false,
    })),
    getCookieValue: vi.fn(() => null),
    setCookieValue: vi.fn(),
    snapshotCodec: new GridSnapshotCodec(),
  };
  const controller = new GridController(stores, dependencies);

  return {
    pinia,
    stores,
    gridService,
    persistenceScheduler,
    authProvider,
    chatService,
    dependencies,
    controller,
  };
}

describe("GridController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultDependencyHarness.getServiceFactory.mockReset();
    defaultDependencyHarness.getAuthProvider.mockReset();
  });

  it("resets session-owned state in explicit order while preserving preferences", () => {
    const { controller, stores } = createControllerHarness();
    const resetOrder: string[] = [];
    vi.spyOn(stores.history, "reset").mockImplementation(() => {
      resetOrder.push("history");
    });
    vi.spyOn(stores.preview, "reset").mockImplementation(() => {
      resetOrder.push("preview");
    });
    vi.spyOn(stores.viewport, "reset").mockImplementation(() => {
      resetOrder.push("viewport");
    });
    vi.spyOn(stores.uploads, "reset").mockImplementation(() => {
      resetOrder.push("uploads");
    });
    vi.spyOn(stores.ui, "resetSessionState").mockImplementation(() => {
      resetOrder.push("ui");
    });
    vi.spyOn(stores.session, "reset").mockImplementation(() => {
      resetOrder.push("session");
    });
    stores.ui.setShowMetaData(true);
    stores.ui.setShowMetaDataVerbose(true);

    controller.resetSessionDependents();

    expect(resetOrder).toEqual([
      "history",
      "preview",
      "viewport",
      "uploads",
      "ui",
      "session",
    ]);
    expect(stores.ui.showMetaData).toBe(true);
    expect(stores.ui.showMetaDataVerbose).toBe(true);
  });

  it("clears stale dependent state before a replacement load resolves", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    const request = deferred<Grid>();
    vi.mocked(gridService.fetchGrid).mockReturnValueOnce(request.promise);
    stores.session.setCurrentGrid(makeGrid({ id: "old-grid" }));
    stores.history.initializeManager();
    const oldManager = stores.history.manager;
    stores.history.setStableSnapshot(
      makeSnapshot({ actionLabel: "Old stable" }),
    );
    stores.history.pushSnapshot(
      makeSnapshot({ actionLabel: "Old undo" }),
    );
    stores.history.beginEdit(
      "tile-1",
      makeSnapshot({ actionLabel: "Old edit" }),
    );
    stores.history.beginMove(
      makeSnapshot({ actionLabel: "Old move" }),
    );
    stores.history.beginResize(
      makeSnapshot({ actionLabel: "Old resize" }),
    );
    stores.preview.startPreview({ kind: "test-preview", gridId: "old-grid" });
    stores.viewport.setForcedBreakpoint("sm");
    stores.viewport.setDisplayPositions([
      { i: "tile-1", x: 1, y: 2, w: 3, h: 4 },
    ]);
    stores.uploads.setTileUploading("tile-1", 0.5);
    stores.uploads.setResolvedUrl("tile-1", "https://cdn/media");
    stores.uploads.setResolvedDocumentItemUrl(
      "tile-1",
      "item-1",
      "https://cdn/document",
    );
    stores.ui.setPanelActive("tile-1", "settings");
    stores.ui.setPendingFocusTileId("tile-1");
    stores.ui.setShowMetaData(true);
    stores.ui.setShowMetaDataVerbose(true);

    const loading = controller.loadGrid("new-grid");

    expect(stores.session.currentGrid).toBeNull();
    expect(stores.preview.activePreview).toBeNull();
    expect(stores.session.isLoading).toBe(true);
    expect(stores.history.manager).not.toBe(oldManager);
    expect(stores.history.manager).not.toBeNull();
    expect(stores.history.canUndo).toBe(false);
    expect(stores.history.canRedo).toBe(false);
    expect(stores.history.undoRedoStacks).toEqual({
      undoStack: [],
      redoStack: [],
    });
    expect(stores.history.stableSnapshot).toBeNull();
    expect(stores.history.editingTileId).toBeNull();
    expect(stores.history.pendingEditSnapshot).toBeNull();
    expect(stores.history.pendingMoveSnapshot).toBeNull();
    expect(stores.history.pendingResizeSnapshot).toBeNull();
    expect(stores.viewport.forcedBreakpoint).toBeNull();
    expect(stores.viewport.displayPositions).toEqual([]);
    expect(stores.uploads.uploadingTiles).toEqual({});
    expect(stores.uploads.resolvedUrls).toEqual({});
    expect(stores.uploads.resolvedDocumentItemUrls).toEqual({});
    expect(stores.ui.activeTileId).toBeNull();
    expect(stores.ui.activePanelId).toBeNull();
    expect(stores.ui.pendingFocusTileId).toBeNull();
    expect(stores.ui.showMetaData).toBe(true);
    expect(stores.ui.showMetaDataVerbose).toBe(true);

    request.resolve(makeGrid({ id: "new-grid" }));
    await loading;

    expect(stores.session.currentGrid?.id).toBe("new-grid");
    expect(stores.history.canUndo).toBe(false);
    expect(stores.history.canRedo).toBe(false);
    expect(stores.history.undoRedoStacks).toEqual({
      undoStack: [],
      redoStack: [],
    });
    expect(stores.history.stableSnapshot).toEqual(
      expect.objectContaining({
        actionLabel: "",
        forcedBreakpoint: "lg",
      }),
    );
    expect(stores.history.stableSnapshot?.actionLabel).not.toBe(
      "Old stable",
    );
  });

  it("blocks user mutation categories and pending gesture commits during preview", async () => {
    const { controller, stores, persistenceScheduler } =
      createControllerHarness();
    const tile: Tile = {
      i: "tile-1",
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      caption: "Before",
      content: { type: ContentType.IMAGE, src: "before" } as ImageContent,
    };
    const grid = makeGrid({
      name: "Before",
      backgroundColor: "#000000",
      tiles: [tile],
      overrides: {
        sm: { "tile-1": { x: 0, y: 0, w: 2, h: 2 } },
      },
    });
    stores.session.setCurrentGrid(grid);
    stores.session.setOwner(true);
    stores.history.initializeManager();
    controller.beginMove();
    stores.viewport.setDisplayPositions([
      { i: "tile-1", x: 3, y: 4, w: 1, h: 1 },
    ]);

    stores.preview.startPreview({ kind: "test-preview", gridId: "grid-1" });
    controller.commitMove();
    controller.setTileContent("tile-1", {
      type: ContentType.IMAGE,
      src: "after",
    } as ImageContent);
    controller.updateCaption({ tileId: "tile-1", caption: "After" });
    controller.renameCurrentGrid("After");
    controller.setGridTheme("theme-b");
    controller.setBackgroundColor("#ffffff");
    controller.setVerticalCompact(false);
    controller.resizeTile("tile-1", 1, 1);
    controller.saveBreakpointPositions("sm", [
      { i: "tile-1", x: 2, y: 2, w: 1, h: 1 },
    ]);
    controller.resetBreakpoint("sm");
    await controller.undo();

    expect(grid).toEqual(
      expect.objectContaining({
        name: "Before",
        backgroundColor: "#000000",
        themeId: "theme-a",
        verticalCompact: true,
      }),
    );
    expect(grid.tiles[0]).toEqual(
      expect.objectContaining({
        x: 0,
        y: 0,
        w: 2,
        h: 2,
        caption: "Before",
        content: expect.objectContaining({ src: "before" }),
      }),
    );
    expect(grid.overrides?.sm?.["tile-1"]).toEqual({
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
    expect(persistenceScheduler.schedule).not.toHaveBeenCalled();
  });

  it("allows breakpoint inspection and an active upload to settle during preview", async () => {
    const { controller, stores, persistenceScheduler } =
      createControllerHarness();
    stores.session.setCurrentGrid(
      makeGrid({
        tiles: [
          {
            i: "tile-1",
            x: 0,
            y: 0,
            w: 2,
            h: 2,
            caption: "",
            content: {
              type: ContentType.IMAGE,
              src: "blob:media",
            } as ImageContent,
          },
        ],
      }),
    );
    stores.session.setOwner(true);
    const uploadId = controller.startUpload({
      uploadId: "upload-1",
      tileId: "tile-1",
      ownedObjectUrl: "blob:media",
    });
    expect(uploadId).toBe("upload-1");

    stores.preview.startPreview({ kind: "test-preview", gridId: "grid-1" });
    controller.setForcedBreakpoint("sm");
    expect(controller.startUpload({ tileId: "tile-1" })).toBeNull();
    expect(
      controller.resolveUpload(
        "upload-1",
        "https://cdn/media.png",
        "hash-1",
      ),
    ).toBe(true);

    expect(stores.viewport.forcedBreakpoint).toBe("sm");
    expect(stores.uploads.resolvedUrls["tile-1"]).toBe(
      "https://cdn/media.png",
    );
    expect(persistenceScheduler.schedule).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(stores.session.persistenceError).toBeNull();
  });

  it("allows a failed pre-preview upload to roll back its optimistic tile", () => {
    const { controller, stores, persistenceScheduler } =
      createControllerHarness();
    stores.session.setCurrentGrid(
      makeGrid({
        tiles: [
          {
            i: "tile-1",
            x: 0,
            y: 0,
            w: 2,
            h: 2,
            caption: "",
            content: {
              type: ContentType.IMAGE,
              src: "blob:media",
            } as ImageContent,
          },
        ],
      }),
    );
    stores.session.setOwner(true);
    const uploadId = controller.startUpload({
      uploadId: "upload-1",
      tileId: "tile-1",
      ownedObjectUrl: "blob:media",
    });

    stores.preview.startPreview({ kind: "test-preview", gridId: "grid-1" });

    expect(controller.failUploadAndRemoveTile(uploadId!)).toBe(true);
    expect(stores.session.currentGrid?.tiles).toEqual([]);
    expect(stores.uploads.uploadRecords[uploadId!]).toBeUndefined();
    expect(persistenceScheduler.schedule).toHaveBeenCalledTimes(1);
  });

  it("ignores an obsolete load response while a replacement load is pending", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    const oldRequest = deferred<Grid>();
    const newRequest = deferred<Grid>();
    vi.mocked(gridService.fetchGrid)
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const oldLoad = controller.loadGrid("old-grid");
    const newLoad = controller.loadGrid("new-grid");

    oldRequest.resolve(makeGrid({ id: "old-grid" }));
    await oldLoad;

    expect(stores.session.currentGrid).toBeNull();
    expect(stores.session.isLoading).toBe(true);
    expect(stores.collection.recentGridIds).toEqual([]);
    expect(gridService.saveRecentGridIds).not.toHaveBeenCalled();
    expect(gridService.touchLastOpenedAt).not.toHaveBeenCalled();

    newRequest.resolve(makeGrid({ id: "new-grid" }));
    await newLoad;

    expect(stores.session.currentGrid?.id).toBe("new-grid");
    expect(stores.session.isLoading).toBe(false);
    expect(stores.collection.recentGridIds).toEqual(["new-grid"]);
    expect(gridService.saveRecentGridIds).toHaveBeenCalledWith(
      "user-1",
      ["new-grid"],
    );
    expect(gridService.touchLastOpenedAt).toHaveBeenCalledWith(
      "new-grid",
    );
  });

  it("keeps the newer grid when an obsolete load response resolves last", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    const oldRequest = deferred<Grid>();
    const newRequest = deferred<Grid>();
    vi.mocked(gridService.fetchGrid)
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const oldLoad = controller.loadGrid("old-grid");
    const newLoad = controller.loadGrid("new-grid");

    newRequest.resolve(makeGrid({ id: "new-grid" }));
    await newLoad;
    oldRequest.resolve(makeGrid({ id: "old-grid" }));
    await oldLoad;

    expect(stores.session.currentGrid?.id).toBe("new-grid");
    expect(stores.session.isLoading).toBe(false);
    expect(stores.collection.recentGridIds).toEqual(["new-grid"]);
    expect(gridService.saveRecentGridIds).toHaveBeenCalledTimes(1);
    expect(gridService.saveRecentGridIds).toHaveBeenCalledWith(
      "user-1",
      ["new-grid"],
    );
    expect(gridService.touchLastOpenedAt).toHaveBeenCalledTimes(1);
    expect(gridService.touchLastOpenedAt).toHaveBeenCalledWith(
      "new-grid",
    );
  });

  it("loads an owned grid and updates focused session and collection state", async () => {
    const {
      controller,
      stores,
      gridService,
      dependencies,
    } = createControllerHarness();
    const grid = makeGrid({ id: "grid-2", userId: "user-1" });
    vi.mocked(gridService.fetchGrid).mockResolvedValueOnce(grid);
    stores.collection.setGrids([
      makeGrid({ id: "grid-2", lastOpenedAt: null }),
    ]);

    await controller.loadGrid("grid-2");

    expect(stores.session.currentGrid).toEqual(grid);
    expect(stores.session.isOwner).toBe(true);
    expect(stores.session.isDemoGrid).toBe(false);
    expect(stores.session.isLoading).toBe(false);
    expect(stores.session.loadError).toBeNull();
    expect(stores.ui.showMetaData).toBe(true);
    expect(stores.ui.showMetaDataVerbose).toBe(false);
    expect(stores.collection.recentGridIds).toEqual(["grid-2"]);
    expect(gridService.saveRecentGridIds).toHaveBeenCalledWith(
      "user-1",
      ["grid-2"],
    );
    expect(gridService.touchLastOpenedAt).toHaveBeenCalledWith("grid-2");
    expect(stores.collection.grids[0]?.lastOpenedAt).toEqual(
      new Date("2026-06-22T12:00:00Z"),
    );
    expect(stores.history.manager).not.toBeNull();
    expect(stores.history.stableSnapshot).toEqual(
      expect.objectContaining({
        actionLabel: "",
        themeId: "theme-a",
        forcedBreakpoint: "lg",
      }),
    );
    expect(dependencies.getAnalyticsService).not.toHaveBeenCalled();
    expect(dependencies.generateUuid).not.toHaveBeenCalled();
  });

  it("loads a foreign grid as read-only", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    vi.mocked(gridService.fetchGrid).mockResolvedValueOnce(
      makeGrid({ userId: "other-user" }),
    );

    await controller.loadGrid("grid-1");

    expect(stores.session.isOwner).toBe(false);
  });

  it("records load failures and always clears loading", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(gridService.fetchGrid).mockRejectedValueOnce(
      new Error("load failed"),
    );

    await controller.loadGrid("grid-1");

    expect(stores.session.currentGrid).toBeNull();
    expect(stores.session.loadError).toBe("Failed to load grid.");
    expect(stores.session.isLoading).toBe(false);
    expect(gridService.touchLastOpenedAt).not.toHaveBeenCalled();
  });

  it("delegates resyncIfStale to reload the active grid when its stored rev has advanced", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    stores.session.setCurrentGrid(makeGrid({ id: "grid-1", rev: 2 }));
    const latest = makeGrid({ id: "grid-1", rev: 4, name: "Newer" });
    vi.mocked(gridService.fetchGrid).mockResolvedValueOnce(latest);

    await controller.resyncIfStale();

    expect(gridService.fetchGrid).toHaveBeenCalledWith("grid-1");
    expect(stores.session.currentGrid).toEqual(latest);
    expect(stores.session.isResyncing).toBe(false);
  });

  it("delegates resyncIfStale as a no-op when the stored rev still matches", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    stores.session.setCurrentGrid(makeGrid({ id: "grid-1", rev: 2 }));
    vi.mocked(gridService.fetchGrid).mockResolvedValueOnce(
      makeGrid({ id: "grid-1", rev: 2, name: "Newer" }),
    );

    await controller.resyncIfStale();

    expect(stores.session.currentGrid?.name).toBe("Grid");
    expect(stores.session.isResyncing).toBe(false);
  });

  it("clears the active session and all dependent state", () => {
    const { controller, stores } = createControllerHarness();
    stores.session.setCurrentGrid(makeGrid());
    stores.history.initializeManager();
    stores.history.setStableSnapshot(makeSnapshot());
    stores.history.pushSnapshot(
      makeSnapshot({ actionLabel: "Old undo" }),
    );
    stores.history.beginEdit("tile-1", makeSnapshot());
    stores.history.beginMove(makeSnapshot());
    stores.history.beginResize(makeSnapshot());
    stores.viewport.setForcedBreakpoint("md");
    stores.viewport.setDisplayPositions([
      { i: "tile-1", x: 1, y: 2, w: 3, h: 4 },
    ]);
    stores.uploads.setTileUploading("tile-1", 0.5);
    stores.uploads.setResolvedUrl("tile-1", "url");
    stores.uploads.setResolvedDocumentItemUrl(
      "tile-1",
      "item-1",
      "document-url",
    );
    stores.ui.setPanelActive("tile-1", "settings");
    stores.ui.setPendingFocusTileId("tile-1");
    stores.ui.setShowMetaData(true);

    controller.clearSession();

    expect(stores.session.currentGrid).toBeNull();
    expect(stores.history.manager).toBeNull();
    expect(stores.history.stableSnapshot).toBeNull();
    expect(stores.history.editingTileId).toBeNull();
    expect(stores.history.pendingEditSnapshot).toBeNull();
    expect(stores.history.pendingMoveSnapshot).toBeNull();
    expect(stores.history.pendingResizeSnapshot).toBeNull();
    expect(stores.history.undoRedoStacks).toEqual({
      undoStack: [],
      redoStack: [],
    });
    expect(stores.viewport.forcedBreakpoint).toBeNull();
    expect(stores.viewport.displayPositions).toEqual([]);
    expect(stores.uploads.uploadingTiles).toEqual({});
    expect(stores.uploads.resolvedUrls).toEqual({});
    expect(stores.uploads.resolvedDocumentItemUrls).toEqual({});
    expect(stores.ui.activeTileId).toBeNull();
    expect(stores.ui.activePanelId).toBeNull();
    expect(stores.ui.pendingFocusTileId).toBeNull();
    expect(stores.ui.showMetaData).toBe(true);
  });

  describe("startPreview", () => {
    it("previews the current grid and makes it read-only", () => {
      const { controller, stores } = createControllerHarness();
      stores.session.setCurrentGrid(makeGrid({ id: "grid-1" }));
      stores.session.setOwner(true);
      expect(controller.canEditCurrentGrid()).toBe(true);

      controller.startPreview("mobile-breakpoint");

      expect(stores.preview.activePreview).toEqual({
        kind: "mobile-breakpoint",
        gridId: "grid-1",
      });
      // The whole point of preview: read-only at every breakpoint, not just the
      // ones wider than the viewport.
      expect(controller.canEditCurrentGrid()).toBe(false);
    });

    it("restores editing when the preview stops", () => {
      const { controller, stores } = createControllerHarness();
      stores.session.setCurrentGrid(makeGrid());
      stores.session.setOwner(true);
      controller.startPreview("mobile-breakpoint");

      controller.stopPreview();

      expect(stores.preview.activePreview).toBeNull();
      expect(controller.canEditCurrentGrid()).toBe(true);
    });

    it("ignores a preview request with no grid loaded", () => {
      const { controller, stores } = createControllerHarness();

      controller.startPreview("mobile-breakpoint");

      expect(stores.preview.activePreview).toBeNull();
    });

    it("keeps breakpoint inspection working while previewing", () => {
      // Forcing a breakpoint is how preview does its job, so it has to stay
      // available even though preview blocks user mutations.
      const { controller, stores } = createControllerHarness();
      stores.session.setCurrentGrid(makeGrid());
      stores.session.setOwner(true);
      controller.startPreview("mobile-breakpoint");

      controller.setForcedBreakpoint("sm");

      expect(stores.viewport.forcedBreakpoint).toBe("sm");
    });
  });

  it("refreshes stable history when forcing a breakpoint", () => {
    const { controller, stores } = createControllerHarness();
    const grid = makeGrid();
    stores.session.setCurrentGrid(grid);

    controller.setForcedBreakpoint("sm");

    expect(stores.viewport.forcedBreakpoint).toBe("sm");
    expect(stores.history.stableSnapshot).toEqual(
      expect.objectContaining({
        forcedBreakpoint: "sm",
        actionLabel: "",
      }),
    );
  });

  it("schedules one scoped snapshot and tracks persistence status", async () => {
    const { controller, stores, persistenceScheduler } =
      createControllerHarness();
    const grid = makeGrid({ id: "grid-1", name: "Before" });
    stores.session.setCurrentGrid(grid);
    stores.session.setOwner(true);
    const generation = stores.session.sessionGeneration;

    controller.scheduleSave();

    expect(persistenceScheduler.schedule).toHaveBeenCalledTimes(1);
    expect(persistenceScheduler.schedule).toHaveBeenCalledWith(
      { gridId: "grid-1", sessionGeneration: generation },
      expect.objectContaining({
        id: "grid-1",
        name: "Before",
      }),
    );
    expect(stores.session.persistenceStatus).toBe("saving");

    await Promise.resolve();

    expect(stores.session.persistenceStatus).toBe("idle");
    expect(stores.session.persistenceError).toBeNull();
  });

  describe("deferred chat-tile cleanup", () => {
    function chatTile(i: string): Tile {
      return {
        i,
        x: 0,
        y: 0,
        w: 2,
        h: 2,
        caption: "",
        content: { type: ContentType.CHAT, messages: [] } as ChatContent,
      };
    }

    function seedChatGrid() {
      const harness = createControllerHarness();
      harness.stores.session.setCurrentGrid(
        makeGrid({ id: "grid-1", tiles: [chatTile("chat-1")] }),
      );
      harness.stores.session.setOwner(true);
      harness.stores.history.initializeManager();
      return harness;
    }

    it("does not delete messages while the removed tile is still undo-restorable", async () => {
      const { controller, chatService } = seedChatGrid();

      controller.removeTile("chat-1");
      // Let the save-commit GC tick run; the removal snapshot still references
      // chat-1, so the tile is skipped.
      await Promise.resolve();
      await Promise.resolve();

      expect(chatService.deleteAllMessages).not.toHaveBeenCalled();
    });

    it("hard-deletes a removed chat tile's messages on session teardown", () => {
      const { controller, chatService } = seedChatGrid();

      controller.removeTile("chat-1");
      controller.clearSession();

      expect(chatService.deleteAllMessages).toHaveBeenCalledTimes(1);
      expect(chatService.deleteAllMessages).toHaveBeenCalledWith(
        "grid-1",
        "chat-1",
      );
    });

    it("keeps messages when an undo restores the chat tile before teardown", async () => {
      const { controller, stores, chatService } = seedChatGrid();

      controller.removeTile("chat-1");
      await controller.undo();
      expect(stores.session.currentGrid?.tiles.map((t) => t.i)).toContain(
        "chat-1",
      );

      controller.clearSession();

      expect(chatService.deleteAllMessages).not.toHaveBeenCalled();
    });

    it("drops a restored tile's pending entry at teardown so a later session can't stale-delete it", async () => {
      const { controller, stores, chatService } = seedChatGrid();

      // Remove then undo-restore chat-1, so it is live again at teardown.
      controller.removeTile("chat-1");
      await controller.undo();
      expect(stores.session.currentGrid?.tiles.map((t) => t.i)).toContain(
        "chat-1",
      );
      controller.clearSession();
      expect(chatService.deleteAllMessages).not.toHaveBeenCalled();

      // Re-enter the same grid id in a fresh session where chat-1 is gone and
      // was never removed here. A lingering pending entry from the prior
      // session would wrongly reclaim it now.
      stores.session.setCurrentGrid(makeGrid({ id: "grid-1", tiles: [] }));
      stores.session.setOwner(true);
      stores.history.initializeManager();

      controller.clearSession();

      expect(chatService.deleteAllMessages).not.toHaveBeenCalled();
    });

    it("does not reclaim a tile pending under a different grid than the current one", async () => {
      const { controller, stores, chatService } = seedChatGrid();

      controller.removeTile("chat-1"); // pending is keyed under grid-1
      await Promise.resolve();
      await Promise.resolve();

      // Move to a different grid with a fresh (empty) history, then flush. The
      // per-grid keying means grid-1's pending entry is never evaluated against
      // grid-2 — a flat tileId set would wrongly delete it here.
      stores.session.setCurrentGrid(makeGrid({ id: "grid-2", tiles: [] }));
      stores.session.setOwner(true);
      stores.history.initializeManager();

      controller.scheduleSave();
      await Promise.resolve();
      await Promise.resolve();

      expect(chatService.deleteAllMessages).not.toHaveBeenCalled();
    });

    it("reclaims only the still-unreachable tile among several pending", async () => {
      const { controller, stores, chatService } = createControllerHarness();
      stores.session.setCurrentGrid(
        makeGrid({
          id: "grid-1",
          tiles: [chatTile("chat-1"), chatTile("chat-2")],
        }),
      );
      stores.session.setOwner(true);
      stores.history.initializeManager();

      controller.removeTile("chat-1");
      controller.removeTile("chat-2");
      // Undo restores chat-2 to the live grid; chat-1 stays removed.
      await controller.undo();

      controller.clearSession();

      expect(chatService.deleteAllMessages).toHaveBeenCalledTimes(1);
      expect(chatService.deleteAllMessages).toHaveBeenCalledWith(
        "grid-1",
        "chat-1",
      );
    });

    it("swallows a rejected message deletion at teardown without throwing", async () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const { controller, chatService } = seedChatGrid();
      vi.mocked(chatService.deleteAllMessages).mockRejectedValueOnce(
        new Error("delete failed"),
      );

      controller.removeTile("chat-1");

      expect(() => controller.clearSession()).not.toThrow();
      await Promise.resolve();
      expect(chatService.deleteAllMessages).toHaveBeenCalledWith(
        "grid-1",
        "chat-1",
      );
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  it("ignores stale persistence failures after the active session changes", async () => {
    const { controller, stores, persistenceScheduler } =
      createControllerHarness();
    const flushGate = deferred<Grid | null>();
    vi.mocked(persistenceScheduler.flush).mockReturnValueOnce(
      flushGate.promise,
    );
    stores.session.setCurrentGrid(makeGrid({ id: "old-grid" }));
    stores.session.setOwner(true);

    controller.scheduleSave();
    stores.session.setCurrentGrid(makeGrid({ id: "new-grid" }));
    flushGate.reject(new Error("stale save failed"));
    await Promise.resolve();

    expect(stores.session.currentGrid?.id).toBe("new-grid");
    expect(stores.session.persistenceError).toBeNull();
  });

  it("waits for both the minimum delay and rendered target layout before applying a cross-breakpoint snapshot", async () => {
    const { controller, stores, dependencies } =
      createControllerHarness();
    const delayGate = deferred<void>();
    const readinessGate = deferred<void>();
    const waitForLayoutReady = vi.fn(
      () => readinessGate.promise,
    );
    const applySnapshot = vi.spyOn(
      dependencies.snapshotCodec,
      "apply",
    );
    vi.mocked(dependencies.delay).mockReturnValue(
      delayGate.promise,
    );
    stores.session.setCurrentGrid(makeGrid());
    stores.viewport.setForcedBreakpoint("lg");
    controller.registerLayoutReadinessAdapter({
      waitForLayoutReady,
    });

    const applying = controller.applySnapshot(
      makeSnapshot({
        forcedBreakpoint: "sm",
        verticalCompact: false,
      }),
    );

    expect(stores.viewport.forcedBreakpoint).toBe("sm");
    expect(dependencies.delay).toHaveBeenCalledWith(500);
    expect(waitForLayoutReady).toHaveBeenCalledWith("sm");
    expect(applySnapshot).not.toHaveBeenCalled();

    delayGate.resolve();
    await Promise.resolve();
    expect(applySnapshot).not.toHaveBeenCalled();

    readinessGate.resolve();
    await applying;

    expect(applySnapshot).toHaveBeenCalledTimes(1);
    expect(stores.session.currentGrid?.verticalCompact).toBe(false);
  });

  it("disposes only the currently registered layout readiness adapter", async () => {
    const { controller, stores } = createControllerHarness();
    const staleWait = vi.fn(async () => undefined);
    const currentWait = vi.fn(async () => undefined);
    stores.session.setCurrentGrid(makeGrid());
    stores.viewport.setForcedBreakpoint("lg");

    const disposeStale =
      controller.registerLayoutReadinessAdapter({
        waitForLayoutReady: staleWait,
      });
    const disposeCurrent =
      controller.registerLayoutReadinessAdapter({
        waitForLayoutReady: currentWait,
      });
    disposeStale();

    await controller.applySnapshot(
      makeSnapshot({ forcedBreakpoint: "sm" }),
    );

    expect(staleWait).not.toHaveBeenCalled();
    expect(currentWait).toHaveBeenCalledWith("sm");

    disposeCurrent();
    stores.viewport.setForcedBreakpoint("lg");
    await controller.applySnapshot(
      makeSnapshot({ forcedBreakpoint: "sm" }),
    );
    expect(currentWait).toHaveBeenCalledTimes(1);
  });

  it("stores resolved upload URLs before patching every history snapshot", () => {
    const { controller, stores } = createControllerHarness();
    const setMedia = vi.spyOn(stores.uploads, "setResolvedUrl");
    const setDocument = vi.spyOn(
      stores.uploads,
      "setResolvedDocumentItemUrl",
    );
    const replaceHistory = vi.spyOn(
      stores.history,
      "replaceBlobUrl",
    );

    controller.setResolvedUrl("tile-1", "https://cdn/media");
    controller.setResolvedDocumentItemUrl(
      "tile-2",
      "item-1",
      "https://cdn/document",
    );

    expect(stores.uploads.resolvedUrls).toEqual({
      "tile-1": "https://cdn/media",
    });
    expect(stores.uploads.resolvedDocumentItemUrls).toEqual({
      "tile-2": { "item-1": "https://cdn/document" },
    });
    expect(replaceHistory).toHaveBeenNthCalledWith(
      1,
      "tile-1",
      "https://cdn/media",
    );
    expect(replaceHistory).toHaveBeenNthCalledWith(
      2,
      "tile-2",
      "https://cdn/document",
      "item-1",
    );
    expect(setMedia.mock.invocationCallOrder[0]).toBeLessThan(
      replaceHistory.mock.invocationCallOrder[0]!,
    );
    expect(setDocument.mock.invocationCallOrder[0]).toBeLessThan(
      replaceHistory.mock.invocationCallOrder[1]!,
    );
  });

  it("captures upload scope and resolves active uploads through history and persistence", () => {
    const { controller, stores, persistenceScheduler } =
      createControllerHarness();
    const replaceHistory = vi.spyOn(
      stores.history,
      "replaceBlobUrl",
    );
    const resolveUpload = vi.spyOn(stores.uploads, "resolveUpload");
    stores.session.setCurrentGrid(
      makeGrid({
        tiles: [
          {
            i: "tile-1",
            x: 0,
            y: 0,
            w: 2,
            h: 2,
            caption: "",
            content: {
              type: ContentType.IMAGE,
              src: "blob:media",
              zoom: 1,
              offsetX: 0,
              offsetY: 0,
            } as ImageContent,
          },
        ],
      }),
    );
    stores.session.setOwner(true);

    const uploadId = controller.startUpload({
      tileId: "tile-1",
      ownedObjectUrl: "blob:media",
      progress: 0,
    });

    expect(uploadId).toBe("upload-1");
    expect(stores.uploads.uploadRecords["upload-1"]).toEqual(
      expect.objectContaining({
        gridId: "grid-1",
        sessionGeneration: stores.session.sessionGeneration,
        tileId: "tile-1",
        generation: 1,
        status: "active",
      }),
    );

    expect(controller.progressUpload("upload-1", 0.5)).toBe(true);
    expect(stores.uploads.uploadingTiles).toEqual({ "tile-1": 0.5 });

    expect(controller.resolveUpload("upload-1", "https://cdn/media")).toBe(
      true,
    );
    expect(stores.uploads.resolvedUrls).toEqual({
      "tile-1": "https://cdn/media",
    });
    expect(replaceHistory).toHaveBeenCalledWith(
      "tile-1",
      "https://cdn/media",
    );
    expect(persistenceScheduler.schedule).toHaveBeenCalledOnce();
    expect(resolveUpload.mock.invocationCallOrder[0]).toBeLessThan(
      replaceHistory.mock.invocationCallOrder[0]!,
    );
    expect(replaceHistory.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(persistenceScheduler.schedule).mock.invocationCallOrder[0]!,
    );
  });

  it("abandons stale upload callbacks without history or persistence changes", () => {
    const { controller, stores, persistenceScheduler } =
      createControllerHarness();
    const replaceHistory = vi.spyOn(
      stores.history,
      "replaceBlobUrl",
    );
    const abandonUpload = vi.spyOn(stores.uploads, "abandonUpload");
    stores.session.setCurrentGrid(
      makeGrid({
        tiles: [
          {
            i: "tile-1",
            x: 0,
            y: 0,
            w: 2,
            h: 2,
            caption: "",
            content: {
              type: ContentType.IMAGE,
              src: "blob:media",
              zoom: 1,
              offsetX: 0,
              offsetY: 0,
            } as ImageContent,
          },
        ],
      }),
    );
    stores.session.setOwner(true);
    const uploadId = controller.startUpload({ tileId: "tile-1" });
    expect(uploadId).toBe("upload-1");

    stores.session.setCurrentGrid(makeGrid({ id: "grid-2" }));

    expect(controller.resolveUpload("upload-1", "https://cdn/media")).toBe(
      false,
    );
    expect(abandonUpload).toHaveBeenCalledWith("upload-1");
    expect(stores.uploads.resolvedUrls).toEqual({});
    expect(replaceHistory).not.toHaveBeenCalled();
    expect(persistenceScheduler.schedule).not.toHaveBeenCalled();
  });

  it("delegates owned object URL revocation to the uploads ledger", () => {
    const { controller, stores } = createControllerHarness();
    const revoke = vi
      .spyOn(stores.uploads, "revokeOwnedObjectUrl")
      .mockReturnValue(true);

    expect(controller.revokeOwnedObjectUrl("blob:owned")).toBe(true);
    expect(revoke).toHaveBeenCalledWith("blob:owned");
  });

  it("owns load error sequencing for direct controller callers", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stores.session.setLoadError("previous failure");
    vi.mocked(gridService.fetchGrid).mockRejectedValueOnce(
      new Error("load failed"),
    );

    const loading = controller.loadGrid("grid-1");

    expect(stores.session.loadError).toBeNull();
    await loading;
    expect(stores.session.loadError).toBe("Failed to load grid.");
  });

  it("deletes an owned grid and clears the matching active session", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    const owned = makeGrid({ id: "owned" });
    const other = makeGrid({ id: "other" });
    stores.collection.setGrids([owned, other]);
    stores.session.setCurrentGrid(owned);
    stores.history.initializeManager();

    await controller.deleteGrid("owned");

    expect(gridService.deleteGrid).toHaveBeenCalledWith("owned");
    expect(stores.collection.grids).toEqual([other]);
    expect(stores.session.currentGrid).toBeNull();
    expect(stores.history.manager).toBeNull();
  });

  it("invokes the explicit clearActiveGrid callback instead of clearing the session", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    const owned = makeGrid({ id: "owned" });
    stores.collection.setGrids([owned]);
    // A different grid is active, so the fallback path would not clear it; the
    // explicit callback must be used for the deleted grid that the caller owns.
    stores.session.setCurrentGrid(makeGrid({ id: "active" }));
    stores.history.initializeManager();
    const clearActiveGrid = vi.fn();

    await controller.deleteGrid("owned", owned, clearActiveGrid);

    expect(gridService.deleteGrid).toHaveBeenCalledWith("owned");
    expect(clearActiveGrid).toHaveBeenCalledTimes(1);
    // The session was not the deleted grid and must remain untouched.
    expect(stores.session.currentGrid?.id).toBe("active");
    expect(stores.history.manager).not.toBeNull();
  });

  it("does not delete missing, unauthenticated, or foreign grids", async () => {
    const {
      controller,
      stores,
      gridService,
      authProvider,
    } = createControllerHarness();
    stores.collection.setGrids([
      makeGrid({ id: "foreign", userId: "other-user" }),
    ]);

    await controller.deleteGrid("missing");
    await controller.deleteGrid("foreign");
    vi.mocked(authProvider.getCurrentUserId).mockReturnValueOnce(null);
    stores.collection.setGrids([makeGrid({ id: "owned" })]);
    await controller.deleteGrid("owned");

    expect(gridService.deleteGrid).not.toHaveBeenCalled();
  });

  it("records deletion failures without changing state", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const owned = makeGrid({ id: "owned" });
    stores.collection.setGrids([owned]);
    stores.session.setCurrentGrid(owned);
    vi.mocked(gridService.deleteGrid).mockRejectedValueOnce(
      new Error("delete failed"),
    );

    await controller.deleteGrid("owned");

    expect(stores.collection.grids).toEqual([owned]);
    expect(stores.session.currentGrid).toEqual(owned);
    expect(stores.collection.error).toBe("Failed to delete grid.");
  });
});

describe("useGridController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultDependencyHarness.getServiceFactory.mockReset();
    defaultDependencyHarness.getAuthProvider.mockReset();
  });

  it("returns one controller per Pinia and isolates different Pinia instances", () => {
    const firstPinia = createPinia();
    const secondPinia = createPinia();

    const first = useGridController(firstPinia);
    const firstAgain = useGridController(firstPinia);
    const second = useGridController(secondPinia);

    expect(firstAgain).toBe(first);
    expect(second).not.toBe(first);

    const firstUi = useGridUiStore(firstPinia);
    const secondUi = useGridUiStore(secondPinia);
    const firstHistory = useGridHistoryStore(firstPinia);
    const secondHistory = useGridHistoryStore(secondPinia);
    firstHistory.initializeManager();
    secondHistory.initializeManager();
    firstUi.setPendingFocusTileId("first");
    secondUi.setPendingFocusTileId("second");

    expect(firstHistory).not.toBe(secondHistory);
    expect(firstHistory.manager).not.toBe(secondHistory.manager);

    first.clearSession();

    expect(firstUi.pendingFocusTileId).toBeNull();
    expect(secondUi.pendingFocusTileId).toBe("second");
    expect(firstHistory.manager).toBeNull();
    expect(secondHistory.manager).not.toBeNull();
  });

  it("uses the active Pinia when one is not passed", () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    expect(useGridController()).toBe(useGridController(pinia));
  });

  it("does not resolve service or auth singletons during construction", () => {
    const pinia = createPinia();

    useGridController(pinia);

    expect(
      defaultDependencyHarness.getServiceFactory,
    ).not.toHaveBeenCalled();
    expect(
      defaultDependencyHarness.getAuthProvider,
    ).not.toHaveBeenCalled();
  });
});
