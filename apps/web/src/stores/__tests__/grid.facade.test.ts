import { computed, nextTick, watch } from "vue";
import { storeToRefs } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AnyTileContent,
  type Breakpoint,
  type CopyDepth,
  type DocumentItem,
  type Grid,
  type TileContent,
  type TilePosition,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import type { Snapshot } from "@/undo/UndoTypes";
import { useGridCollectionStore } from "@/stores/grid/gridCollection";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridUploadsStore } from "@/stores/grid/gridUploads";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import {
  createGridStore,
  gridHarness,
  makeGrid,
  resetGridHarness,
} from "./gridTestHarness";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const legacyStateMembers = [
  "undoRedoVersion",
  "grids",
  "currentGrid",
  "isLoading",
  "error",
  "showMetaData",
  "showMetaDataVerbose",
  "isOwner",
  "isDemoGrid",
  "recentGridIds",
  "activeTileId",
  "activePanelId",
  "uploadingTiles",
  "resolvedUrls",
  "resolvedDocumentItemUrls",
  "pendingFocusTileId",
  "activeBreakpoint",
  "viewportBreakpoint",
  "forcedBreakpoint",
  "displayPositions",
] as const;

const legacyGetters = [
  "verticalCompact",
  "canEdit",
  "canUndo",
  "canRedo",
  "undoActionLabel",
  "redoActionLabel",
  "undoRedoStacks",
] as const;

const legacyActions = [
  "setMenuActive",
  "setPanelActive",
  "toggleMenuActive",
  "togglePanelActive",
  "closeMenus",
  "captureSnapshot",
  "refreshStableSnapshot",
  "pushUndoSnapshot",
  "undo",
  "redo",
  "undoRedoUntil",
  "applySnapshot",
  "beginEditing",
  "commitEditing",
  "beginMove",
  "commitMove",
  "beginResize",
  "commitResize",
  "setTileUploading",
  "clearTileUploading",
  "setResolvedUrl",
  "setResolvedDocumentItemUrl",
  "getResolvedUrl",
  "clearResolvedUrl",
  "clearResolvedDocumentItemsForTile",
  "fetchGrids",
  "createGrid",
  "duplicateGrid",
  "loadGrid",
  "loadDemoGrid",
  "recordRecent",
  "loadRecents",
  "saveRecents",
  "checkShowMetaDataCookie",
  "setShowMetaData",
  "setShowMetaDataVerbose",
  "toggleVerticalCompact",
  "setVerticalCompact",
  "getCookieValue",
  "setCookieValue",
  "saveGrid",
  "addTile",
  "setTileContent",
  "patchTileContent",
  "patchDocumentItem",
  "setGridTheme",
  "setDuplicatable",
  "addBackgroundImage",
  "removeBackgroundImage",
  "setCustomOgImage",
  "removeCustomOgImage",
  "setBackgroundColor",
  "removeBackgroundColor",
  "getViewportGridY",
  "duplicateTile",
  "removeTile",
  "resizeTile",
  "toggleTileBorder",
  "toggleLinkBackground",
  "updateGrid",
  "setActiveBreakpoint",
  "setViewportBreakpoint",
  "setForcedBreakpoint",
  "setDisplayPositions",
  "getBreakpointPositions",
  "hasBreakpointOverride",
  "updateBreakpointOverride",
  "saveBreakpointPositions",
  "resetBreakpoint",
  "clearCurrentGrid",
  "deleteGrid",
  "renameGrid",
] as const;

