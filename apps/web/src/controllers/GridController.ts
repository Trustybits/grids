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
import type {
  GridPersistenceScope,
  IGridPersistenceScheduler,
} from "@/services/interfaces/IGridPersistenceScheduler";
import { GridSnapshotCodec } from "@/undo/GridSnapshotCodec";
import type { Snapshot } from "@/undo/UndoTypes";
import type { useGridCollectionStore } from "@/stores/grid/gridCollection";
import type { useGridHistoryStore } from "@/stores/grid/gridHistory";
import type { useGridSessionStore } from "@/stores/grid/gridSession";
import type { useGridUiStore } from "@/stores/grid/gridUi";
import type { GridUploadRecord } from "@/stores/grid/gridUploads";
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
import { createPersistableGridSnapshot } from "@/utils/GridPersistenceUtils";
import type {
  StartUploadInput,
  UpdateCaptionInput,
} from "./GridCommands";

export interface GridControllerStores {
  collection: ReturnType<typeof useGridCollectionStore>;
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
  persistenceScheduler: IGridPersistenceScheduler;
  getAuthProvider(): AuthProvider;
  getAnalyticsService(): IAnalyticsService;
  generateUuid(): string;
  delay(milliseconds: number): Promise<void>;
  now(): Date;
  measureViewportGridRow(): number;
  readMetadataPreferences(): GridMetadataPreferences;
  getCookieValue(name: string): string | null;
  setCookieValue(name: string, value: string, days?: number): void;
  snapshotCodec: GridSnapshotCodec;
}

export interface GridLayoutReadinessAdapter {
  waitForLayoutReady(breakpoint: Breakpoint): Promise<void>;
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

const BREAKPOINT_HISTORY_TRANSITION_MS = 500;

export class GridController {
  private layoutReadinessAdapter: GridLayoutReadinessAdapter | null =
    null;

  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
  ) {}

