import { defineStore } from "pinia";
import { type Grid, type CopyDepth } from "@grids/contracts/types";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import {
  ContentType,
  type TileContent,
  type AnyTileContent,
  type LinkContent,
  type DocumentsContent,
  type DocumentItem,
} from "@grids/contracts/types";
import type { Breakpoint, TilePosition, Tile } from "@grids/contracts/types";
import { v4 as uuidv4 } from "uuid";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { createTile } from "@/utils/TileUtils";
import { getTileDefinition } from "@/registries/tileRegistry";
import {
  adjustTilePosition,
  findBestXAtRow,
  findFirstAvailableSpot,
  pushTilesForNewItem,
} from "@/utils/GridPlacementUtils";
import { useToastStore } from "@/stores/toast";
import { useThemeStore } from "@/stores/theme";
import { UndoRedoManager } from "@/undo/UndoRedoManager";
import type { Snapshot } from "@/undo/UndoTypes";
import { AnalyticsEventType } from "@grids/contracts/types";

// Lazy accessor — don't resolve the service at module load because main.ts
// registers the service factory in an async IIFE that runs AFTER static imports.
const svc = () => getServiceFactory().getGridService();

function logTileEvent(
  eventType: AnalyticsEventType.TILE_ADDED | AnalyticsEventType.TILE_REMOVED,
  gridId: string,
  tileType: ContentType,
  tileId: string,
): void {
  // Internal-only suggestion tiles are seeded by the app, not user-added.
  if (tileType === ContentType.SUGGESTION) return;
  try {
    const analytics = getServiceFactory().getAnalyticsService();
    void analytics
      .logEvent({
        eventType,
        userId: getAuthProvider().getCurrentUserId(),
        gridId,
        metadata: { tileType, tileId },
      })
      .catch(() => undefined);
  } catch {
    // Service factory not ready — drop the event rather than crash the mutation.
  }
}

let undoRedoManager: UndoRedoManager | null = null;
let pendingDragSnapshot: Snapshot | null = null;
let pendingResizeSnapshot: Snapshot | null = null;
let lastStableSnapshot: Snapshot | null = null;
let pendingEditSnapshot: Snapshot | null = null;
let editingTileId: string | null = null;

function patchSnapshotBlobUrl(
  snapshot: Snapshot | null,
  tileId: string,
  permanentUrl: string,
): void {
  if (!snapshot) return;
  const tile = snapshot.tiles.find((t) => t.i === tileId);
  if (
    tile &&
    "src" in tile.content &&
    typeof (tile.content as { src: string }).src === "string" &&
    (tile.content as { src: string }).src.startsWith("blob:")
  ) {
    (tile.content as { src: string }).src = permanentUrl;
  }
}

function patchSnapshotDocumentItemUrl(
  snapshot: Snapshot | null,
  tileId: string,
  itemId: string,
  permanentUrl: string,
): void {
  if (!snapshot) return;
  const tile = snapshot.tiles.find((t) => t.i === tileId);
  if (!tile || tile.content.type !== ContentType.DOCUMENT) return;
  const doc = tile.content as DocumentsContent;
  const item = doc.items?.find((i) => i.id === itemId);
  if (
    item &&
    typeof item.url === "string" &&
    item.url.startsWith("blob:")
  ) {
    item.url = permanentUrl;
  }
}

