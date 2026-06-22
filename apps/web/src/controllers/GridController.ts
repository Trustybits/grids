import type { AuthProvider } from "@grids/contracts/auth";
import {
  AnalyticsEventType,
  ContentType,
  type AnyTileContent,
  type Breakpoint,
  type CopyDepth,
  type DocumentItem,
  type DocumentsContent,
  type Grid,
  type LinkContent,
  type Tile,
  type TileContent,
  type TilePosition,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import type { IAnalyticsService } from "@/services/interfaces/IAnalyticsService";
import type { IGridService } from "@/services/interfaces/IGridService";
import { GridSnapshotCodec } from "@/undo/GridSnapshotCodec";
import type { Snapshot } from "@/undo/UndoTypes";
import type { useGridCollectionStore } from "@/stores/grid/gridCollection";
import type { useGridCompatibilityStore } from "@/stores/grid/gridCompatibility";
import type { useGridHistoryStore } from "@/stores/grid/gridHistory";
import type { useGridSessionStore } from "@/stores/grid/gridSession";
import type { useGridUiStore } from "@/stores/grid/gridUi";
import type { useGridUploadsStore } from "@/stores/grid/gridUploads";
import type { useGridViewportStore } from "@/stores/grid/gridViewport";
import type { useThemeStore } from "@/stores/theme";
import type { useToastStore } from "@/stores/toast";
import { breakpointRank } from "@/utils/BreakpointUtils";
import { createTile } from "@/utils/TileUtils";
import { getTileDefinition } from "@/registries/tileRegistry";
import {
  adjustTilePosition,
  findBestXAtRow,
  findFirstAvailableSpot,
  pushTilesForNewItem,
} from "@/utils/GridPlacementUtils";

export interface GridControllerStores {
  collection: ReturnType<typeof useGridCollectionStore>;
  compatibility: ReturnType<typeof useGridCompatibilityStore>;
  history: ReturnType<typeof useGridHistoryStore>;
  session: ReturnType<typeof useGridSessionStore>;
  ui: ReturnType<typeof useGridUiStore>;
  uploads: ReturnType<typeof useGridUploadsStore>;
  viewport: ReturnType<typeof useGridViewportStore>;
  theme: ReturnType<typeof useThemeStore>;
  toast: ReturnType<typeof useToastStore>;
}

export interface GridMetadataPreferences {
  showMetaData: boolean;
  showMetaDataVerbose: boolean;
}

export interface GridControllerDependencies {
  getGridService(): IGridService;
  getAuthProvider(): AuthProvider;
  getAnalyticsService(): IAnalyticsService;
  generateUuid(): string;
  delay(milliseconds: number): Promise<void>;
  now(): Date;
  measureViewportGridRow(): number;
  waitForLayoutReady(): Promise<void>;
  readMetadataPreferences(): GridMetadataPreferences;
  getCookieValue(name: string): string | null;
  setCookieValue(name: string, value: string, days?: number): void;
  snapshotCodec: GridSnapshotCodec;
}

export interface GridEditPermissionInput {
  isOwner: boolean;
  forcedBreakpoint: Breakpoint | null;
  viewportBreakpoint: Breakpoint;
}

export interface GridHistoryUrlMaps {
  resolvedUrls: Record<string, string>;
  resolvedDocumentItemUrls: Record<string, Record<string, string>>;
}

export class GridController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
  ) {}

  canEdit({
    isOwner,
    forcedBreakpoint,
    viewportBreakpoint,
  }: GridEditPermissionInput): boolean {
    if (!isOwner) return false;
    if (!forcedBreakpoint) return true;
    return (
      breakpointRank(forcedBreakpoint) <=
      breakpointRank(viewportBreakpoint)
    );
  }

  setMenuActive(tileId: string): void {
    this.stores.ui.setMenuActive(tileId);
  }

  setPanelActive(tileId: string, panelId: string): void {
    this.stores.ui.setPanelActive(tileId, panelId);
  }

  toggleMenuActive(tileId: string): void {
    this.stores.ui.toggleMenuActive(tileId);
  }

  togglePanelActive(tileId: string, panelId: string): void {
    this.stores.ui.togglePanelActive(tileId, panelId);
  }

  closeMenus(): void {
    this.stores.ui.closeMenus();
  }

  checkShowMetaDataCookie(): void {
    const preferences = this.dependencies.readMetadataPreferences();
    this.stores.ui.setShowMetaData(preferences.showMetaData);
    this.stores.ui.setShowMetaDataVerbose(
      preferences.showMetaDataVerbose,
    );
  }

  setShowMetaData(value: boolean): void {
    this.stores.ui.setShowMetaData(value);
    this.dependencies.setCookieValue(
      "showMetaData",
      value.toString(),
    );
  }

  setShowMetaDataVerbose(value: boolean): void {
    this.stores.ui.setShowMetaDataVerbose(value);
    this.dependencies.setCookieValue(
      "showMetaDataVerbose",
      value.toString(),
    );
  }

  getCookieValue(name: string): string | null {
    return this.dependencies.getCookieValue(name);
  }

  setCookieValue(name: string, value: string, days = 365): void {
    this.dependencies.setCookieValue(name, value, days);
  }

  setActiveBreakpoint(breakpoint: Breakpoint): void {
    this.stores.viewport.setActiveBreakpoint(breakpoint);
  }

  setViewportBreakpoint(breakpoint: Breakpoint): void {
    this.stores.viewport.setViewportBreakpoint(breakpoint);
  }

  setForcedBreakpoint(
    breakpoint: Breakpoint | null,
    grid: Grid | null = this.stores.session.currentGrid,
    resolvedUrls: Readonly<Record<string, string>> =
      this.stores.uploads.resolvedUrls,
    resolvedDocumentItemUrls: Readonly<
      Record<string, Readonly<Record<string, string>>>
    > = this.stores.uploads.resolvedDocumentItemUrls,
  ): void {
    this.stores.viewport.setForcedBreakpoint(breakpoint);
    if (!grid) {
      this.stores.history.setStableSnapshot(null);
      return;
    }
    this.stores.history.setStableSnapshot(
      this.dependencies.snapshotCodec.capture({
        grid,
        breakpoint:
          breakpoint ?? this.stores.viewport.activeBreakpoint,
        actionLabel: "",
        resolvedUrls,
        resolvedDocumentItemUrls,
      }),
    );
  }

  setDisplayPositions(positions: GridLayoutItem[]): void {
    this.stores.viewport.setDisplayPositions(positions);
  }

  getBreakpointPositions(
    grid: Grid | null,
    breakpoint: Breakpoint,
  ): Record<string, TilePosition> | undefined {
    return this.stores.viewport.getBreakpointPositions(grid, breakpoint);
  }

  hasBreakpointOverride(
    grid: Grid | null,
    breakpoint: Breakpoint,
  ): boolean {
    return this.stores.viewport.hasBreakpointOverride(grid, breakpoint);
  }

  async fetchGrids(): Promise<void> {
    this.stores.compatibility.setError(null);
    this.stores.collection.setLoading(true);
    this.stores.collection.setError(null);
    this.stores.collection.setGrids([]);

    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) {
      this.stores.collection.setError("User not authenticated");
      this.stores.compatibility.setError("User not authenticated");
      this.stores.collection.setLoading(false);
      return;
    }

    try {
      const gridService = this.dependencies.getGridService();
      this.stores.collection.setGrids(
        await gridService.fetchGridsByUserId(userId),
      );
      await this.loadRecents();
    } catch (error) {
      this.stores.collection.setError("Failed to fetch grids.");
      this.stores.compatibility.setError("Failed to fetch grids.");
      console.error(error);
    } finally {
      this.stores.collection.setLoading(false);
    }
  }

  async createGrid(name: string): Promise<string | null> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) {
      this.stores.collection.setError("User not authenticated");
      this.stores.compatibility.setError("User not authenticated");
      return null;
    }
    const resolvedName =
      name || `Grid ${this.stores.collection.grids.length + 1}`;
    try {
      const grid = await this.dependencies
        .getGridService()
        .createGridWithStarterTiles(userId, resolvedName);
      this.stores.collection.addGrid({ ...grid });
      return grid.id;
    } catch (error) {
      this.stores.collection.setError("Failed to create grid.");
      this.stores.compatibility.setError("Failed to create grid.");
      console.error(error);
      return null;
    }
  }

  async duplicateGrid(
    sourceGrid: Grid,
    copyDepth: CopyDepth = "full",
  ): Promise<string | null> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) {
      this.stores.collection.setError("User not authenticated");
      this.stores.compatibility.setError("User not authenticated");
      return null;
    }
    try {
      const grid = await this.dependencies
        .getGridService()
        .cloneAndPersistGrid(userId, sourceGrid, copyDepth);
      this.stores.collection.addGrid({ ...grid });
      return grid.id;
    } catch (error) {
      this.stores.collection.setError("Failed to duplicate grid.");
      this.stores.compatibility.setError("Failed to duplicate grid.");
      console.error(error);
      return null;
    }
  }

  recordRecent(id: string): void {
    this.stores.collection.recordRecent(id);
    void this.saveRecents();
  }

  async loadRecents(): Promise<void> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) return;
    try {
      this.stores.collection.setRecentGridIds(
        await this.dependencies
          .getGridService()
          .loadRecentGridIds(userId),
      );
    } catch (error) {
      console.error("Failed to load recent grids:", error);
    }
  }

  async saveRecents(): Promise<void> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) return;
    try {
      await this.dependencies
        .getGridService()
        .saveRecentGridIds(
          userId,
          this.stores.collection.recentGridIds,
        );
    } catch (error) {
      console.error("Failed to save recent grids:", error);
    }
  }

  async renameGrid(
    id: string,
    newName: string,
    activeGrid: Grid | null = this.stores.session.currentGrid,
  ): Promise<void> {
    try {
      const grid = this.stores.collection.grids.find(
        (candidate) => candidate.id === id,
      );
      if (!grid) throw new Error("Grid not found");
      grid.name = newName;
      await this.dependencies.getGridService().updateGrid(grid);
      if (activeGrid?.id === id) activeGrid.name = newName;
    } catch (error) {
      this.stores.collection.setError("Failed to rename grid.");
      this.stores.compatibility.setError("Failed to rename grid.");
      console.error(error);
      throw error;
    }
  }

  resetSessionDependents(): void {
    this.stores.history.reset();
    this.stores.viewport.reset();
    this.stores.uploads.reset();
    this.stores.ui.resetSessionState();
    this.stores.session.reset();
  }

  async loadGrid(id: string): Promise<void> {
    this.stores.compatibility.setError(null);
    this.resetSessionDependents();
    this.stores.history.initializeManager();
    this.stores.session.setLoading(true);

    try {
      const gridService = this.dependencies.getGridService();
      const grid = await gridService.fetchGrid(id);
      const userId =
        this.dependencies.getAuthProvider().getCurrentUserId();

      this.stores.session.setCurrentGrid(grid);
      this.stores.session.setOwner(
        !!(userId && grid.userId && userId === grid.userId),
      );
      this.stores.session.setDemoGrid(false);

      const preferences = this.dependencies.readMetadataPreferences();
      this.stores.ui.setShowMetaData(preferences.showMetaData);
      this.stores.ui.setShowMetaDataVerbose(
        preferences.showMetaDataVerbose,
      );

      this.stores.collection.recordRecent(id);
      if (userId) {
        void gridService
          .saveRecentGridIds(userId, this.stores.collection.recentGridIds)
          .catch((error: unknown) => {
            console.error("Failed to save recent grids:", error);
          });
      }

      await gridService.touchLastOpenedAt(id);
      this.stores.collection.updateGrid(id, {
        lastOpenedAt: this.dependencies.now(),
      });
      this.refreshStableSnapshot();
    } catch (error) {
      this.stores.session.setLoadError("Failed to load grid.");
      this.stores.compatibility.setError("Failed to load grid.");
      console.error(error);
    } finally {
      this.stores.session.setLoading(false);
    }
  }

  loadDemoGrid(grid: Grid): void {
    this.stores.compatibility.setError(null);
    this.resetSessionDependents();
    this.stores.session.setCurrentGrid(grid);
    this.stores.session.setOwner(false);
    this.stores.session.setDemoGrid(true);
  }

  clearSession(): void {
    this.resetSessionDependents();
  }

  async saveGrid(
    resolvedUrls: Record<string, string> =
      this.stores.uploads.resolvedUrls,
    resolvedDocumentItemUrls: Record<
      string,
      Record<string, string>
    > = this.stores.uploads.resolvedDocumentItemUrls,
  ): Promise<void> {
    const grid = this.stores.session.currentGrid;
    if (!grid) {
      console.warn("No grid to save.");
      return;
    }
    if (
      !this.canEdit({
        isOwner: this.stores.session.isOwner,
        forcedBreakpoint: this.stores.viewport.forcedBreakpoint,
        viewportBreakpoint: this.stores.viewport.viewportBreakpoint,
      })
    ) {
      return;
    }
    try {
      await this.dependencies
        .getGridService()
        .queueSave(
          grid,
          resolvedUrls,
          resolvedDocumentItemUrls,
        );
      this.stores.session.setPersistenceError(null);
    } catch (error) {
      this.stores.session.setPersistenceError("Failed to save grid.");
      this.stores.compatibility.setError("Failed to save grid.");
      console.error(error);
    }
  }

  async deleteGrid(
    id: string,
    activeGrid: Grid | null = this.stores.session.currentGrid,
    clearActiveGrid?: () => void,
  ): Promise<void> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    const grid = this.stores.collection.grids.find(
      (candidate) => candidate.id === id,
    );
    if (!userId || !grid || grid.userId !== userId) return;

    try {
      await this.dependencies.getGridService().deleteGrid(id);
      this.stores.collection.removeGrid(id);
      if (activeGrid?.id === id && clearActiveGrid) {
        clearActiveGrid();
      } else {
        this.clearSessionIfGridDeleted(id);
      }
    } catch (error) {
      this.stores.collection.setError("Failed to delete grid.");
      this.stores.compatibility.setError("Failed to delete grid.");
      console.error(error);
    }
  }

  clearSessionIfGridDeleted(id: string): void {
    if (this.stores.session.currentGrid?.id === id) {
      this.clearSession();
    }
  }

  captureSnapshot(
    actionLabel: string,
    {
      resolvedUrls,
      resolvedDocumentItemUrls,
    }: GridHistoryUrlMaps = {
      resolvedUrls: this.stores.uploads.resolvedUrls,
      resolvedDocumentItemUrls:
        this.stores.uploads.resolvedDocumentItemUrls,
    },
  ): Snapshot | null {
    const grid = this.stores.session.currentGrid;
    if (!grid) return null;

    return this.dependencies.snapshotCodec.capture({
      grid,
      breakpoint:
        this.stores.viewport.forcedBreakpoint ??
        this.stores.viewport.activeBreakpoint,
      actionLabel,
      resolvedUrls,
      resolvedDocumentItemUrls,
    });
  }

  refreshStableSnapshot(urlMaps?: GridHistoryUrlMaps): void {
    this.stores.history.setStableSnapshot(
      this.captureSnapshot("", urlMaps),
    );
  }

  pushUndoSnapshot(
    actionLabel: string,
    urlMaps?: GridHistoryUrlMaps,
  ): void {
    const snapshot = this.captureSnapshot(actionLabel, urlMaps);
    if (!snapshot) return;

    this.stores.history.pushSnapshot(snapshot);
    this.refreshStableSnapshot(urlMaps);
  }

  async undo(urlMaps?: GridHistoryUrlMaps): Promise<void> {
    const current = this.captureSnapshot("", urlMaps);
    if (!current) return;

    const snapshot = this.stores.history.undo(current);
    if (!snapshot) return;

    await this.applySnapshot(snapshot, urlMaps);
  }

  async redo(urlMaps?: GridHistoryUrlMaps): Promise<void> {
    const current = this.captureSnapshot("", urlMaps);
    if (!current) return;

    const snapshot = this.stores.history.redo(current);
    if (!snapshot) return;

    await this.applySnapshot(snapshot, urlMaps);
  }

  async undoRedoUntil(
    snapshotId: number,
    urlMaps?: GridHistoryUrlMaps,
  ): Promise<void> {
    const current = this.captureSnapshot("", urlMaps);
    if (!current) return;

    const snapshot = this.stores.history.undoRedoUntil(
      snapshotId,
      current,
    );
    if (!snapshot) return;

    await this.applySnapshot(snapshot, urlMaps);
  }

  async applySnapshot(
    snapshot: Snapshot,
    urlMaps: GridHistoryUrlMaps = {
      resolvedUrls: this.stores.uploads.resolvedUrls,
      resolvedDocumentItemUrls:
        this.stores.uploads.resolvedDocumentItemUrls,
    },
  ): Promise<void> {
    const grid = this.stores.session.currentGrid;
    if (!grid) return;

    const breakpointChanged =
      this.stores.viewport.forcedBreakpoint !== null &&
      snapshot.forcedBreakpoint !==
        this.stores.viewport.forcedBreakpoint;

    if (breakpointChanged) {
      this.setForcedBreakpoint(
        snapshot.forcedBreakpoint,
        grid,
        urlMaps.resolvedUrls,
        urlMaps.resolvedDocumentItemUrls,
      );
      await this.dependencies.delay(500);
    }

    const themeChanged = grid.themeId !== snapshot.themeId;
    this.dependencies.snapshotCodec.apply(grid, snapshot);

    if (themeChanged) {
      this.stores.theme.setTheme(snapshot.themeId);
    }

    void this.saveGrid(
      urlMaps.resolvedUrls,
      urlMaps.resolvedDocumentItemUrls,
    );
    this.refreshStableSnapshot(urlMaps);
    this.stores.history.bumpVersion();
  }

  beginEditing(
    tileId: string,
    urlMaps?: GridHistoryUrlMaps,
  ): void {
    if (
      this.stores.history.beginEdit(
        tileId,
        this.captureSnapshot("Edit tile", urlMaps),
      )
    ) {
      this.refreshStableSnapshot(urlMaps);
    }
  }

  commitEditing(urlMaps?: GridHistoryUrlMaps): void {
    const pending = this.stores.history.takeEditSnapshot();
    if (!pending) return;

    const current = this.captureSnapshot("", urlMaps);
    if (
      current &&
      !this.dependencies.snapshotCodec.equals(pending, current)
    ) {
      this.stores.history.pushSnapshot(pending);
      this.refreshStableSnapshot(urlMaps);
    }
  }

  beginMove(urlMaps?: GridHistoryUrlMaps): void {
    this.stores.history.beginMove(
      this.captureSnapshot("Move tile", urlMaps),
    );
  }

  commitMove(
    urlMaps?: GridHistoryUrlMaps,
  ): void {
    const pending = this.stores.history.takeMoveSnapshot();
    if (pending) this.stores.history.pushSnapshot(pending);

    if (this.stores.viewport.activeBreakpoint !== "lg") {
      this.updateBreakpointOverride();
    } else {
      this.updateGrid();
    }
    this.refreshStableSnapshot(urlMaps);
  }

  beginResize(urlMaps?: GridHistoryUrlMaps): void {
    this.stores.history.beginResize(
      this.captureSnapshot("Resize tile", urlMaps),
    );
  }

  commitResize(
    urlMaps?: GridHistoryUrlMaps,
  ): void {
    const pending = this.stores.history.takeResizeSnapshot();
    if (pending) this.stores.history.pushSnapshot(pending);

    if (this.stores.viewport.activeBreakpoint !== "lg") {
      this.updateBreakpointOverride();
    } else {
      this.updateGrid();
    }
    this.refreshStableSnapshot(urlMaps);
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

  toggleVerticalCompact(): void {
    const grid = this.stores.session.currentGrid;
    if (!grid) return;

    this.pushUndoSnapshot("Toggle gravity");
    grid.verticalCompact = !grid.verticalCompact;
    this.updateGrid();
  }

  setVerticalCompact(value: boolean): void {
    const grid = this.stores.session.currentGrid;
    if (!grid) return;

    this.pushUndoSnapshot("Set gravity");
    grid.verticalCompact = value;
    this.updateGrid();
  }

  addTile(content: TileContent): string | null {
    const grid = this.stores.session.currentGrid;
    if (!grid) return null;

    const definition = getTileDefinition(content.type);
    if (definition?.maxPerGrid) {
      const count = grid.tiles.filter(
        (tile) => tile.content.type === content.type,
      ).length;
      if (count >= definition.maxPerGrid) {
        this.stores.toast.addToast(
          `Only ${definition.maxPerGrid} ${definition.label ?? content.type} tile${definition.maxPerGrid > 1 ? "s" : ""} allowed per grid`,
          "error",
        );
        return null;
      }
    }

    const width = definition?.defaultSize?.w ?? 2;
    const height = definition?.defaultSize?.h ?? 2;
    const columns = grid.colNum || 12;
    const viewportY = this.getViewportGridY();
    const position =
      viewportY > 0
        ? findBestXAtRow(
            grid.tiles,
            columns,
            width,
            height,
            viewportY,
          )
        : findFirstAvailableSpot(
            grid.tiles,
            columns,
            width,
            height,
          );

    this.pushUndoSnapshot("Add tile");
    pushTilesForNewItem(
      grid.tiles,
      position.x,
      position.y,
      width,
      height,
    );

    const tile = createTile(
      content.type,
      this.dependencies.generateUuid(),
      position.x,
      position.y,
      width,
      height,
      content,
      "",
    );
    grid.tiles.push(tile);
    this.updateGrid();
    this.logTileEvent(
      AnalyticsEventType.TILE_ADDED,
      grid.id,
      content.type,
      tile.i,
    );
    return tile.i;
  }

  setTileContent(id: string, content: TileContent): void {
    const grid = this.stores.session.currentGrid;
    const tile = grid?.tiles.find((candidate) => candidate.i === id);
    if (!grid || !tile) return;

    this.pushUndoSnapshot("Change tile content");
    tile.content = content;
    if (content.type === ContentType.PROFILE) {
      tile.w = 4;
      tile.h = 4;
      adjustTilePosition(tile, grid.colNum);
    }
    this.updateGrid();
  }

  patchTileContent(
    id: string,
    patch: Partial<AnyTileContent>,
  ): void {
    const grid = this.stores.session.currentGrid;
    const tile = grid?.tiles.find((candidate) => candidate.i === id);
    if (!tile) return;

    const currentContent = tile.content as AnyTileContent &
      Record<string, unknown>;
    const patchRecord = patch as Record<string, unknown>;
    const hasChanges = Object.keys(patchRecord).some(
      (key) => !Object.is(currentContent[key], patchRecord[key]),
    );
    if (!hasChanges) return;

    if (!this.stores.history.isEditing(id)) {
      this.pushUndoSnapshot("Update tile");
    }
    tile.content = {
      ...currentContent,
      ...patchRecord,
    } as TileContent;
    this.updateGrid();
  }

  patchDocumentItem(
    tileId: string,
    itemId: string,
    itemPatch: Partial<DocumentItem>,
  ): void {
    const tile = this.stores.session.currentGrid?.tiles.find(
      (candidate) => candidate.i === tileId,
    );
    if (!tile || tile.content.type !== ContentType.DOCUMENT) return;

    if (!this.stores.history.isEditing(tileId)) {
      this.pushUndoSnapshot("Update document");
    }
    const document = tile.content as DocumentsContent;
    tile.content = {
      ...document,
      items: document.items.map((item) =>
        item.id === itemId ? { ...item, ...itemPatch } : item,
      ),
    } as TileContent;
    this.updateGrid();
  }

  setGridTheme(themeId: string): void {
    this.mutateGridWithHistory("Change theme", (grid) => {
      grid.themeId = themeId;
    });
  }

  setDuplicatable(value: boolean): void {
    const grid = this.stores.session.currentGrid;
    if (!grid) return;
    grid.duplicatable = value;
    this.updateGrid();
  }

  addBackgroundImage(url: string, embed: boolean): void {
    this.mutateGridWithHistory("Change background image", (grid) => {
      grid.backgroundImageSrc = url;
      grid.backgroundEmbed = embed;
    });
  }

  removeBackgroundImage(): void {
    this.mutateGridWithHistory("Remove background image", (grid) => {
      grid.backgroundImageSrc = "";
      grid.backgroundEmbed = false;
    });
  }

  setCustomOgImage(url: string): void {
    this.mutateGridWithHistory(
      "Change social share image",
      (grid) => {
        grid.ogImageSrc = url;
      },
    );
  }

  removeCustomOgImage(): void {
    this.mutateGridWithHistory(
      "Remove social share image",
      (grid) => {
        grid.ogImageSrc = "";
      },
    );
  }

  setBackgroundColor(color: string): void {
    this.mutateGridWithHistory("Change background color", (grid) => {
      grid.backgroundColor = color;
    });
  }

  removeBackgroundColor(): void {
    this.mutateGridWithHistory("Remove background color", (grid) => {
      grid.backgroundColor = "";
    });
  }

  getViewportGridY(): number {
    return this.dependencies.measureViewportGridRow();
  }

  duplicateTile(id: string): string | null {
    const grid = this.stores.session.currentGrid;
    const source = grid?.tiles.find((tile) => tile.i === id);
    if (!grid || !source) return null;

    this.pushUndoSnapshot("Duplicate tile");
    const columns = grid.colNum || 12;
    const breakpoint = this.stores.viewport.activeBreakpoint;
    const override = grid.overrides?.[breakpoint]?.[id];
    const width = override?.w ?? source.w;
    const height = override?.h ?? source.h;
    const position = findBestXAtRow(
      grid.tiles,
      columns,
      width,
      height,
      (override?.y ?? source.y) + height,
    );
    pushTilesForNewItem(
      grid.tiles,
      position.x,
      position.y,
      width,
      height,
    );

    const newId = this.dependencies.generateUuid();
    const tile: Tile = {
      i: newId,
      x: position.x,
      y: position.y,
      w: width,
      h: height,
      borderEnabled: source.borderEnabled,
      caption: source.caption,
      content: JSON.parse(JSON.stringify(source.content)) as TileContent,
    };
    grid.tiles.push(tile);

    const resolvedItems =
      this.stores.uploads.resolvedDocumentItemUrls[id];
    if (resolvedItems) {
      for (const [itemId, url] of Object.entries(resolvedItems)) {
        this.stores.uploads.setResolvedDocumentItemUrl(
          newId,
          itemId,
          url,
        );
      }
    }

    if (grid.overrides) {
      for (const overrideBreakpoint of Object.keys(
        grid.overrides,
      ) as Breakpoint[]) {
        const positions = grid.overrides[overrideBreakpoint];
        if (positions?.[id]) {
          positions[newId] = {
            ...positions[id],
            x: position.x,
            y: position.y,
          };
        }
      }
    }

    this.updateGrid();
    this.logTileEvent(
      AnalyticsEventType.TILE_ADDED,
      grid.id,
      tile.content.type,
      newId,
    );
    return newId;
  }

  removeTile(id: string): void {
    const grid = this.stores.session.currentGrid;
    if (!grid) return;

    this.pushUndoSnapshot("Remove tile");
    const tile = grid.tiles.find((candidate) => candidate.i === id);
    if (tile) this.revokeTileObjectUrls(tile);
    this.stores.uploads.clearTileState(id);

    if (grid.overrides) {
      for (const breakpoint of Object.keys(
        grid.overrides,
      ) as Breakpoint[]) {
        const positions = grid.overrides[breakpoint];
        if (positions) delete positions[id];
      }
    }
    grid.tiles = grid.tiles.filter((candidate) => candidate.i !== id);

    if (tile) {
      this.logTileEvent(
        AnalyticsEventType.TILE_REMOVED,
        grid.id,
        tile.content.type,
        id,
      );
    }
    void this.saveGrid();
    this.refreshStableSnapshot();
  }

  resizeTile(id: string, width: number, height: number): void {
    const grid = this.stores.session.currentGrid;
    const tile = grid?.tiles.find((candidate) => candidate.i === id);
    if (!grid || !tile) return;

    const breakpoint = this.stores.viewport.activeBreakpoint;
    if (breakpoint === "lg") {
      tile.w = width;
      tile.h = height;
      adjustTilePosition(tile, grid.colNum);
      const displayPosition =
        this.stores.viewport.displayPositions.find(
          (position) => position.i === id,
        );
      if (displayPosition) {
        displayPosition.w = width;
        displayPosition.h = height;
        displayPosition.x = tile.x;
      }
      this.updateGrid();
      return;
    }

    const columns = breakpoint === "sm" ? 4 : 8;
    const clampedWidth = Math.min(width, columns);
    grid.overrides ??= {};
    grid.overrides[breakpoint] ??= Object.fromEntries(
      this.stores.viewport.displayPositions.map((position) => [
        position.i,
        {
          x: position.x,
          y: position.y,
          w: position.w,
          h: position.h,
        },
      ]),
    );
    const positions = grid.overrides[breakpoint];
    if (!positions) return;
    const existing = positions[id];
    const clampedX = Math.min(
      existing?.x ?? tile.x,
      columns - clampedWidth,
    );
    positions[id] = {
      x: Math.max(0, clampedX),
      y: existing?.y ?? tile.y,
      w: clampedWidth,
      h: height,
    };
    this.updateGrid();
  }

  toggleTileBorder(id: string): void {
    const tile = this.stores.session.currentGrid?.tiles.find(
      (candidate) => candidate.i === id,
    );
    if (!tile) return;
    this.pushUndoSnapshot("Toggle tile border");
    tile.borderEnabled = tile.borderEnabled === false;
    this.updateGrid();
  }

  toggleLinkBackground(id: string): void {
    const tile = this.stores.session.currentGrid?.tiles.find(
      (candidate) => candidate.i === id,
    );
    if (!tile || tile.content.type !== ContentType.LINK) return;
    this.pushUndoSnapshot("Toggle link background");
    const link = tile.content as LinkContent;
    link.linkBackgroundEnabled = link.linkBackgroundEnabled === false;
    this.updateGrid();
  }

  updateGrid(): void {
    const grid = this.stores.session.currentGrid;
    if (
      !grid ||
      !this.canEdit({
        isOwner: this.stores.session.isOwner,
        forcedBreakpoint: this.stores.viewport.forcedBreakpoint,
        viewportBreakpoint: this.stores.viewport.viewportBreakpoint,
      })
    ) {
      return;
    }

    if (
      this.stores.viewport.activeBreakpoint === "lg" &&
      this.stores.viewport.displayPositions.length
    ) {
      for (const position of this.stores.viewport.displayPositions) {
        const tile = grid.tiles.find(
          (candidate) => candidate.i === position.i,
        );
        if (tile) {
          tile.x = position.x;
          tile.y = position.y;
          tile.w = position.w;
          tile.h = position.h;
        }
      }
    }
    void this.saveGrid();
  }

  updateBreakpointOverride(): void {
    const grid = this.stores.session.currentGrid;
    const breakpoint = this.stores.viewport.activeBreakpoint;
    if (!grid || breakpoint === "lg") return;

    grid.overrides ??= {};
    grid.overrides[breakpoint] = Object.fromEntries(
      this.stores.viewport.displayPositions.map((position) => [
        position.i,
        {
          x: position.x,
          y: position.y,
          w: position.w,
          h: position.h,
        },
      ]),
    );
    this.updateGrid();
  }

  saveBreakpointPositions(
    breakpoint: Breakpoint,
    tiles: GridLayoutItem[],
  ): void {
    const grid = this.stores.session.currentGrid;
    if (!grid || breakpoint === "lg") return;

    grid.overrides ??= {};
    grid.overrides[breakpoint] = Object.fromEntries(
      tiles.map((tile) => [
        tile.i,
        { x: tile.x, y: tile.y, w: tile.w, h: tile.h },
      ]),
    );
    void this.saveGrid();
  }

  resetBreakpoint(breakpoint: Breakpoint): void {
    const grid = this.stores.session.currentGrid;
    if (!grid || breakpoint === "lg") return;

    this.pushUndoSnapshot("Reset breakpoint grid");
    if (grid.overrides) delete grid.overrides[breakpoint];
    void this.saveGrid();
  }

  private mutateGridWithHistory(
    actionLabel: string,
    mutate: (grid: Grid) => void,
  ): void {
    const grid = this.stores.session.currentGrid;
    if (!grid) return;
    this.pushUndoSnapshot(actionLabel);
    mutate(grid);
    this.updateGrid();
  }

  private revokeTileObjectUrls(tile: Tile): void {
    if (
      "src" in tile.content &&
      typeof tile.content.src === "string" &&
      tile.content.src.startsWith("blob:")
    ) {
      URL.revokeObjectURL(tile.content.src);
    }
    if (tile.content.type !== ContentType.DOCUMENT) return;
    for (const item of (tile.content as DocumentsContent).items ?? []) {
      if (
        typeof item.url === "string" &&
        item.url.startsWith("blob:")
      ) {
        URL.revokeObjectURL(item.url);
      }
    }
  }

  private logTileEvent(
    eventType:
      | AnalyticsEventType.TILE_ADDED
      | AnalyticsEventType.TILE_REMOVED,
    gridId: string,
    tileType: ContentType,
    tileId: string,
  ): void {
    if (tileType === ContentType.SUGGESTION) return;
    try {
      void this.dependencies
        .getAnalyticsService()
        .logEvent({
          eventType,
          userId:
            this.dependencies.getAuthProvider().getCurrentUserId(),
          gridId,
          metadata: { tileType, tileId },
        })
        .catch(() => undefined);
    } catch {
      // Analytics must never make a grid mutation fail.
    }
  }
}
