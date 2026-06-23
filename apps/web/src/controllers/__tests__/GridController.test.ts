import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPinia,
  setActivePinia,
  type Pinia,
} from "pinia";
import type { AuthProvider } from "@grids/contracts/auth";
import type { Grid } from "@grids/contracts/types";
import type { IAnalyticsService } from "@/services/interfaces/IAnalyticsService";
import type { IGridService } from "@/services/interfaces/IGridService";
import type { IGridPersistenceScheduler } from "@/services/interfaces/IGridPersistenceScheduler";
import { GridSnapshotCodec } from "@/undo/GridSnapshotCodec";
import type { Snapshot } from "@/undo/UndoTypes";
import { useGridCollectionStore } from "@/stores/grid/gridCollection";
import { useGridCompatibilityStore } from "@/stores/grid/gridCompatibility";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
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
    compatibility: useGridCompatibilityStore(pinia),
    history: useGridHistoryStore(pinia),
    session: useGridSessionStore(pinia),
    ui: useGridUiStore(pinia),
    uploads: useGridUploadsStore(pinia),
    viewport: useGridViewportStore(pinia),
    theme: useThemeStore(pinia),
    toast: useToastStore(pinia),
  };
}

function createGridServiceMock(): IGridService {
  return {
    fetchGrid: vi.fn(),
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
  const persistenceScheduler: IGridPersistenceScheduler = {
    schedule: vi.fn(),
    flush: vi.fn(async () => undefined),
  };
  const dependencies: GridControllerDependencies = {
    getGridService: vi.fn(() => gridService),
    persistenceScheduler,
    getAuthProvider: vi.fn(() => authProvider),
    getAnalyticsService: vi.fn(
      () => ({}) as IAnalyticsService,
    ),
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
    expect(stores.compatibility.error).toBe("Failed to load grid.");
    expect(stores.session.isLoading).toBe(false);
    expect(gridService.touchLastOpenedAt).not.toHaveBeenCalled();
  });

  it("loads a demo after resetting session state without creating history", () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    stores.ui.setShowMetaData(true);
    stores.ui.setPanelActive("tile-1", "settings");
    stores.uploads.setTileUploading("tile-1", -1);
    stores.viewport.setForcedBreakpoint("sm");
    stores.history.initializeManager();
    const demo = makeGrid({ id: "demo", userId: "demo-user" });

    controller.loadDemoGrid(demo);

    expect(stores.session.currentGrid).toEqual(demo);
    expect(stores.session.isOwner).toBe(false);
    expect(stores.session.isDemoGrid).toBe(true);
    expect(stores.history.manager).toBeNull();
    expect(stores.viewport.forcedBreakpoint).toBeNull();
    expect(stores.uploads.uploadingTiles).toEqual({});
    expect(stores.ui.activePanelId).toBeNull();
    expect(stores.ui.showMetaData).toBe(true);
    expect(gridService.fetchGrid).not.toHaveBeenCalled();
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

  it("ignores stale persistence failures after the active session changes", async () => {
    const { controller, stores, persistenceScheduler } =
      createControllerHarness();
    const flushGate = deferred<void>();
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
    expect(stores.compatibility.error).toBeNull();
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

  it("owns compatibility error sequencing for direct controller callers", async () => {
    const { controller, stores, gridService } =
      createControllerHarness();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stores.compatibility.setError("previous failure");
    vi.mocked(gridService.fetchGrid).mockRejectedValueOnce(
      new Error("load failed"),
    );

    const loading = controller.loadGrid("grid-1");

    expect(stores.compatibility.error).toBeNull();
    await loading;
    expect(stores.compatibility.error).toBe("Failed to load grid.");

    controller.loadDemoGrid(makeGrid({ id: "demo" }));
    expect(stores.compatibility.error).toBeNull();
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