export const useGridStore = defineStore("grid", {
  state: () => ({
    undoRedoVersion: 0,
    grids: [] as Array<Grid>,
    currentGrid: null as Grid | null,
    isLoading: false,
    error: null as string | null,
    showMetaData: false,
    showMetaDataVerbose: false,
    isOwner: false,
    // True when currentGrid was populated by loadDemoGrid() rather than a
    // real Firestore-backed grid. Consumers (e.g. App.vue's top bar) use
    // this to avoid treating the in-memory marketing demo like a real grid
    // page — no "Claim my Grid" CTA, no title editor, no routing assumptions.
    isDemoGrid: false,
    recentGridIds: [] as string[],
    activeTileId: null as string | null,
    activePanelId: null as string | null,
    // Which color target the color picker is editing for the active tile.
    // Shared so the toolbar swatch can reflect the actively selected target.
    activeColorTarget: "fill" as "fill" | "overlay",
    // Tracks tiles that are currently uploading media in the background.
    // Key = tile ID, value = upload progress (0–1) or -1 for indeterminate.
    uploadingTiles: {} as Record<string, number>,
    // Maps tile ID → permanent storage URL for tiles still displaying a blob: preview.
    // Used by the persistence layer to write the real URL instead of the blob.
    // The blob URL stays as the in-memory src so the <img>/<video> element never reloads.
    resolvedUrls: {} as Record<string, string>,
    /**
     * For document tiles: tileId → (itemId → permanent storage URL)
     * while items still display blob: URLs in the UI.
     */
    resolvedDocumentItemUrls: {} as Record<string, Record<string, string>>,
    // When set, the TextContent component for this tile will auto-enter
    // edit mode on mount and place the cursor at the end. Cleared by the
    // component once it consumes the focus request.
    pendingFocusTileId: null as string | null,
    activeBreakpoint: "lg" as Breakpoint,
    // The breakpoint the viewport naturally supports based on window width,
    // independent of any forced override. Used by BreakpointSwitcher to know
    // which breakpoints are "native" vs require scaling (view-only).
    viewportBreakpoint: "lg" as Breakpoint,
    // When non-null, Grid.vue uses this breakpoint instead of the viewport-derived one.
    // Lets owners preview/edit at any breakpoint without resizing the browser window.
    forcedBreakpoint: null as Breakpoint | null,
    // When true, Grid.vue should skip the next displayLayout rebuild triggered by
    // overrides changing (because the change came from a drag/resize and positions
    // are already correct in the stable ref).
    skipOverrideRebuild: false,
    // Snapshot of tile positions as currently rendered by Grid.vue's displayLayout.
    // Updated by Grid.vue so that GridMenu can read accurate positions for breakpoint saves.
    displayPositions: [] as Array<{
      i: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }>,
  }),

  getters: {
    verticalCompact(): boolean {
      return this.currentGrid?.verticalCompact ?? true;
    },

    /**
     * Whether the current user can edit the grid right now.
     * Returns false when:
     *   - The user is not the owner, OR
     *   - The user is forcing a breakpoint larger than what the viewport
     *     naturally supports (view-only preview mode).
     *
     * Components should use `canEdit` instead of `isOwner` for any gate
     * that controls grid manipulation (drag, resize, content editing, etc.).
     * Use `isOwner` only for UI elements that should remain visible to the
     * owner even during a view-only preview (e.g. breakpoint switcher,
     * bottom-left buttons, GridMenu).
     */
    canEdit(): boolean {
      if (!this.isOwner) return false;

      const forced = this.forcedBreakpoint;
      if (forced) {
        const rank = (bp: Breakpoint): number =>
          bp === "sm" ? 0 : bp === "md" ? 1 : 2;
        if (rank(forced) > rank(this.viewportBreakpoint)) return false;
      }

      return true;
    },

    canUndo(): boolean {
      void this.undoRedoVersion;
      return undoRedoManager?.canUndo() ?? false;
    },

    canRedo(): boolean {
      void this.undoRedoVersion;
      return undoRedoManager?.canRedo() ?? false;
    },

    undoActionLabel(): string | null {
      void this.undoRedoVersion;
      return undoRedoManager?.getLastActionLabel() ?? null;
    },

    redoActionLabel(): string | null {
      void this.undoRedoVersion;
      return undoRedoManager?.getNextRedoActionLabel() ?? null;
    },

    undoRedoStacks(): {
      undoStack: { actionLabel: string; timestamp: number; snapshotId: number }[];
      redoStack: { actionLabel: string; timestamp: number; snapshotId: number }[];
    } {
      void this.undoRedoVersion;
      return undoRedoManager?.getStacks() ?? { undoStack: [], redoStack: [] };
    },
  },

  actions: {
    setMenuActive(tileId: string) {
      this.activeTileId = tileId;
      this.activePanelId = null;
    },

    setPanelActive(tileId: string, panelId: string) {
      this.activeTileId = tileId;
      this.activePanelId = panelId;
      this.activeColorTarget = "fill";
    },

    // toggles the menu open and closed, and only allows 1 tile to have a menu open at a time
    toggleMenuActive(tileId: string) {
      if (!!this.activePanelId) {
        this.activePanelId = null;
        if (this.activeTileId === tileId) {
          return;
        }
      }

      if (this.activeTileId !== tileId) {
        this.activeTileId = tileId;
        return;
      }

      this.activeTileId = null;
    },

    setColorTarget(target: "fill" | "overlay") {
      this.activeColorTarget = target;
    },

    // toggles the panels open and closed, only allows 1 tile to have a panel open at a time
    togglePanelActive(tileId: string, panelId: string) {
      // Each time the picker opens it starts on the Fill target.
      this.activeColorTarget = "fill";
      if (this.activeTileId !== tileId) {
        this.activeTileId = tileId;
        this.activePanelId = panelId;
        return;
      }

      if (this.activePanelId !== panelId) {
        this.activePanelId = panelId;
        return;
      }

      this.activeTileId = null;
      this.activePanelId = null;
    },

    closeMenus() {
      this.activeTileId = null;
      this.activePanelId = null;
    },

    // ── Undo / Redo ──────────────────────────────────────────

    captureSnapshot(actionLabel: string): Snapshot | null {
      if (!this.currentGrid) return null;
      const tiles: Tile[] = JSON.parse(
        JSON.stringify(this.currentGrid.tiles),
      );
      for (const tile of tiles) {
        if (
          "src" in tile.content &&
          typeof (tile.content as { src: string }).src === "string" &&
          (tile.content as { src: string }).src.startsWith("blob:")
        ) {
          const resolved = this.resolvedUrls[tile.i];
          if (resolved) {
            (tile.content as { src: string }).src = resolved;
          }
        }
        if (tile.content.type === ContentType.DOCUMENT) {
          const doc = tile.content as DocumentsContent;
          const map = this.resolvedDocumentItemUrls[tile.i];
          if (map && doc.items?.length) {
            for (const item of doc.items) {
              if (
                typeof item.url === "string" &&
                item.url.startsWith("blob:")
              ) {
                const resolvedUrl = map[item.id];
                if (resolvedUrl) {
                  item.url = resolvedUrl;
                }
              }
            }
          }
        }
      }
      return {
        tiles,
        overrides: JSON.parse(
          JSON.stringify(this.currentGrid.overrides ?? {}),
        ),
        verticalCompact: this.currentGrid.verticalCompact,
        themeId: this.currentGrid.themeId ?? "",
        backgroundImageSrc: this.currentGrid.backgroundImageSrc,
        backgroundEmbed: this.currentGrid.backgroundEmbed,
        backgroundColor: this.currentGrid.backgroundColor || "",
        forcedBreakpoint: this.forcedBreakpoint ?? this.activeBreakpoint,
        actionLabel,
      };
    },

    refreshStableSnapshot() {
      lastStableSnapshot = this.captureSnapshot("");
    },

    pushUndoSnapshot(actionLabel: string) {
      const snapshot = this.captureSnapshot(actionLabel);
      if (!snapshot || !undoRedoManager) return;

      undoRedoManager.pushSnapshot(snapshot);
      this.refreshStableSnapshot();
    },

    async undo() {
      if (!undoRedoManager || !this.currentGrid) return;
      const current = this.captureSnapshot("");
      if (!current) return;

      const snapshot = undoRedoManager.undo(current);
      if (!snapshot) return;

      await this.applySnapshot(snapshot);
    },

    async redo() {
      if (!undoRedoManager || !this.currentGrid) return;
      const current = this.captureSnapshot("");
      if (!current) return;

      const snapshot = undoRedoManager.redo(current);
      if (!snapshot) return;

      await this.applySnapshot(snapshot);
    },

    async undoRedoUntil(snapshotId: number) {
      if (!undoRedoManager || !this.currentGrid) return;
      const current = this.captureSnapshot("");
      if (!current) return;

      const snapshot = undoRedoManager.undoRedoUntil(snapshotId, current);
      if (!snapshot) return;

      await this.applySnapshot(snapshot);
    },

    async applySnapshot(snapshot: Snapshot) {
      if (!this.currentGrid) return;

      const breakpointChanged =
        this.forcedBreakpoint !== null &&
        snapshot.forcedBreakpoint !== this.forcedBreakpoint;

      if (breakpointChanged) {
        this.setForcedBreakpoint(snapshot.forcedBreakpoint);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      this.currentGrid.tiles = snapshot.tiles;
      this.currentGrid.overrides = snapshot.overrides;
      this.currentGrid.verticalCompact = snapshot.verticalCompact;
      this.currentGrid.backgroundImageSrc = snapshot.backgroundImageSrc;
      this.currentGrid.backgroundEmbed = snapshot.backgroundEmbed;
      this.currentGrid.backgroundColor = snapshot.backgroundColor;

      if (this.currentGrid.themeId !== snapshot.themeId) {
        this.currentGrid.themeId = snapshot.themeId;
        const themeStore = useThemeStore();
        themeStore.setTheme(snapshot.themeId);
      }

      this.saveGrid();
      this.refreshStableSnapshot();
      this.undoRedoVersion++;
    },

    beginEditing(tileId: string) {
      if (editingTileId) return;
      pendingEditSnapshot = this.captureSnapshot("Edit tile");
      editingTileId = tileId;
      this.refreshStableSnapshot();
    },

    commitEditing() {
      if (pendingEditSnapshot && undoRedoManager) {
        const current = this.captureSnapshot("");
        if (current) {
          const { actionLabel: _, ...pendingData } = pendingEditSnapshot;
          const { actionLabel: _2, ...currentData } = current;
          if (JSON.stringify(pendingData) !== JSON.stringify(currentData)) {
            undoRedoManager.pushSnapshot(pendingEditSnapshot);
            this.refreshStableSnapshot();
          }
        }
      }
      pendingEditSnapshot = null;
      editingTileId = null;
    },

    beginMove() {
      if (!pendingDragSnapshot) {
        if (lastStableSnapshot) {
          pendingDragSnapshot = {
            ...lastStableSnapshot,
            actionLabel: "Move tile",
          };
        } else {
          pendingDragSnapshot = this.captureSnapshot("Move tile");
        }
      }
    },

    commitMove() {
      if (pendingDragSnapshot && undoRedoManager) {
        undoRedoManager.pushSnapshot(pendingDragSnapshot);
      }
      pendingDragSnapshot = null;
      if (this.activeBreakpoint !== "lg") {
        this.updateBreakpointOverride();
      } else {
        this.updateGrid();
      }
      this.refreshStableSnapshot();
    },

    beginResize() {
      if (!pendingResizeSnapshot) {
        if (lastStableSnapshot) {
          pendingResizeSnapshot = {
            ...lastStableSnapshot,
            actionLabel: "Resize tile",
          };
        } else {
          pendingResizeSnapshot = this.captureSnapshot("Resize tile");
        }
      }
    },

    commitResize() {
      if (pendingResizeSnapshot && undoRedoManager) {
        undoRedoManager.pushSnapshot(pendingResizeSnapshot);
      }
      pendingResizeSnapshot = null;
      if (this.activeBreakpoint !== "lg") {
        this.updateBreakpointOverride();
      } else {
        this.updateGrid();
      }
      this.refreshStableSnapshot();
    },

    // Mark a tile as currently uploading (progress: 0–1, or -1 for indeterminate)
    setTileUploading(tileId: string, progress: number) {
      this.uploadingTiles[tileId] = progress;
    },

    // Clear the uploading state for a tile once upload completes or fails
    clearTileUploading(tileId: string) {
      delete this.uploadingTiles[tileId];
    },

    // Store the permanent storage URL for a tile that is still showing a blob preview.
    // This URL is used only for persistence — the displayed src is unchanged.
    // Also updates undo/redo snapshots and the lastStable and pendingEdit snapshots
    setResolvedUrl(tileId: string, url: string) {
      this.resolvedUrls[tileId] = url;
      undoRedoManager?.replaceBlobUrl(tileId, url);
      patchSnapshotBlobUrl(lastStableSnapshot, tileId, url);
      patchSnapshotBlobUrl(pendingEditSnapshot, tileId, url);
      patchSnapshotBlobUrl(pendingDragSnapshot, tileId, url);
      patchSnapshotBlobUrl(pendingResizeSnapshot, tileId, url);
    },

    setResolvedDocumentItemUrl(tileId: string, itemId: string, url: string) {
      if (!this.resolvedDocumentItemUrls[tileId]) {
        this.resolvedDocumentItemUrls[tileId] = {};
      }
      this.resolvedDocumentItemUrls[tileId][itemId] = url;
      undoRedoManager?.replaceBlobUrl(tileId, url, itemId);
      patchSnapshotDocumentItemUrl(lastStableSnapshot, tileId, itemId, url);
      patchSnapshotDocumentItemUrl(pendingEditSnapshot, tileId, itemId, url);
      patchSnapshotDocumentItemUrl(pendingDragSnapshot, tileId, itemId, url);
      patchSnapshotDocumentItemUrl(pendingResizeSnapshot, tileId, itemId, url);
    },

    // Retrieve the resolved storage URL for a tile, if one exists
    getResolvedUrl(tileId: string): string | undefined {
      return this.resolvedUrls[tileId];
    },

    // Clean up resolved URL entry (e.g. when tile is removed)
    clearResolvedUrl(tileId: string) {
      delete this.resolvedUrls[tileId];
    },

    clearResolvedDocumentItemsForTile(tileId: string) {
      delete this.resolvedDocumentItemUrls[tileId];
    },

    async fetchGrids() {
      this.isLoading = true;
      this.error = null;
      this.grids = [];

      const userId = getAuthProvider().getCurrentUserId();
      if (!userId) {
        this.error = "User not authenticated";
        this.isLoading = false;
        return;
      }

      try {
        this.grids = await svc().fetchGridsByUserId(userId);
        await this.loadRecents();
      } catch (err) {
        this.error = "Failed to fetch grids.";
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },

    // Create a new grid for the user
    async createGrid(name: string): Promise<string | null> {
      const userId = getAuthProvider().getCurrentUserId();
      if (!userId) {
        this.error = "User not authenticated";
        return null;
      }

      if (!name) {
        name = `Grid ${this.grids.length + 1}`;
      }

      try {
        const newGrid = await svc().createGridWithStarterTiles(
          userId,
          name,
        );

        // Add the new grid to the state
        this.grids.push({ ...newGrid });

        return newGrid.id;
      } catch (err) {
        this.error = "Failed to create grid.";
        console.error(err);
        return null;
      }
    },

    // Duplicate an existing grid, creating a new grid owned by the current user.
    // Accepts any Grid object — not just the user's own — so this same logic can
    // power a future template gallery or cloning another user's published grid.
    //
    // copyDepth controls what gets carried over:
    //   'full'      → all tile content (media URLs shared by reference, chat cleared)
    //   'structure' → tile type/size/position only, content reset to defaults
    async duplicateGrid(
      sourceGrid: Grid,
      copyDepth: CopyDepth = "full",
    ): Promise<string | null> {
      const userId = getAuthProvider().getCurrentUserId();
      if (!userId) {
        this.error = "User not authenticated";
        return null;
      }

      try {
        const newGrid = await svc().cloneAndPersistGrid(
          userId,
          sourceGrid,
          copyDepth,
        );

        // Add to local state so the dashboard list updates immediately
        this.grids.push({ ...newGrid });

        return newGrid.id;
      } catch (err) {
        this.error = "Failed to duplicate grid.";
        console.error(err);
        return null;
      }
    },

    // Load a grid by ID
    async loadGrid(id: string) {
      this.isLoading = true;
      this.error = null;
      this.isOwner = false;
      this.isDemoGrid = false;

      undoRedoManager?.clear();
      undoRedoManager = new UndoRedoManager(() => {
        this.undoRedoVersion++;
      });

      try {
        this.currentGrid = await svc().fetchGrid(id);
        const userId = getAuthProvider().getCurrentUserId();
        this.isOwner = !!(
          userId &&
          this.currentGrid?.userId &&
          userId === this.currentGrid.userId
        );
        this.checkShowMetaDataCookie();
        this.recordRecent(id);

        await svc().touchLastOpenedAt(id);
        // update in-memory list timestamp for immediate UI sorting
        const idx = this.grids.findIndex((l) => l.id === id);
        if (idx !== -1) {
          this.grids[idx] = {
            ...this.grids[idx],
            lastOpenedAt: new Date(),
          } as Grid;
        }
        this.refreshStableSnapshot();
      } catch (err) {
        this.error = "Failed to load grid.";
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },

    // Load an in-memory demo grid without touching Firestore.
    // Used by the marketing homepage embed so visitors can preview a real
    // grid without incurring a network round-trip or db read.
    //
    // Intentionally does NOT trigger grid-theme application: page wrappers
    // (GridPage / UserSlugPage) are the only places that watch themeId and
    // call themeStore.applyGridTheme(). The embed component doesn't mount
    // those wrappers, so the demo grid's theme can't leak onto the document
    // root and repaint the surrounding landing page.
    loadDemoGrid(grid: Grid) {
      this.isLoading = false;
      this.error = null;
      this.currentGrid = grid;
      this.isOwner = false;
      this.isDemoGrid = true;
    },

    recordRecent(id: string) {
      const next = this.recentGridIds.filter((x) => x !== id);
      next.unshift(id);
      this.recentGridIds = next.slice(0, 3);
      // fire-and-forget persist
      this.saveRecents();
    },

    async loadRecents() {
      const userId = getAuthProvider().getCurrentUserId();
      if (!userId) return;
      try {
        this.recentGridIds = await svc().loadRecentGridIds(userId);
      } catch (err) {
        console.error("Failed to load recent grids:", err);
      }
    },

    async saveRecents() {
      const userId = getAuthProvider().getCurrentUserId();
      if (!userId) return;
      try {
        await svc().saveRecentGridIds(userId, this.recentGridIds);
      } catch (err) {
        console.error("Failed to save recent grids:", err);
      }
    },

    checkShowMetaDataCookie() {
      const cookieValue = this.getCookieValue("showMetaData");
      this.showMetaData = cookieValue === "true";
      const verboseCookieValue = this.getCookieValue("showMetaDataVerbose");
      this.showMetaDataVerbose = verboseCookieValue === "true";
    },

    setShowMetaData(value: boolean) {
      this.showMetaData = value;
      this.setCookieValue("showMetaData", value.toString());
    },

    setShowMetaDataVerbose(value: boolean) {
      this.showMetaDataVerbose = value;
      this.setCookieValue("showMetaDataVerbose", value.toString());
    },

    // Toggle the vertical compact (gravity) setting
    toggleVerticalCompact() {
      if (!this.currentGrid) return;

      this.pushUndoSnapshot("Toggle gravity");
      this.currentGrid.verticalCompact = !this.currentGrid.verticalCompact;
      this.updateGrid();
    },

    // Set the vertical compact (gravity) setting
    setVerticalCompact(value: boolean) {
      if (!this.currentGrid) return;

      this.pushUndoSnapshot("Set gravity");
      this.currentGrid.verticalCompact = value;
      this.updateGrid();
    },

    getCookieValue(name: string): string | null {
      const cookies = document.cookie.split("; ");
      const cookie = cookies.find((row) => row.startsWith(`${name}=`));
      return cookie ? cookie.split("=")[1] : null;
    },

    setCookieValue(name: string, value: string, days = 365) {
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/`;
    },

    // Save the current grid.
    // Delegates serialization, blob-URL resolution, and write queueing to the service.
    async saveGrid() {
      if (!this.currentGrid) {
        console.warn("No grid to save.");
        return;
      }

      // Block saves when the user isn't allowed to edit — covers both
      // non-owners and owners in view-only breakpoint preview mode.
      if (!this.canEdit) {
        return;
      }

      try {
        await svc().queueSave(
          this.currentGrid,
          this.resolvedUrls,
          this.resolvedDocumentItemUrls,
        );
      } catch (err) {
        this.error = "Failed to save grid.";
        console.error(err);
      }
    },

    // Add a new tile
    addTile(content: TileContent): string | null {
      if (!this.currentGrid) return null;

      const def = getTileDefinition(content.type);

      // Validate: maxPerGrid constraint (e.g. only one campfire per grid)
      if (def?.maxPerGrid) {
        const count = this.currentGrid.tiles.filter(
          (tile) => tile.content.type === content.type,
        ).length;
        if (count >= def.maxPerGrid) {
          const toastStore = useToastStore();
          toastStore.addToast(
            `Only ${def.maxPerGrid} ${def.label ?? content.type} tile${def.maxPerGrid > 1 ? "s" : ""} allowed per grid`,
            "error",
          );
          return null;
        }
      }

      const tileWidth = def?.defaultSize?.w ?? 2;
      const tileHeight = def?.defaultSize?.h ?? 2;

      const tiles = this.currentGrid.tiles;
      const colNum = this.currentGrid.colNum || 12;

      // --- Viewport-based tile placement ---
      // New tiles must appear where the user is looking. If the user has scrolled
      // down the grid, we force-place the tile at the viewport center row. When
      // that row is occupied, pushTilesForNewItem resolves all collisions in the
      // reactive data *before* Vue renders — so existing tiles slide out of the
      // way in the same frame and the user never sees an overlap.
      //
      // When the user is at the top of the grid (viewportY === 0) we fall back to
      // the traditional gap-search so new tiles fill from the top naturally.
      const viewportY = this.getViewportGridY();
      let position: { x: number; y: number };

      if (viewportY > 0) {
        // Force-place at the viewport row. Try to find an open X column at
        // that exact row first for a cleaner result; otherwise default to x=0.
        position = findBestXAtRow(
          tiles,
          colNum,
          tileWidth,
          tileHeight,
          viewportY,
        );
      } else {
        // At the top of the grid — use traditional gap search
        position = findFirstAvailableSpot(tiles, colNum, tileWidth, tileHeight);
      }

      this.pushUndoSnapshot("Add tile");

      // Push existing tiles out of the way BEFORE adding the new tile.
      // This modifies tile Y positions in the reactive data so Vue never
      // renders an intermediate frame with overlapping tiles.
      pushTilesForNewItem(tiles, position.x, position.y, tileWidth, tileHeight);

      const newTile = createTile(
        content.type,
        uuidv4(),
        position.x,
        position.y,
        tileWidth,
        tileHeight,
        content,
        "",
      );

      this.currentGrid.tiles.push(newTile);
      this.updateGrid();

      logTileEvent(
        AnalyticsEventType.TILE_ADDED,
        this.currentGrid.id,
        content.type,
        newTile.i,
      );

      return newTile.i;
    },

    setTileContent(id: string, content: TileContent) {
      if (!this.currentGrid) return;

      const tile = this.currentGrid.tiles.find((t) => t.i === id);
      if (!tile) return;

      this.pushUndoSnapshot("Change tile content");
      tile.content = content;
      if (content.type === ContentType.PROFILE) {
        tile.w = 4;
        tile.h = 4;
        adjustTilePosition(tile, this.currentGrid.colNum);
      }
      this.updateGrid();
    },

    patchTileContent(id: string, patch: Partial<AnyTileContent>) {
      if (!this.currentGrid) return;

      const tile = this.currentGrid.tiles.find((t) => t.i === id);
      if (!tile) return;

      const currentContent = tile.content as AnyTileContent &
        Record<string, unknown>;
      const patchRecord = patch as Record<string, unknown>;
      const hasChanges = Object.keys(patchRecord).some(
        (key) => !Object.is(currentContent[key], patchRecord[key]),
      );
      if (!hasChanges) return;

      if (editingTileId !== id) {
        this.pushUndoSnapshot("Update tile");
      }

      tile.content = {
        ...currentContent,
        ...patchRecord,
      } as TileContent;

      this.updateGrid();
    },

    patchDocumentItem(
      tileId: string,
      itemId: string,
      itemPatch: Partial<DocumentItem>,
    ) {
      if (!this.currentGrid) return;
      const tile = this.currentGrid.tiles.find((t) => t.i === tileId);
      if (!tile || tile.content.type !== ContentType.DOCUMENT) return;

      if (editingTileId !== tileId) {
        this.pushUndoSnapshot("Update document");
      }

      const doc = tile.content as DocumentsContent;
      const items = doc.items.map((it) =>
        it.id === itemId ? { ...it, ...itemPatch } : it,
      );
      tile.content = { ...doc, items } as TileContent;
      this.updateGrid();
    },

    setGridTheme(themeId: string) {
      if (!this.currentGrid) return;
      this.pushUndoSnapshot("Change theme");
      this.currentGrid.themeId = themeId;
      this.updateGrid();
    },

    // Toggle whether non-owners can duplicate this grid as a template
    setDuplicatable(value: boolean) {
      if (!this.currentGrid) return;
      this.currentGrid.duplicatable = value;
      this.updateGrid();
    },

    addBackgroundImage(url: string, embed: boolean) {
      if (!this.currentGrid) return;

      this.pushUndoSnapshot("Change background image");
      this.currentGrid.backgroundImageSrc = url;
      this.currentGrid.backgroundEmbed = embed;
      this.updateGrid();
    },

    removeBackgroundImage() {
      if (!this.currentGrid) return;
      this.pushUndoSnapshot("Remove background image");
      this.currentGrid.backgroundImageSrc = "";
      this.currentGrid.backgroundEmbed = false;
      this.updateGrid();
    },

    setBackgroundColor(color: string) {
      if (!this.currentGrid) return;
      this.pushUndoSnapshot("Change background color");
      this.currentGrid.backgroundColor = color;
      this.updateGrid();
    },

    removeBackgroundColor() {
      if (!this.currentGrid) return;
      this.pushUndoSnapshot("Remove background color");
      this.currentGrid.backgroundColor = "";
      this.updateGrid();
    },

    /**
     * Convert the viewport center to a grid Y coordinate.
     * Uses the grid element's bounding rect and the known row-height + margin
     * constants to determine which grid row is at the center of the screen.
     * Returns 0 if the grid element can't be found (safe fallback to old behaviour).
     */
    getViewportGridY(): number {
      const ROW_HEIGHT = 75;
      const MARGIN = 48;
      const CELL_HEIGHT = ROW_HEIGHT + MARGIN; // 123px per grid unit

      const gridEl = document.querySelector<HTMLElement>(".vue-grid-grid");
      if (!gridEl) return 0;

      // getBoundingClientRect().top is viewport-relative, so it already
      // accounts for how far the user has scrolled.
      const gridRect = gridEl.getBoundingClientRect();
      const viewportCenterY = window.innerHeight / 2;
      const pixelsIntoGrid = viewportCenterY - gridRect.top;

      // Convert pixel offset into grid row units (first row starts at MARGIN px)
      const gridY = Math.floor((pixelsIntoGrid - MARGIN) / CELL_HEIGHT);
      return Math.max(0, gridY);
    },

    // Duplicate a tile — deep-copies content, preserves size, places nearby
    duplicateTile(id: string): string | null {
      if (!this.currentGrid) return null;

      const source = this.currentGrid.tiles.find((t) => t.i === id);
      if (!source) return null;

      this.pushUndoSnapshot("Duplicate tile");

      const tiles = this.currentGrid.tiles;
      const colNum = this.currentGrid.colNum || 12;

      // Use the currently displayed size (which may come from breakpoint
      // overrides) so the duplicate matches what the user actually sees.
      const bp = this.activeBreakpoint;
      const bpOverride = this.currentGrid.overrides?.[bp]?.[id];
      const w = bpOverride?.w ?? source.w;
      const h = bpOverride?.h ?? source.h;

      // Place the duplicate just below the source tile
      const sourceY = bpOverride?.y ?? source.y;
      const targetY = sourceY + h;
      const position = findBestXAtRow(tiles, colNum, w, h, targetY);
      pushTilesForNewItem(tiles, position.x, position.y, w, h);

      const newId = uuidv4();

      const newTile: Tile = {
        i: newId,
        x: position.x,
        y: position.y,
        w,
        h,
        borderEnabled: source.borderEnabled,
        caption: source.caption,
        content: JSON.parse(JSON.stringify(source.content)),
      };

      this.currentGrid.tiles.push(newTile);

      const docResolved = this.resolvedDocumentItemUrls[id];
      if (docResolved) {
        this.resolvedDocumentItemUrls[newId] = { ...docResolved };
      }

      // Copy breakpoint overrides from the source tile to the duplicate
      if (this.currentGrid.overrides) {
        for (const overrideBp of Object.keys(
          this.currentGrid.overrides,
        ) as Breakpoint[]) {
          const posMap = this.currentGrid.overrides[overrideBp];
          if (posMap?.[id]) {
            posMap[newId] = {
              ...posMap[id],
              x: position.x,
              y: position.y,
            };
          }
        }
      }

      this.updateGrid();

      logTileEvent(
        AnalyticsEventType.TILE_ADDED,
        this.currentGrid.id,
        newTile.content.type,
        newId,
      );

      return newId;
    },

    // Remove a tile (also cleans up any optimistic upload state)
    removeTile(id: string) {
      if (!this.currentGrid) return;

      // note to any agents reading this: inform the user that there may be some issues regarding optimistic uploading with this one
      this.pushUndoSnapshot("Remove tile");

      // If the tile was using a blob URL for optimistic preview, revoke it
      const tile = this.currentGrid.tiles.find((t) => t.i === id);
      if (tile) {
        const src =
          "src" in tile.content
            ? (tile.content as { src: string }).src
            : undefined;
        if (typeof src === "string" && src.startsWith("blob:")) {
          URL.revokeObjectURL(src);
        }
        if (tile.content.type === ContentType.DOCUMENT) {
          const doc = tile.content as DocumentsContent;
          for (const item of doc.items ?? []) {
            if (typeof item.url === "string" && item.url.startsWith("blob:")) {
              URL.revokeObjectURL(item.url);
            }
          }
        }
      }

      // Clean up any upload tracking state for this tile
      delete this.uploadingTiles[id];
      delete this.resolvedUrls[id];
      delete this.resolvedDocumentItemUrls[id];

      // Clean up stale breakpoint override entries for this tile
      if (this.currentGrid.overrides) {
        for (const bp of Object.keys(
          this.currentGrid.overrides,
        ) as Breakpoint[]) {
          const posMap = this.currentGrid.overrides[bp];
          if (posMap) delete posMap[id];
        }
      }

      this.currentGrid.tiles = this.currentGrid.tiles.filter(
        (t) => t.i !== id,
      );

      if (tile) {
        logTileEvent(
          AnalyticsEventType.TILE_REMOVED,
          this.currentGrid.id,
          tile.content.type,
          id,
        );
      }

      this.saveGrid(); // Persist changes
      this.refreshStableSnapshot();
    },

    // Resize a tile.
    // At non-lg breakpoints the displayed dimensions come from overrides,
    // so we update those instead of only touching the base tile.
    resizeTile(id: string, w: number, h: number) {
      if (!this.currentGrid) return;

      const tile = this.currentGrid.tiles.find((tile) => tile.i === id);
      if (!tile) return;

      const bp = this.activeBreakpoint;

      if (bp === "lg") {
        // Desktop: update the base tile directly (existing behaviour)
        tile.w = w;
        tile.h = h;
        adjustTilePosition(tile, this.currentGrid.colNum);
        // Keep displayPositions in sync so updateGrid's sync-back
        // doesn't revert the programmatic resize.
        const dp = this.displayPositions.find((p) => p.i === id);
        if (dp) {
          dp.w = w;
          dp.h = h;
          dp.x = tile.x;
        }
        this.updateGrid();
        return;
      }

      // ── Non-lg breakpoint ──────────────────────────────────────
      // Only update the override for this breakpoint — leave the base
      // tile (lg) dimensions untouched so other breakpoints are unaffected.
      const bpCols = bp === "sm" ? 4 : 8;
      const clampedW = Math.min(w, bpCols);

      // Build / update the override for this breakpoint
      if (!this.currentGrid.overrides) {
        this.currentGrid.overrides = {};
      }
      if (!this.currentGrid.overrides[bp]) {
        // Seed overrides from the current display positions so we don't
        // lose the positions of every other tile.
        const positions: Record<string, TilePosition> = {};
        for (const pos of this.displayPositions) {
          positions[pos.i] = { x: pos.x, y: pos.y, w: pos.w, h: pos.h };
        }
        this.currentGrid.overrides[bp] = positions;
      }

      const overrides = this.currentGrid.overrides[bp];
      if (!overrides) return;
      const existing = overrides[id];
      const curX = existing?.x ?? tile.x;

      // Ensure the tile doesn't overflow the column count after resize
      const clampedX = Math.min(curX, bpCols - clampedW);

      overrides[id] = {
        x: Math.max(0, clampedX),
        y: existing?.y ?? tile.y,
        w: clampedW,
        h,
      };

      this.updateGrid();
    },

    toggleTileBorder(id: string) {
      if (!this.currentGrid) return;

      const tile = this.currentGrid.tiles.find((tile) => tile.i === id);
      if (tile) {
        this.pushUndoSnapshot("Toggle tile border");
        tile.borderEnabled = tile.borderEnabled === false ? true : false;
        this.updateGrid();
      }
    },

    toggleLinkBackground(id: string) {
      if (!this.currentGrid) return;

      const tile = this.currentGrid.tiles.find((tile) => tile.i === id);
      if (!tile || tile.content.type !== ContentType.LINK) return;

      this.pushUndoSnapshot("Toggle link background");
      const linkContent = tile.content as LinkContent;
      linkContent.linkBackgroundEnabled =
        linkContent.linkBackgroundEnabled === false;
      this.updateGrid();
    },

    // Update the entire grid
    updateGrid() {
      // Block updates when the user can't edit (non-owner or view-only preview).
      if (!this.canEdit) {
        return;
      }

      // At the lg (default) breakpoint, displayLayout may have been rebuilt as
      // detached copies (e.g. after repacking out-of-bounds tiles). vue3-grid-grid
      // mutates those copies in-place during drag/resize, so the store's canonical
      // tiles can become stale. Sync the rendered positions back before saving.
      if (
        this.activeBreakpoint === "lg" &&
        this.currentGrid &&
        this.displayPositions.length
      ) {
        for (const pos of this.displayPositions) {
          const tile = this.currentGrid.tiles.find((t) => t.i === pos.i);
          if (tile) {
            tile.x = pos.x;
            tile.y = pos.y;
            tile.w = pos.w;
            tile.h = pos.h;
          }
        }
      }

      this.saveGrid(); // Persist changes
    },

    // ── Breakpoint overrides ──────────────────────────────────

    setActiveBreakpoint(bp: Breakpoint) {
      this.activeBreakpoint = bp;
    },

    // Update the viewport-derived breakpoint (what the window naturally supports).
    // Called by Grid.vue whenever the window resizes.
    setViewportBreakpoint(bp: Breakpoint) {
      this.viewportBreakpoint = bp;
    },

    // Force the grid to render at a specific breakpoint regardless of viewport width.
    // Pass null to return to automatic viewport-based detection.
    setForcedBreakpoint(bp: Breakpoint | null) {
      this.forcedBreakpoint = bp;
      this.refreshStableSnapshot();
    },

    setDisplayPositions(
      positions: Array<{
        i: string;
        x: number;
        y: number;
        w: number;
        h: number;
      }>,
    ) {
      this.displayPositions = positions;
    },

    getBreakpointPositions(
      bp: Breakpoint,
    ): Record<string, TilePosition> | undefined {
      if (!this.currentGrid) return undefined;
      return this.currentGrid.overrides?.[bp];
    },

    hasBreakpointOverride(bp: Breakpoint): boolean {
      const positions = this.getBreakpointPositions(bp);
      return !!positions && Object.keys(positions).length > 0;
    },

    // Called by GridTile on every move/resize at a non-lg breakpoint.
    // Snapshots ALL current display positions into the overrides so that
    // neighboring tiles shifted by the grid library are also captured.
    updateBreakpointOverride() {
      const bp = this.activeBreakpoint;
      if (!this.currentGrid || bp === "lg") return;

      if (!this.currentGrid.overrides) {
        this.currentGrid.overrides = {};
      }

      // Snapshot every tile's current rendered position
      const positions: Record<string, TilePosition> = {};
      for (const pos of this.displayPositions) {
        positions[pos.i] = { x: pos.x, y: pos.y, w: pos.w, h: pos.h };
      }
      this.currentGrid.overrides[bp] = positions;
      // Tell Grid.vue not to rebuild displayLayout — positions are already correct
      this.skipOverrideRebuild = true;
      this.updateGrid();
    },

    saveBreakpointPositions(
      bp: Breakpoint,
      tiles: Array<{ i: string; x: number; y: number; w: number; h: number }>,
    ) {
      if (!this.currentGrid || bp === "lg") return;

      const positions: Record<string, TilePosition> = {};
      for (const tile of tiles) {
        positions[tile.i] = { x: tile.x, y: tile.y, w: tile.w, h: tile.h };
      }

      if (!this.currentGrid.overrides) {
        this.currentGrid.overrides = {};
      }
      this.currentGrid.overrides[bp] = positions;
      this.saveGrid();
    },

    resetBreakpoint(bp: Breakpoint) {
      if (!this.currentGrid || bp === "lg") return;
      this.pushUndoSnapshot("Reset breakpoint grid");
      if (this.currentGrid.overrides) {
        delete this.currentGrid.overrides[bp];
      }
      this.saveGrid();
    },

    // Reset grid-viewing state when navigating away from a grid page.
    // Prevents stale isOwner / currentGrid from leaking into non-grid routes.
    clearCurrentGrid() {
      this.currentGrid = null;
      this.isOwner = false;
      this.isDemoGrid = false;
      this.displayPositions = [];
      this.activeTileId = null;
      this.activePanelId = null;
      this.forcedBreakpoint = null;
      this.viewportBreakpoint = "lg";
      editingTileId = null;
      pendingEditSnapshot = null;
      lastStableSnapshot = null;
      undoRedoManager?.clear();
      undoRedoManager = null;
    },

    async deleteGrid(id: string) {
      const userId = getAuthProvider().getCurrentUserId();
      const grid = this.grids.find((l) => l.id === id);
      if (!userId || !grid || grid.userId !== userId) {
        return;
      }

      try {
        await svc().deleteGrid(id);
        this.grids = this.grids.filter((grid) => grid.id !== id);

        if (this.currentGrid?.id === id) {
          this.currentGrid = null;
        }
      } catch (err) {
        this.error = "Failed to delete grid.";
        console.error(err);
      }
    },

    // Rename a grid by updating its name
    async renameGrid(id: string, newName: string) {
      try {
        const grid = this.grids.find((l) => l.id === id);
        if (!grid) {
          throw new Error("Grid not found");
        }

        // Update the grid name
        grid.name = newName;
        await svc().updateGrid(grid);

        // Update current grid if it's the one being renamed
        if (this.currentGrid?.id === id) {
          this.currentGrid.name = newName;
        }
      } catch (err) {
        this.error = "Failed to rename grid.";
        console.error(err);
        throw err;
      }
    },
  },
});