interface LegacyGridFacadeContract {
  undoRedoVersion: number;
  grids: Grid[];
  currentGrid: Grid | null;
  isLoading: boolean;
  error: string | null;
  showMetaData: boolean;
  showMetaDataVerbose: boolean;
  isOwner: boolean;
  isDemoGrid: boolean;
  recentGridIds: string[];
  activeTileId: string | null;
  activePanelId: string | null;
  uploadingTiles: Record<string, number>;
  resolvedUrls: Record<string, string>;
  resolvedDocumentItemUrls: Record<string, Record<string, string>>;
  pendingFocusTileId: string | null;
  activeBreakpoint: Breakpoint;
  viewportBreakpoint: Breakpoint;
  forcedBreakpoint: Breakpoint | null;
  displayPositions: GridLayoutItem[];
  readonly verticalCompact: boolean;
  readonly canEdit: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoActionLabel: string | null;
  readonly redoActionLabel: string | null;
  readonly undoRedoStacks: {
    undoStack: {
      actionLabel: string;
      timestamp: number;
      snapshotId: number;
    }[];
    redoStack: {
      actionLabel: string;
      timestamp: number;
      snapshotId: number;
    }[];
  };
  setMenuActive(tileId: string): void;
  setPanelActive(tileId: string, panelId: string): void;
  toggleMenuActive(tileId: string): void;
  togglePanelActive(tileId: string, panelId: string): void;
  closeMenus(): void;
  captureSnapshot(actionLabel: string): Snapshot | null;
  refreshStableSnapshot(): void;
  pushUndoSnapshot(actionLabel: string): void;
  undo(): Promise<void>;
  redo(): Promise<void>;
  undoRedoUntil(snapshotId: number): Promise<void>;
  applySnapshot(snapshot: Snapshot): Promise<void>;
  beginEditing(tileId: string): void;
  commitEditing(): void;
  beginMove(): void;
  commitMove(): void;
  beginResize(): void;
  commitResize(): void;
  setTileUploading(tileId: string, progress: number): void;
  clearTileUploading(tileId: string): void;
  setResolvedUrl(tileId: string, url: string): void;
  setResolvedDocumentItemUrl(
    tileId: string,
    itemId: string,
    url: string,
  ): void;
  getResolvedUrl(tileId: string): string | undefined;
  clearResolvedUrl(tileId: string): void;
  clearResolvedDocumentItemsForTile(tileId: string): void;
  fetchGrids(): Promise<void>;
  createGrid(name: string): Promise<string | null>;
  duplicateGrid(
    sourceGrid: Grid,
    copyDepth?: CopyDepth,
  ): Promise<string | null>;
  loadGrid(id: string): Promise<void>;
  loadDemoGrid(grid: Grid): void;
  recordRecent(id: string): void;
  loadRecents(): Promise<void>;
  saveRecents(): Promise<void>;
  checkShowMetaDataCookie(): void;
  setShowMetaData(value: boolean): void;
  setShowMetaDataVerbose(value: boolean): void;
  toggleVerticalCompact(): void;
  setVerticalCompact(value: boolean): void;
  getCookieValue(name: string): string | null;
  setCookieValue(name: string, value: string, days?: number): void;
  saveGrid(): Promise<void>;
  addTile(content: TileContent): string | null;
  setTileContent(id: string, content: TileContent): void;
  patchTileContent(id: string, patch: Partial<AnyTileContent>): void;
  patchDocumentItem(
    tileId: string,
    itemId: string,
    itemPatch: Partial<DocumentItem>,
  ): void;
  setGridTheme(themeId: string): void;
  setDuplicatable(value: boolean): void;
  addBackgroundImage(url: string, embed: boolean): void;
  removeBackgroundImage(): void;
  setCustomOgImage(url: string): void;
  removeCustomOgImage(): void;
  setBackgroundColor(color: string): void;
  removeBackgroundColor(): void;
  getViewportGridY(): number;
  duplicateTile(id: string): string | null;
  removeTile(id: string): void;
  resizeTile(id: string, w: number, h: number): void;
  toggleTileBorder(id: string): void;
  toggleLinkBackground(id: string): void;
  updateGrid(): void;
  setActiveBreakpoint(bp: Breakpoint): void;
  setViewportBreakpoint(bp: Breakpoint): void;
  setForcedBreakpoint(bp: Breakpoint | null): void;
  setDisplayPositions(positions: GridLayoutItem[]): void;
  getBreakpointPositions(
    bp: Breakpoint,
  ): Record<string, TilePosition> | undefined;
  hasBreakpointOverride(bp: Breakpoint): boolean;
  updateBreakpointOverride(): void;
  saveBreakpointPositions(bp: Breakpoint, tiles: GridLayoutItem[]): void;
  resetBreakpoint(bp: Breakpoint): void;
  clearCurrentGrid(): void;
  deleteGrid(id: string): Promise<void>;
  renameGrid(id: string, newName: string): Promise<void>;
}