  registerLayoutReadinessAdapter(
    adapter: GridLayoutReadinessAdapter,
  ): () => void {
    this.layoutReadinessAdapter = adapter;

    return () => {
      if (this.layoutReadinessAdapter === adapter) {
        this.layoutReadinessAdapter = null;
      }
    };
  }

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
    this.stores.collection.setLoading(true);
    this.stores.collection.setError(null);
    this.stores.collection.setGrids([]);

    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) {
      this.stores.collection.setError("User not authenticated");
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
    this.stores.session.setLoadError(null);
    this.resetSessionDependents();
    const sessionGeneration = this.stores.session.sessionGeneration;
    let committedGrid = false;
    this.stores.history.initializeManager();
    this.stores.session.setLoading(true);

    try {
      const gridService = this.dependencies.getGridService();
      const grid = await gridService.fetchGrid(id);
      if (this.stores.session.sessionGeneration !== sessionGeneration) {
        return;
      }

      const userId =
        this.dependencies.getAuthProvider().getCurrentUserId();

      this.stores.session.setCurrentGrid(grid);
      committedGrid = true;
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
      if (this.stores.session.sessionGeneration !== sessionGeneration) {
        return;
      }

      this.stores.session.setLoadError("Failed to load grid.");
      console.error(error);
    } finally {
      if (
        committedGrid ||
        this.stores.session.sessionGeneration === sessionGeneration
      ) {
        this.stores.session.setLoading(false);
      }
    }
  }

  clearSession(): void {
    this.resetSessionDependents();
  }

  scheduleSave(
    resolvedUrls: Record<string, string> =
      this.stores.uploads.resolvedUrls,
    resolvedDocumentItemUrls: Record<
      string,
      Record<string, string>
    > = this.stores.uploads.resolvedDocumentItemUrls,
  ): void {
    const scope = this.enqueueSave(
      resolvedUrls,
      resolvedDocumentItemUrls,
    );
    if (scope) {
      this.observeScheduledSave(scope);
    }
  }

  private enqueueSave(
    resolvedUrls: Record<string, string>,
    resolvedDocumentItemUrls: Record<string, Record<string, string>>,
  ): GridPersistenceScope | null {
    const grid = this.stores.session.currentGrid;
    if (!grid) {
      console.warn("No grid to save.");
      return null;
    }
    if (
      !this.canEdit({
        isOwner: this.stores.session.isOwner,
        forcedBreakpoint: this.stores.viewport.forcedBreakpoint,
        viewportBreakpoint: this.stores.viewport.viewportBreakpoint,
      })
    ) {
      return null;
    }

    const scope = this.stores.session.getPersistenceScope();
    if (!scope) return null;

    try {
      const snapshot = createPersistableGridSnapshot(
        grid,
        resolvedUrls,
        resolvedDocumentItemUrls,
      );
      this.stores.session.setPersistenceStatus("pending");
      this.dependencies.persistenceScheduler.schedule(scope, snapshot);
      if (this.stores.session.matchesPersistenceScope(scope)) {
        this.stores.session.setPersistenceStatus("saving");
      }
      return scope;
    } catch (error) {
      this.reportPersistenceError(error);
      return null;
    }
  }

  async flushSaves(): Promise<void> {
    const scope = this.stores.session.getPersistenceScope();
    if (!scope) return;

    await this.flushPersistenceScope(scope);
  }

  private async flushPersistenceScope(
    scope: GridPersistenceScope,
  ): Promise<void> {
    try {
      await this.dependencies.persistenceScheduler.flush(scope);
      if (!this.stores.session.matchesPersistenceScope(scope)) return;
      this.stores.session.setPersistenceStatus("idle");
      this.stores.session.setPersistenceError(null);
    } catch (error) {
      if (this.stores.session.matchesPersistenceScope(scope)) {
        this.reportPersistenceError(error);
      }
      throw error;
    }
  }

  private observeScheduledSave(scope: GridPersistenceScope): void {
    void this.flushPersistenceScope(scope).catch(() => undefined);
  }

  async saveGrid(
    resolvedUrls: Record<string, string> =
      this.stores.uploads.resolvedUrls,
    resolvedDocumentItemUrls: Record<
      string,
      Record<string, string>
    > = this.stores.uploads.resolvedDocumentItemUrls,
  ): Promise<void> {
    const scope = this.enqueueSave(
      resolvedUrls,
      resolvedDocumentItemUrls,
    );
    if (!scope) return;
    try {
      await this.flushPersistenceScope(scope);
    } catch {
      // Legacy callers observe save failures through store state.
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
      await Promise.all([
        this.dependencies.delay(BREAKPOINT_HISTORY_TRANSITION_MS),
        this.layoutReadinessAdapter?.waitForLayoutReady(
          snapshot.forcedBreakpoint,
        ) ?? Promise.resolve(),
      ]);
    }

    const themeChanged = grid.themeId !== snapshot.themeId;
    this.dependencies.snapshotCodec.apply(grid, snapshot);

    if (themeChanged) {
      this.stores.theme.setTheme(snapshot.themeId);
    }

    this.scheduleSave(
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
      this.scheduleSave();
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
    if (!pending) return;

    this.stores.history.pushSnapshot(pending);
    this.commitGestureGeometry();
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
    if (!pending) return;

    this.stores.history.pushSnapshot(pending);
    this.commitGestureGeometry();
    this.refreshStableSnapshot(urlMaps);
  }

  /**
   * Commit the geometry produced by a move/resize gesture. Desktop gestures
   * synchronize rendered positions into canonical tiles; non-desktop gestures
   * capture the active breakpoint override. Either way persistence is
   * scheduled exactly once.
   */
  private commitGestureGeometry(): void {
    const grid = this.stores.session.currentGrid;
    if (this.stores.viewport.activeBreakpoint !== "lg") {
      this.captureActiveBreakpointOverride();
    } else if (grid && this.stores.viewport.displayPositions.length) {
      this.syncPositionOnlyLayout(
        grid,
        this.stores.viewport.displayPositions,
      );
    }
    this.scheduleSave();
  }

  startUpload(input: StartUploadInput): string | null {
    const scope = this.stores.session.getPersistenceScope();
    if (!scope || !this.uploadTargetExists(input.tileId, input.itemId)) {
      return null;
    }

    return this.stores.uploads.startUpload({
      uploadId: input.uploadId,
      gridId: scope.gridId,
      sessionGeneration: scope.sessionGeneration,
      tileId: input.tileId,
      documentItemId: input.itemId,
      progress: input.progress,
      ownedObjectUrl: input.ownedObjectUrl,
      task: input.task,
    });
  }

  progressUpload(uploadId: string, progress: number): boolean {
    if (!this.validateUpload(uploadId)) {
      this.stores.uploads.abandonUpload(uploadId);
      return false;
    }
    return this.stores.uploads.progressUpload(uploadId, progress);
  }

  resolveUpload(
    uploadId: string,
    url: string,
    final = true,
  ): boolean {
    const record = this.validateUpload(uploadId);
    if (!record) {
      this.stores.uploads.abandonUpload(uploadId);
      return false;
    }

    const resolved = this.stores.uploads.resolveUpload(
      uploadId,
      url,
      final,
    );
    if (!resolved) return false;

    if (record.documentItemId) {
      this.stores.history.replaceBlobUrl(
        record.tileId,
        url,
        record.documentItemId,
      );
    } else {
      this.stores.history.replaceBlobUrl(record.tileId, url);
    }
    this.scheduleSave();
    return true;
  }

  failUpload(uploadId: string): boolean {
    if (!this.validateUpload(uploadId)) {
      this.stores.uploads.abandonUpload(uploadId);
      return false;
    }
    return this.stores.uploads.failUpload(uploadId);
  }

  abandonUpload(uploadId: string): boolean {
    return this.stores.uploads.abandonUpload(uploadId);
  }

  cancelUpload(uploadId: string): boolean {
    return this.stores.uploads.cancelUpload(uploadId);
  }

  /**
   * Revoke a locally created object URL through the uploads store so the
   * exactly-once ownership ledger stays the single revocation authority.
   * Optimistic upload flows route their early-bail and pre-record cleanup here
   * instead of calling `URL.revokeObjectURL` directly.
   */
  revokeOwnedObjectUrl(url: string | undefined): boolean {
    return this.stores.uploads.revokeOwnedObjectUrl(url);
  }

  private validateUpload(uploadId: string): GridUploadRecord | null {
    const record = this.stores.uploads.uploadRecords[uploadId];
    if (!record || record.status !== "active") return null;
    if (!this.stores.uploads.isCurrentUpload(uploadId)) return null;
    if (
      !this.stores.session.matchesPersistenceScope({
        gridId: record.gridId,
        sessionGeneration: record.sessionGeneration,
      })
    ) {
      return null;
    }
    if (!this.uploadTargetExists(record.tileId, record.documentItemId)) {
      return null;
    }
    return record;
  }

  private uploadTargetExists(
    tileId: string,
    documentItemId?: string,
  ): boolean {
    const tile = this.stores.session.currentGrid?.tiles.find(
      (candidate) => candidate.i === tileId,
    );
    if (!tile) return false;
    if (!documentItemId) return true;
    if (tile.content.type !== ContentType.DOCUMENT) return false;
    return Boolean(
      (tile.content as DocumentsContent).items?.some(
        (item) => item.id === documentItemId,
      ),
    );
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

  setVerticalCompact(value: boolean): void {
    this.runGridCommand({
      captureHistory: "Set gravity",
      mutate: (grid) => {
        grid.verticalCompact = value;
      },
    });
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
    this.scheduleSave();
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
    this.scheduleSave();
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

    const editing = this.stores.history.isEditing(id);
    if (!editing) {
      this.pushUndoSnapshot("Update tile");
    }
    tile.content = {
      ...currentContent,
      ...patchRecord,
    } as TileContent;
    // During an active edit transaction the final save is scheduled once by
    // commitEditing(); intermediate patches must not schedule.
    if (!editing) {
      this.scheduleSave();
    }
  }

  /**
   * Persist a debounced editor autosave. While an edit transaction is active
   * for the tile this updates canonical content and schedules a single
   * background save, so text the user paused on mid-edit survives a reload —
   * without pushing a history entry, since the open transaction still records
   * exactly one undo entry at commit. Outside an edit transaction it defers to
   * {@link patchTileContent} so a stray autosave still captures history.
   */
  autosaveTileContent(
    id: string,
    patch: Partial<AnyTileContent>,
  ): void {
    if (!this.stores.history.isEditing(id)) {
      this.patchTileContent(id, patch);
      return;
    }

    const tile = this.stores.session.currentGrid?.tiles.find(
      (candidate) => candidate.i === id,
    );
    if (!tile) return;

    const currentContent = tile.content as AnyTileContent &
      Record<string, unknown>;
    const patchRecord = patch as Record<string, unknown>;
    const hasChanges = Object.keys(patchRecord).some(
      (key) => !Object.is(currentContent[key], patchRecord[key]),
    );
    if (!hasChanges) return;

    tile.content = {
      ...currentContent,
      ...patchRecord,
    } as TileContent;
    this.scheduleSave();
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

    const editing = this.stores.history.isEditing(tileId);
    if (!editing) {
      this.pushUndoSnapshot("Update document");
    }
    const document = tile.content as DocumentsContent;
    tile.content = {
      ...document,
      items: document.items.map((item) =>
        item.id === itemId ? { ...item, ...itemPatch } : item,
      ),
    } as TileContent;
    // Intermediate document patches inside an edit transaction defer their
    // save to commitEditing().
    if (!editing) {
      this.scheduleSave();
    }
  }

  updateCaption({ tileId, caption }: UpdateCaptionInput): void {
    this.runGridCommand({
      validate: (grid) =>
        grid.tiles.some((candidate) => candidate.i === tileId),
      mutate: (grid) => {
        const tile = grid.tiles.find(
          (candidate) => candidate.i === tileId,
        );
        if (tile) tile.caption = caption;
      },
    });
  }

  renameCurrentGrid(name: string): void {
    this.runGridCommand({
      mutate: (grid) => {
        grid.name = name;
        this.stores.collection.updateGrid(grid.id, { name });
      },
    });
  }

  setGridTheme(themeId: string): void {
    this.runGridCommand({
      captureHistory: "Change theme",
      mutate: (grid) => {
        grid.themeId = themeId;
      },
    });
  }

  setDuplicatable(value: boolean): void {
    this.runGridCommand({
      mutate: (grid) => {
        grid.duplicatable = value;
      },
    });
  }

  addBackgroundImage(url: string, embed: boolean): void {
    this.runGridCommand({
      captureHistory: "Change background image",
      mutate: (grid) => {
        grid.backgroundImageSrc = url;
        grid.backgroundEmbed = embed;
      },
    });
  }

  removeBackgroundImage(): void {
    this.runGridCommand({
      captureHistory: "Remove background image",
      mutate: (grid) => {
        grid.backgroundImageSrc = "";
        grid.backgroundEmbed = false;
      },
    });
  }

  setCustomOgImage(url: string): void {
    this.runGridCommand({
      captureHistory: "Change social share image",
      mutate: (grid) => {
        grid.ogImageSrc = url;
      },
    });
  }

  removeCustomOgImage(): void {
    this.runGridCommand({
      captureHistory: "Remove social share image",
      mutate: (grid) => {
        grid.ogImageSrc = "";
      },
    });
  }

  setBackgroundColor(color: string): void {
    this.runGridCommand({
      captureHistory: "Change background color",
      mutate: (grid) => {
        grid.backgroundColor = color;
      },
    });
  }

  removeBackgroundColor(): void {
    this.runGridCommand({
      captureHistory: "Remove background color",
      mutate: (grid) => {
        grid.backgroundColor = "";
      },
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

    this.scheduleSave();
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
    this.stores.uploads.clearTileState(
      id,
      tile ? this.getTileObjectUrls(tile) : [],
    );

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
    this.scheduleSave();
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
      this.scheduleSave();
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
    this.scheduleSave();
  }

  toggleTileBorder(id: string): void {
    this.runGridCommand({
      validate: (grid) =>
        grid.tiles.some((candidate) => candidate.i === id),
      captureHistory: "Toggle tile border",
      mutate: (grid) => {
        const tile = grid.tiles.find(
          (candidate) => candidate.i === id,
        );
        if (tile) tile.borderEnabled = tile.borderEnabled === false;
      },
    });
  }

  toggleLinkBackground(id: string): void {
    this.runGridCommand({
      validate: (grid) => {
        const tile = grid.tiles.find(
          (candidate) => candidate.i === id,
        );
        return tile?.content.type === ContentType.LINK;
      },
      captureHistory: "Toggle link background",
      mutate: (grid) => {
        const tile = grid.tiles.find(
          (candidate) => candidate.i === id,
        );
        if (!tile || tile.content.type !== ContentType.LINK) return;
        const link = tile.content as LinkContent;
        link.linkBackgroundEnabled = link.linkBackgroundEnabled === false;
      },
    });
  }

  commitRenderedDesktopLayout(
    layout: GridLayoutItem[] = this.stores.viewport.displayPositions,
  ): void {
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
      layout.length
    ) {
      this.syncPositionOnlyLayout(grid, layout);
    }
    this.scheduleSave();
  }

  commitCompactedLayout(layout: GridLayoutItem[]): void {
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
    this.syncPositionOnlyLayout(grid, layout);
    this.scheduleSave();
  }

  /**
   * Copy only positional fields (`x`, `y`, `w`, `h`) from a position-only
   * rendered layout into canonical tiles. Tile content is never copied from
   * rendered layout objects.
   */
  private syncPositionOnlyLayout(
    grid: Grid,
    layout: GridLayoutItem[],
  ): void {
    for (const position of layout) {
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

  private captureActiveBreakpointOverride(): boolean {
    const grid = this.stores.session.currentGrid;
    const breakpoint = this.stores.viewport.activeBreakpoint;
    if (!grid || breakpoint === "lg") return false;

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
    return true;
  }

  updateBreakpointOverride(): void {
    if (this.captureActiveBreakpointOverride()) {
      this.scheduleSave();
    }
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
    this.scheduleSave();
  }

  resetBreakpoint(breakpoint: Breakpoint): void {
    const grid = this.stores.session.currentGrid;
    if (!grid || breakpoint === "lg") return;

    this.pushUndoSnapshot("Reset breakpoint grid");
    if (grid.overrides) delete grid.overrides[breakpoint];
    this.scheduleSave();
  }

  /**
   * Internal executor for discrete grid mutations. It makes the
   * validate → capture-history → mutate → schedule sequence explicit so
   * public commands stay semantic and never schedule through another public
   * command. This is not a public generic mutation API.
   */
  private runGridCommand<T>(definition: {
    validate?: (grid: Grid) => boolean;
    captureHistory?: string;
    mutate: (grid: Grid) => T;
    persist?: boolean;
  }): T | undefined {
    const grid = this.stores.session.currentGrid;
    if (!grid) return undefined;
    if (definition.validate && !definition.validate(grid)) {
      return undefined;
    }
    if (definition.captureHistory !== undefined) {
      this.pushUndoSnapshot(definition.captureHistory);
    }
    const result = definition.mutate(grid);
    if (definition.persist !== false) {
      this.scheduleSave();
    }
    return result;
  }

  private reportPersistenceError(error: unknown): void {
    this.stores.session.setPersistenceError("Failed to save grid.");
    console.error(error);
  }

  private getTileObjectUrls(tile: Tile): string[] {
    const urls: string[] = [];
    if (
      "src" in tile.content &&
      typeof tile.content.src === "string" &&
      tile.content.src.startsWith("blob:")
    ) {
      urls.push(tile.content.src);
    }
    if (tile.content.type !== ContentType.DOCUMENT) return urls;
    for (const item of (tile.content as DocumentsContent).items ?? []) {
      if (
        typeof item.url === "string" &&
        item.url.startsWith("blob:")
      ) {
        urls.push(item.url);
      }
    }
    return urls;
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
