import {
  type AnyTileContent,
  type Breakpoint,
  type ConfirmedGridDuplicateStorage,
  type CopyDepth,
  type DocumentItem,
  type Grid,
  type TileContent,
  type TilePosition,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import type { Snapshot } from "@/undo/UndoTypes";
import type {
  StartUploadInput,
  UpdateCaptionInput,
} from "./GridCommands";
import {
  type GridControllerDependencies,
  type GridControllerStores,
  type GridEditPermissionInput,
  type GridHistoryUrlMaps,
  type GridLayoutReadinessAdapter,
} from "./GridControllerTypes";
import { GridCollectionController } from "./internal/GridCollectionController";
import { GridHistoryController } from "./internal/GridHistoryController";
import { GridLayoutController } from "./internal/GridLayoutController";
import { GridPersistenceController } from "./internal/GridPersistenceController";
import { GridSessionController } from "./internal/GridSessionController";
import { GridSettingsController } from "./internal/GridSettingsController";
import { GridTileContentController } from "./internal/GridTileContentController";
import { GridTileStructureController } from "./internal/GridTileStructureController";
import { GridUploadController } from "./internal/GridUploadController";
import { GridUiController } from "./internal/GridUiController";
import { GridViewportController } from "./internal/GridViewportController";

export type {
  GridControllerDependencies,
  GridControllerStores,
  GridEditPermissionInput,
  GridHistoryUrlMaps,
  GridLayoutReadinessAdapter,
  GridMetadataPreferences,
} from "./GridControllerTypes";

export class GridController {
  private readonly collectionController: GridCollectionController;
  private readonly historyController: GridHistoryController;
  private readonly layoutController: GridLayoutController;
  private readonly persistenceController: GridPersistenceController;
  private readonly sessionController: GridSessionController;
  private readonly settingsController: GridSettingsController;
  private readonly tileContentController: GridTileContentController;
  private readonly tileStructureController: GridTileStructureController;
  private readonly uploadController: GridUploadController;
  private readonly uiController: GridUiController;
  private readonly viewportController: GridViewportController;

  /**
   * Removed chat tiles awaiting Firestore message cleanup, keyed per grid
   * (gridId → tileIds). Entries carry their own gridId because the main flush
   * point — grid switch / teardown — fires while the live grid is changing, so
   * a bare tileId could be reclaimed against the wrong grid. See
   * `flushChatCleanup`.
   */
  private readonly pendingChatDeletions = new Map<string, Set<string>>();

  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
  ) {
    this.sessionController = new GridSessionController(
      stores,
      dependencies,
      () => this.refreshStableSnapshot(),
      () => this.flushChatCleanup(true),
    );
    this.collectionController = new GridCollectionController(
      stores,
      dependencies,
      (id) => this.clearSessionIfGridDeleted(id),
    );
    this.layoutController = new GridLayoutController(
      stores,
      dependencies,
      () =>
        this.canEdit({
          isOwner: this.stores.session.isOwner,
          forcedBreakpoint: this.stores.viewport.forcedBreakpoint,
          viewportBreakpoint: this.stores.viewport.viewportBreakpoint,
        }),
      (actionLabel) => this.pushUndoSnapshot(actionLabel),
      () => this.scheduleSave(),
    );
    this.uiController = new GridUiController(stores, dependencies);
    this.settingsController = new GridSettingsController(
      stores,
      (actionLabel) => this.pushUndoSnapshot(actionLabel),
      () => this.scheduleSave(),
    );
    this.tileContentController = new GridTileContentController(
      stores,
      (actionLabel) => this.pushUndoSnapshot(actionLabel),
      () => this.scheduleSave(),
    );
    this.tileStructureController = new GridTileStructureController(
      stores,
      dependencies,
      () => this.getViewportGridY(),
      (actionLabel) => this.pushUndoSnapshot(actionLabel),
      () => this.scheduleSave(),
      () => this.refreshStableSnapshot(),
      (gridId, tileId) =>
        this.recordChatTileForCleanup(gridId, tileId),
    );
    this.viewportController = new GridViewportController(
      stores,
      dependencies,
    );
    this.persistenceController = new GridPersistenceController(
      stores,
      dependencies,
      () =>
        this.canEdit({
          isOwner: this.stores.session.isOwner,
          forcedBreakpoint: this.stores.viewport.forcedBreakpoint,
          viewportBreakpoint: this.stores.viewport.viewportBreakpoint,
        }),
      () => this.flushChatCleanup(),
    );
    this.uploadController = new GridUploadController(stores, () =>
      this.scheduleSave(),
    );
    this.historyController = new GridHistoryController(
      stores,
      dependencies,
      (
        breakpoint,
        grid,
        resolvedUrls,
        resolvedDocumentItemUrls,
      ) =>
        this.setForcedBreakpoint(
          breakpoint,
          grid,
          resolvedUrls,
          resolvedDocumentItemUrls,
        ),
      (breakpoint) =>
        this.viewportController.waitForLayoutReady(breakpoint),
      () => this.commitGestureGeometry(),
      (resolvedUrls, resolvedDocumentItemUrls) =>
        this.scheduleSave(resolvedUrls, resolvedDocumentItemUrls),
    );
  }

  registerLayoutReadinessAdapter(
    adapter: GridLayoutReadinessAdapter,
  ): () => void {
    return this.viewportController.registerLayoutReadinessAdapter(
      adapter,
    );
  }

  canEdit({
    isOwner,
    forcedBreakpoint,
    viewportBreakpoint,
  }: GridEditPermissionInput): boolean {
    return this.viewportController.canEdit({
      isOwner,
      forcedBreakpoint,
      viewportBreakpoint,
    });
  }

  setMenuActive(tileId: string): void {
    this.uiController.setMenuActive(tileId);
  }

  setPanelActive(tileId: string, panelId: string): void {
    this.uiController.setPanelActive(tileId, panelId);
  }

  toggleMenuActive(tileId: string): void {
    this.uiController.toggleMenuActive(tileId);
  }

  togglePanelActive(tileId: string, panelId: string): void {
    this.uiController.togglePanelActive(tileId, panelId);
  }

  closeMenus(): void {
    this.uiController.closeMenus();
  }

  setShowMetaData(value: boolean): void {
    this.uiController.setShowMetaData(value);
  }

  setShowMetaDataVerbose(value: boolean): void {
    this.uiController.setShowMetaDataVerbose(value);
  }

  getCookieValue(name: string): string | null {
    return this.uiController.getCookieValue(name);
  }

  setCookieValue(name: string, value: string, days = 365): void {
    this.uiController.setCookieValue(name, value, days);
  }

  setActiveBreakpoint(breakpoint: Breakpoint): void {
    this.viewportController.setActiveBreakpoint(breakpoint);
  }

  setViewportBreakpoint(breakpoint: Breakpoint): void {
    this.viewportController.setViewportBreakpoint(breakpoint);
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
    this.viewportController.setForcedBreakpoint(
      breakpoint,
      grid,
      resolvedUrls,
      resolvedDocumentItemUrls,
    );
  }

  setDisplayPositions(positions: GridLayoutItem[]): void {
    this.viewportController.setDisplayPositions(positions);
  }

  getBreakpointPositions(
    grid: Grid | null,
    breakpoint: Breakpoint,
  ): Record<string, TilePosition> | undefined {
    return this.viewportController.getBreakpointPositions(
      grid,
      breakpoint,
    );
  }

  hasBreakpointOverride(
    grid: Grid | null,
    breakpoint: Breakpoint,
  ): boolean {
    return this.viewportController.hasBreakpointOverride(
      grid,
      breakpoint,
    );
  }

  async fetchGrids(): Promise<boolean> {
    return this.collectionController.fetchGrids();
  }

  async createGrid(name: string): Promise<string | null> {
    return this.collectionController.createGrid(name);
  }

  async duplicateGrid(
    sourceGrid: Grid,
    copyDepth: CopyDepth = "full",
    storagePlan?: ConfirmedGridDuplicateStorage,
  ): Promise<string | null> {
    return this.collectionController.duplicateGrid(
      sourceGrid,
      copyDepth,
      storagePlan,
    );
  }

  recordRecent(id: string): void {
    this.collectionController.recordRecent(id);
  }

  async loadRecents(): Promise<void> {
    await this.collectionController.loadRecents();
  }

  async saveRecents(): Promise<void> {
    await this.collectionController.saveRecents();
  }

  async renameGrid(
    id: string,
    newName: string,
    activeGrid: Grid | null = this.stores.session.currentGrid,
  ): Promise<void> {
    await this.collectionController.renameGrid(
      id,
      newName,
      activeGrid,
    );
  }

  resetSessionDependents(): void {
    this.sessionController.resetSessionDependents();
  }

  async loadGrid(id: string): Promise<void> {
    await this.sessionController.loadGrid(id);
  }

  clearSession(): void {
    this.sessionController.clearSession();
  }

  scheduleSave(
    resolvedUrls: Record<string, string> =
      this.stores.uploads.resolvedUrls,
    resolvedDocumentItemUrls: Record<
      string,
      Record<string, string>
    > = this.stores.uploads.resolvedDocumentItemUrls,
  ): void {
    this.persistenceController.scheduleSave(
      resolvedUrls,
      resolvedDocumentItemUrls,
    );
  }

  async flushSaves(): Promise<void> {
    await this.persistenceController.flushSaves();
  }

  async saveGrid(
    resolvedUrls: Record<string, string> =
      this.stores.uploads.resolvedUrls,
    resolvedDocumentItemUrls: Record<
      string,
      Record<string, string>
    > = this.stores.uploads.resolvedDocumentItemUrls,
  ): Promise<void> {
    await this.persistenceController.saveGrid(
      resolvedUrls,
      resolvedDocumentItemUrls,
    );
  }

  async deleteGrid(
    id: string,
    activeGrid: Grid | null = this.stores.session.currentGrid,
    clearActiveGrid?: () => void,
  ): Promise<void> {
    await this.collectionController.deleteGrid(
      id,
      activeGrid,
      clearActiveGrid,
    );
  }

  clearSessionIfGridDeleted(id: string): void {
    this.sessionController.clearSessionIfGridDeleted(id);
  }

  captureSnapshot(
    actionLabel: string,
    urlMaps?: GridHistoryUrlMaps,
  ): Snapshot | null {
    return this.historyController.captureSnapshot(
      actionLabel,
      urlMaps,
    );
  }

  refreshStableSnapshot(urlMaps?: GridHistoryUrlMaps): void {
    this.historyController.refreshStableSnapshot(urlMaps);
  }

  pushUndoSnapshot(
    actionLabel: string,
    urlMaps?: GridHistoryUrlMaps,
  ): void {
    this.historyController.pushUndoSnapshot(actionLabel, urlMaps);
  }

  async undo(urlMaps?: GridHistoryUrlMaps): Promise<void> {
    await this.historyController.undo(urlMaps);
  }

  async redo(urlMaps?: GridHistoryUrlMaps): Promise<void> {
    await this.historyController.redo(urlMaps);
  }

  async undoRedoUntil(
    snapshotId: number,
    urlMaps?: GridHistoryUrlMaps,
  ): Promise<void> {
    await this.historyController.undoRedoUntil(snapshotId, urlMaps);
  }

  async applySnapshot(
    snapshot: Snapshot,
    urlMaps?: GridHistoryUrlMaps,
  ): Promise<void> {
    await this.historyController.applySnapshot(snapshot, urlMaps);
  }

  beginEditing(
    tileId: string,
    urlMaps?: GridHistoryUrlMaps,
  ): void {
    this.historyController.beginEditing(tileId, urlMaps);
  }

  commitEditing(urlMaps?: GridHistoryUrlMaps): void {
    this.historyController.commitEditing(urlMaps);
  }

  beginMove(urlMaps?: GridHistoryUrlMaps): void {
    this.historyController.beginMove(urlMaps);
  }

  commitMove(
    urlMaps?: GridHistoryUrlMaps,
  ): void {
    this.historyController.commitMove(urlMaps);
  }

  beginResize(urlMaps?: GridHistoryUrlMaps): void {
    this.historyController.beginResize(urlMaps);
  }

  commitResize(
    urlMaps?: GridHistoryUrlMaps,
  ): void {
    this.historyController.commitResize(urlMaps);
  }

  /**
   * Commit the geometry produced by a move/resize gesture. Desktop gestures
   * synchronize rendered positions into canonical tiles; non-desktop gestures
   * capture the active breakpoint override. Either way persistence is
   * scheduled exactly once.
   */
  private commitGestureGeometry(): void {
    this.layoutController.commitGestureGeometry();
  }

  /**
   * Record a removed chat tile for deferred Firestore message cleanup. The tile
   * is not yet deleted — `flushChatCleanup` reclaims it once it can no longer be
   * restored via undo/redo.
   */
  private recordChatTileForCleanup(
    gridId: string,
    tileId: string,
  ): void {
    const existing = this.pendingChatDeletions.get(gridId);
    if (existing) {
      existing.add(tileId);
    } else {
      this.pendingChatDeletions.set(gridId, new Set([tileId]));
    }
  }

  /**
   * Garbage-collect pending chat-tile message deletions for the current grid.
   * A pending tile's messages are hard-deleted once the tile can no longer be
   * brought back by an undo. Mid-session that means it must be absent from both
   * the live grid and every undo/redo snapshot. At teardown (`discardingHistory`
   * — grid switch / clear) the stacks are about to be thrown away, so the tile
   * is unrestorable regardless of the stacks and only the live grid protects it.
   *
   * Deletes are fire-and-forget; any that miss this pass (e.g. the client dies
   * first, or a removed tile is still parked in the undo stack at teardown of a
   * grid that is kept) are reclaimed by the server-side sweep.
   */
  private flushChatCleanup(discardingHistory = false): void {
    const grid = this.stores.session.currentGrid;
    if (!grid) return;

    const pending = this.pendingChatDeletions.get(grid.id);
    if (!pending || pending.size === 0) return;

    const reachable = new Set(grid.tiles.map((tile) => tile.i));
    if (!discardingHistory) {
      const referenced = this.stores.history.manager?.getReferencedTileIds();
      if (referenced) {
        for (const tileId of referenced) reachable.add(tileId);
      }
    }

    const chatService = this.dependencies.getChatService();
    for (const tileId of [...pending]) {
      if (reachable.has(tileId)) continue;
      pending.delete(tileId);
      void chatService
        .deleteAllMessages(grid.id, tileId)
        .catch((error: unknown) => console.error(error));
    }

    // At teardown the session and its undo/redo stacks are discarded, so any
    // tile still pending here is no longer a pending removal — it was either
    // deleted above or restored into the live grid. Drop the grid's entry so it
    // can't outlive the session and stale-delete a tile in a later session that
    // reuses the same grid id. Mid-session, only drop it once fully drained.
    if (discardingHistory || pending.size === 0) {
      this.pendingChatDeletions.delete(grid.id);
    }
  }

  startUpload(input: StartUploadInput): string | null {
    return this.uploadController.startUpload(input);
  }

  progressUpload(uploadId: string, progress: number): boolean {
    return this.uploadController.progressUpload(uploadId, progress);
  }

  resolveUpload(
    uploadId: string,
    url: string,
    hash?: string,
    final = true,
  ): boolean {
    return this.uploadController.resolveUpload(uploadId, url, hash, final);
  }

  failUpload(uploadId: string): boolean {
    return this.uploadController.failUpload(uploadId);
  }

  abandonUpload(uploadId: string): boolean {
    return this.uploadController.abandonUpload(uploadId);
  }

  cancelUpload(uploadId: string): boolean {
    return this.uploadController.cancelUpload(uploadId);
  }

  /**
   * Revoke a locally created object URL through the uploads store so the
   * exactly-once ownership ledger stays the single revocation authority.
   * Optimistic upload flows route their early-bail and pre-record cleanup here
   * instead of calling `URL.revokeObjectURL` directly.
   */
  revokeOwnedObjectUrl(url: string | undefined): boolean {
    return this.uploadController.revokeOwnedObjectUrl(url);
  }

  setTileUploading(tileId: string, progress: number): void {
    this.uploadController.setTileUploading(tileId, progress);
  }

  clearTileUploading(tileId: string): void {
    this.uploadController.clearTileUploading(tileId);
  }

  setResolvedUrl(tileId: string, url: string): void {
    this.uploadController.setResolvedUrl(tileId, url);
  }

  setResolvedDocumentItemUrl(
    tileId: string,
    itemId: string,
    url: string,
  ): void {
    this.uploadController.setResolvedDocumentItemUrl(
      tileId,
      itemId,
      url,
    );
  }

  getResolvedUrl(tileId: string): string | undefined {
    return this.uploadController.getResolvedUrl(tileId);
  }

  clearResolvedUrl(tileId: string): void {
    this.uploadController.clearResolvedUrl(tileId);
  }

  clearResolvedDocumentItemsForTile(tileId: string): void {
    this.uploadController.clearResolvedDocumentItemsForTile(tileId);
  }

  setVerticalCompact(value: boolean): void {
    this.settingsController.setVerticalCompact(value);
  }

  addTile(content: TileContent): string | null {
    return this.tileStructureController.addTile(content);
  }

  setTileContent(id: string, content: TileContent): void {
    this.tileContentController.setTileContent(id, content);
  }

  patchTileContent(
    id: string,
    patch: Partial<AnyTileContent>,
  ): void {
    this.tileContentController.patchTileContent(id, patch);
  }

  patchTileContentSilently(
    id: string,
    patch: Partial<AnyTileContent>,
  ): void {
    this.tileContentController.patchTileContentSilently(id, patch);
  }

  autosaveTileContent(
    id: string,
    patch: Partial<AnyTileContent>,
  ): void {
    this.tileContentController.autosaveTileContent(id, patch);
  }

  patchDocumentItem(
    tileId: string,
    itemId: string,
    itemPatch: Partial<DocumentItem>,
  ): void {
    this.tileContentController.patchDocumentItem(
      tileId,
      itemId,
      itemPatch,
    );
  }

  updateCaption({ tileId, caption }: UpdateCaptionInput): void {
    this.settingsController.updateCaption({ tileId, caption });
  }

  renameCurrentGrid(name: string): void {
    this.settingsController.renameCurrentGrid(name);
  }

  setGridTheme(themeId: string): void {
    this.settingsController.setGridTheme(themeId);
  }

  setDuplicatable(value: boolean): void {
    this.settingsController.setDuplicatable(value);
  }

  addBackgroundImage(url: string, embed: boolean, hash?: string): void {
    this.settingsController.addBackgroundImage(url, embed, hash);
  }

  removeBackgroundImage(): void {
    this.settingsController.removeBackgroundImage();
  }

  setCustomOgImage(url: string): void {
    this.settingsController.setCustomOgImage(url);
  }

  removeCustomOgImage(): void {
    this.settingsController.removeCustomOgImage();
  }

  setBackgroundColor(color: string): void {
    this.settingsController.setBackgroundColor(color);
  }

  removeBackgroundColor(): void {
    this.settingsController.removeBackgroundColor();
  }

  getViewportGridY(): number {
    return this.layoutController.getViewportGridY();
  }

  duplicateTile(id: string): string | null {
    return this.tileStructureController.duplicateTile(id);
  }

  removeTile(id: string): void {
    this.tileStructureController.removeTile(id);
  }

  resizeTile(id: string, width: number, height: number): void {
    this.tileStructureController.resizeTile(id, width, height);
  }

  toggleTileBorder(id: string): void {
    this.settingsController.toggleTileBorder(id);
  }

  toggleLinkBackground(id: string): void {
    this.settingsController.toggleLinkBackground(id);
  }

  commitRenderedDesktopLayout(
    layout: GridLayoutItem[] = this.stores.viewport.displayPositions,
  ): void {
    this.layoutController.commitRenderedDesktopLayout(layout);
  }

  commitCompactedLayout(layout: GridLayoutItem[]): void {
    this.layoutController.commitCompactedLayout(layout);
  }

  updateBreakpointOverride(): void {
    this.layoutController.updateBreakpointOverride();
  }

  saveBreakpointPositions(
    breakpoint: Breakpoint,
    tiles: GridLayoutItem[],
  ): void {
    this.layoutController.saveBreakpointPositions(breakpoint, tiles);
  }

  resetBreakpoint(breakpoint: Breakpoint): void {
    this.layoutController.resetBreakpoint(breakpoint);
  }
}