function requireLegacyGridFacade(_store: LegacyGridFacadeContract): void {
  // Compile-time compatibility check for legacy argument and return types.
}

describe("grid store compatibility facade contract", () => {
  let store: Awaited<ReturnType<typeof createGridStore>>;

  beforeEach(async () => {
    resetGridHarness();
    store = await createGridStore();
  });

  it("exposes every legacy state member, getter, and action", () => {
    requireLegacyGridFacade(store);

    for (const member of [...legacyStateMembers, ...legacyGetters]) {
      expect(store).toHaveProperty(member);
    }
    for (const action of legacyActions) {
      expect(store[action]).toBeTypeOf("function");
    }
  });

  it("keeps every legacy state member directly writable", () => {
    const grid = makeGrid();
    const positions: GridLayoutItem[] = [
      { i: "tile-1", x: 1, y: 2, w: 3, h: 4 },
    ];

    store.undoRedoVersion = 4;
    store.grids = [grid];
    store.currentGrid = grid;
    store.isLoading = true;
    store.error = "contract error";
    store.showMetaData = true;
    store.showMetaDataVerbose = true;
    store.isOwner = true;
    store.isDemoGrid = true;
    store.recentGridIds = ["grid-1"];
    store.activeTileId = "tile-1";
    store.activePanelId = "settings";
    store.uploadingTiles = { "tile-1": 0.5 };
    store.resolvedUrls = { "tile-1": "https://example.com/media" };
    store.resolvedDocumentItemUrls = {
      "tile-1": { "item-1": "https://example.com/document" },
    };
    store.pendingFocusTileId = "tile-1";
    store.activeBreakpoint = "md";
    store.viewportBreakpoint = "sm";
    store.forcedBreakpoint = "lg";
    store.displayPositions = positions;

    expect(
      legacyStateMembers.map((member) => store[member]),
    ).toEqual([
      4,
      [grid],
      grid,
      true,
      "contract error",
      true,
      true,
      true,
      true,
      ["grid-1"],
      "tile-1",
      "settings",
      { "tile-1": 0.5 },
      { "tile-1": "https://example.com/media" },
      {
        "tile-1": { "item-1": "https://example.com/document" },
      },
      "tile-1",
      "md",
      "sm",
      "lg",
      positions,
    ]);
  });

  it("writes facade state directly through to each focused owner", () => {
    const grid = makeGrid();
    const positions: GridLayoutItem[] = [
      { i: "tile-1", x: 1, y: 2, w: 3, h: 4 },
    ];

    store.grids = [grid];
    store.currentGrid = grid;
    store.isOwner = true;
    store.pendingFocusTileId = "tile-1";
    store.uploadingTiles = { "tile-1": 0.5 };
    store.forcedBreakpoint = "sm";
    store.displayPositions = positions;
    store.undoRedoVersion = 7;

    expect(useGridCollectionStore().grids).toEqual([grid]);
    expect(useGridSessionStore().currentGrid).toEqual(grid);
    expect(useGridSessionStore().isOwner).toBe(true);
    expect(useGridUiStore().pendingFocusTileId).toBe("tile-1");
    expect(useGridUploadsStore().uploadingTiles).toEqual({
      "tile-1": 0.5,
    });
    expect(useGridViewportStore().forcedBreakpoint).toBe("sm");
    expect(useGridViewportStore().displayPositions).toEqual(positions);
    expect(useGridHistoryStore().stackVersion).toBe(7);
  });

  it("delegates representative facade actions exactly once and preserves results", () => {
    const ui = useGridUiStore();
    const viewport = useGridViewportStore();
    const uploads = useGridUploadsStore();
    const setMenuActive = vi.spyOn(ui, "setMenuActive");
    const setActiveBreakpoint = vi.spyOn(
      viewport,
      "setActiveBreakpoint",
    );
    const setTileUploading = vi.spyOn(
      uploads,
      "setTileUploading",
    );
    const getResolvedUrl = vi.spyOn(uploads, "getResolvedUrl");
    uploads.setResolvedUrl("tile-1", "https://cdn/media");

    store.setMenuActive("tile-1");
    store.setActiveBreakpoint("md");
    store.setTileUploading("tile-1", 0.75);
    const resolvedUrl = store.getResolvedUrl("tile-1");

    expect(setMenuActive).toHaveBeenCalledOnce();
    expect(setMenuActive).toHaveBeenCalledWith("tile-1");
    expect(setActiveBreakpoint).toHaveBeenCalledOnce();
    expect(setActiveBreakpoint).toHaveBeenCalledWith("md");
    expect(setTileUploading).toHaveBeenCalledOnce();
    expect(setTileUploading).toHaveBeenCalledWith("tile-1", 0.75);
    expect(getResolvedUrl).toHaveBeenCalledOnce();
    expect(getResolvedUrl).toHaveBeenCalledWith("tile-1");
    expect(resolvedUrl).toBe("https://cdn/media");
    expect(store.activeTileId).toBe("tile-1");
    expect(store.activeBreakpoint).toBe("md");
    expect(store.uploadingTiles).toEqual({ "tile-1": 0.75 });
  });

  it("keeps all seven getters reactive through storeToRefs", async () => {
    gridHarness.gridService.fetchGrid.mockResolvedValueOnce(
      makeGrid({ verticalCompact: false }),
    );
    await store.loadGrid("grid-1");

    const refs = storeToRefs(store);
    expect(refs.verticalCompact.value).toBe(false);
    expect(refs.canEdit.value).toBe(true);
    expect(refs.canUndo.value).toBe(false);
    expect(refs.canRedo.value).toBe(false);
    expect(refs.undoActionLabel.value).toBeNull();
    expect(refs.redoActionLabel.value).toBeNull();
    expect(refs.undoRedoStacks.value).toEqual({
      undoStack: [],
      redoStack: [],
    });

    store.currentGrid!.verticalCompact = true;
    refs.viewportBreakpoint.value = "sm";
    refs.forcedBreakpoint.value = "md";
    store.pushUndoSnapshot("Facade contract");
    await nextTick();

    expect(refs.verticalCompact.value).toBe(true);
    expect(refs.canEdit.value).toBe(false);
    expect(refs.canUndo.value).toBe(true);
    expect(refs.undoActionLabel.value).toBe("Facade contract");
    expect(refs.undoRedoStacks.value.undoStack).toHaveLength(1);

    refs.forcedBreakpoint.value = null;
    await store.undo();
    await nextTick();

    expect(refs.canUndo.value).toBe(false);
    expect(refs.canRedo.value).toBe(true);
    expect(refs.undoActionLabel.value).toBeNull();
    expect(refs.redoActionLabel.value).toBe("Facade contract");
    expect(refs.undoRedoStacks.value.redoStack).toHaveLength(1);
  });

  it("keeps ordinary computed reads reactive to nested canonical writes", async () => {
    store.currentGrid = makeGrid({ name: "Before" });
    const currentName = computed(() => store.currentGrid?.name ?? null);
    const observedNames: Array<string | null> = [];
    const stop = watch(currentName, (name) => observedNames.push(name));

    store.currentGrid.name = "After";
    await nextTick();

    expect(currentName.value).toBe("After");
    expect(observedNames).toEqual(["After"]);
    stop();
  });

  it("preserves promise and return-value behavior for async actions", async () => {
    const sourceGrid = makeGrid({ id: "source-grid" });
    const asyncCalls = [
      { call: () => store.undo(), expected: undefined },
      { call: () => store.redo(), expected: undefined },
      { call: () => store.undoRedoUntil(1), expected: undefined },
      {
        call: () => store.applySnapshot({} as Snapshot),
        expected: undefined,
      },
      { call: () => store.fetchGrids(), expected: undefined },
      { call: () => store.createGrid("Created"), expected: "created-grid" },
      {
        call: () => store.duplicateGrid(sourceGrid),
        expected: "cloned-grid",
      },
      { call: () => store.loadGrid("grid-1"), expected: undefined },
      { call: () => store.loadRecents(), expected: undefined },
      { call: () => store.saveRecents(), expected: undefined },
      { call: () => store.saveGrid(), expected: undefined },
      { call: () => store.deleteGrid("created-grid"), expected: undefined },
      {
        call: () => store.renameGrid("cloned-grid", "Renamed"),
        expected: undefined,
      },
    ];

    for (const { call, expected } of asyncCalls) {
      const result = call();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBe(expected);
    }
  });

  it("retains the Pinia reset entry point across all focused owners", () => {
    store.currentGrid = makeGrid();
    store.isOwner = true;
    store.grids = [makeGrid()];
    store.pendingFocusTileId = "tile-1";
    store.forcedBreakpoint = "sm";
    store.uploadingTiles = { "tile-1": 0.5 };
    store.error = "failure";
    store.showMetaData = true;
    store.pushUndoSnapshot("Old history");

    store.$reset();

    expect(store.currentGrid).toBeNull();
    expect(store.isOwner).toBe(false);
    expect(store.grids).toEqual([]);
    expect(store.pendingFocusTileId).toBeNull();
    expect(store.forcedBreakpoint).toBeNull();
    expect(store.uploadingTiles).toEqual({});
    expect(store.error).toBeNull();
    expect(store.showMetaData).toBe(false);
    expect(store.canUndo).toBe(false);
    expect(useGridHistoryStore().manager).toBeNull();
    expect(useGridHistoryStore().stableSnapshot).toBeNull();
  });

  it("keeps facade loading active until every overlapping load finishes", async () => {
    const collectionRequest = deferred<ReturnType<typeof makeGrid>[]>();
    const sessionRequest = deferred<ReturnType<typeof makeGrid>>();
    gridHarness.gridService.fetchGridsByUserId.mockReturnValueOnce(
      collectionRequest.promise,
    );
    gridHarness.gridService.fetchGrid.mockReturnValueOnce(
      sessionRequest.promise,
    );

    const fetchPromise = store.fetchGrids();
    const loadPromise = store.loadGrid("grid-1");

    expect(store.isLoading).toBe(true);

    collectionRequest.resolve([]);
    await fetchPromise;

    expect(store.isLoading).toBe(true);

    sessionRequest.resolve(makeGrid());
    await loadPromise;

    expect(store.isLoading).toBe(false);
  });

  it("exposes the most recent failure write from overlapping operations", async () => {
    const collectionRequest = deferred<ReturnType<typeof makeGrid>[]>();
    const sessionRequest = deferred<ReturnType<typeof makeGrid>>();
    gridHarness.gridService.fetchGridsByUserId.mockReturnValueOnce(
      collectionRequest.promise,
    );
    gridHarness.gridService.fetchGrid.mockReturnValueOnce(
      sessionRequest.promise,
    );

    const fetchPromise = store.fetchGrids();
    const loadPromise = store.loadGrid("grid-1");

    sessionRequest.reject(new Error("load failed"));
    await loadPromise;
    expect(store.error).toBe("Failed to load grid.");

    collectionRequest.reject(new Error("collection failed"));
    await fetchPromise;
    expect(store.error).toBe("Failed to fetch grids.");
  });

  it("clears a prior legacy error when a later operation starts", async () => {
    const sessionRequest = deferred<ReturnType<typeof makeGrid>>();
    gridHarness.gridService.fetchGrid.mockReturnValueOnce(
      sessionRequest.promise,
    );
    gridHarness.gridService.fetchGridsByUserId.mockRejectedValueOnce(
      new Error("collection failed"),
    );

    await store.fetchGrids();
    expect(store.error).toBe("Failed to fetch grids.");

    const loadPromise = store.loadGrid("grid-1");
    expect(store.error).toBeNull();

    sessionRequest.resolve(makeGrid());
    await loadPromise;
    expect(store.error).toBeNull();
  });
});
