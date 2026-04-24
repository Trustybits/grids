import { defineStore } from "pinia";
import { type Layout, type CopyDepth } from "@/types/Layout";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { createStarterTiles } from "@/services/LayoutService";
import {
  ContentType,
  type TileContent,
  type AnyTileContent,
  type LinkContent,
} from "@/types/TileContent";
import type { Breakpoint, TilePosition, Tile } from "@/types/Tile";
import { v4 as uuidv4 } from "uuid";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { createTile } from "@/utils/TileUtils";
import {
  adjustTilePosition,
  findBestXAtRow,
  findFirstAvailableSpot,
  pushTilesForNewItem,
} from "@/utils/GridPlacementUtils";
import { useToastStore } from "@/stores/toast";

// Lazy accessor — don't resolve the service at module load because main.ts
// registers the service factory in an async IIFE that runs AFTER static imports.
const svc = () => getServiceFactory().getLayoutService();

export const useLayoutStore = defineStore("layout", {
  state: () => ({
    layouts: [] as Array<Layout>,
    currentLayout: null as Layout | null,
    isLoading: false,
    error: null as string | null,
    showMetaData: false,
    showMetaDataVerbose: false,
    isOwner: false,
    recentLayoutIds: [] as string[],
    activeTileId: null as string | null,
    activePanelId: null as string | null,
    // Tracks tiles that are currently uploading media in the background.
    // Key = tile ID, value = upload progress (0–1) or -1 for indeterminate.
    uploadingTiles: {} as Record<string, number>,
    // Maps tile ID → permanent storage URL for tiles still displaying a blob: preview.
    // Used by the persistence layer to write the real URL instead of the blob.
    // The blob URL stays as the in-memory src so the <img>/<video> element never reloads.
    resolvedUrls: {} as Record<string, string>,
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
      return this.currentLayout?.verticalCompact ?? true;
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
  },

  actions: {
    setMenuActive(tileId: string) {
      this.activeTileId = tileId;
      this.activePanelId = null;
    },

    setPanelActive(tileId: string, panelId: string) {
      this.activeTileId = tileId;
      this.activePanelId = panelId;
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

    // toggles the panels open and closed, only allows 1 tile to have a panel open at a time
    togglePanelActive(tileId: string, panelId: string) {
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
    setResolvedUrl(tileId: string, url: string) {
      this.resolvedUrls[tileId] = url;
    },

    // Retrieve the resolved storage URL for a tile, if one exists
    getResolvedUrl(tileId: string): string | undefined {
      return this.resolvedUrls[tileId];
    },

    // Clean up resolved URL entry (e.g. when tile is removed)
    clearResolvedUrl(tileId: string) {
      delete this.resolvedUrls[tileId];
    },

    async fetchLayouts() {
      this.isLoading = true;
      this.error = null;
      this.layouts = [];

      const userId = getAuthProvider().getCurrentUserId();
      if (!userId) {
        this.error = "User not authenticated";
        this.isLoading = false;
        return;
      }

      try {
        this.layouts = await svc().fetchLayoutsByUserId(userId);
        await this.loadRecents();
      } catch (err) {
        this.error = "Failed to fetch layouts.";
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },

    // Create a new layout for the user
    async createLayout(name: string): Promise<string | null> {
      const userId = getAuthProvider().getCurrentUserId();
      if (!userId) {
        this.error = "User not authenticated";
        return null;
      }

      if (!name) {
        name = `Layout ${this.layouts.length + 1}`;
      }

      try {
        const newLayout = await svc().createLayoutWithStarterTiles(
          userId,
          name,
        );

        // Add the new layout to the state
        this.layouts.push({ ...newLayout });

        return newLayout.id;
      } catch (err) {
        this.error = "Failed to create layout.";
        console.error(err);
        return null;
      }
    },

    // Duplicate an existing grid, creating a new layout owned by the current user.
    // Accepts any Layout object — not just the user's own — so this same logic can
    // power a future template gallery or cloning another user's published grid.
    //
    // copyDepth controls what gets carried over:
    //   'full'      → all tile content (media URLs shared by reference, chat cleared)
    //   'structure' → tile type/size/position only, content reset to defaults
    async duplicateLayout(
      sourceLayout: Layout,
      copyDepth: CopyDepth = "full",
    ): Promise<string | null> {
      const userId = getAuthProvider().getCurrentUserId();
      if (!userId) {
        this.error = "User not authenticated";
        return null;
      }

      try {
        const newLayout = await svc().cloneAndPersistLayout(
          userId,
          sourceLayout,
          copyDepth,
        );

        // Add to local state so the dashboard list updates immediately
        this.layouts.push({ ...newLayout });

        return newLayout.id;
      } catch (err) {
        this.error = "Failed to duplicate layout.";
        console.error(err);
        return null;
      }
    },

    // Load a layout by ID
    async loadLayout(id: string) {
      this.isLoading = true;
      this.error = null;
      this.isOwner = false;

      try {
        this.currentLayout = await svc().fetchLayout(id);
        const userId = getAuthProvider().getCurrentUserId();
        this.isOwner = !!(
          userId &&
          this.currentLayout?.userId &&
          userId === this.currentLayout.userId
        );
        this.checkShowMetaDataCookie();
        this.recordRecent(id);

        if (this.isOwner && (this.currentLayout?.tiles?.length ?? 0) === 0) {
          this.ensureSuggestionTiles();
        }

        await svc().touchLastOpenedAt(id);
        // update in-memory list timestamp for immediate UI sorting
        const idx = this.layouts.findIndex((l) => l.id === id);
        if (idx !== -1) {
          this.layouts[idx] = {
            ...this.layouts[idx],
            lastOpenedAt: new Date(),
          } as Layout;
        }
      } catch (err) {
        this.error = "Failed to load layout.";
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },

    recordRecent(id: string) {
      const next = this.recentLayoutIds.filter((x) => x !== id);
      next.unshift(id);
      this.recentLayoutIds = next.slice(0, 3);
      // fire-and-forget persist
      this.saveRecents();
    },

    async loadRecents() {
      const userId = getAuthProvider().getCurrentUserId();
      if (!userId) return;
      try {
        this.recentLayoutIds = await svc().loadRecentLayoutIds(userId);
      } catch (err) {
        console.error("Failed to load recent layouts:", err);
      }
    },

    async saveRecents() {
      const userId = getAuthProvider().getCurrentUserId();
      if (!userId) return;
      try {
        await svc().saveRecentLayoutIds(userId, this.recentLayoutIds);
      } catch (err) {
        console.error("Failed to save recent layouts:", err);
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
      if (!this.currentLayout) return;

      this.currentLayout.verticalCompact = !this.currentLayout.verticalCompact;
      this.updateLayout();
    },

    // Set the vertical compact (gravity) setting
    setVerticalCompact(value: boolean) {
      if (!this.currentLayout) return;

      this.currentLayout.verticalCompact = value;
      this.updateLayout();
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

    // Save the current layout.
    // Delegates serialization, blob-URL resolution, and write queueing to the service.
    async saveLayout() {
      if (!this.currentLayout) {
        console.warn("No layout to save.");
        return;
      }

      // Block saves when the user isn't allowed to edit — covers both
      // non-owners and owners in view-only breakpoint preview mode.
      if (!this.canEdit) {
        return;
      }

      try {
        await svc().queueSave(this.currentLayout, this.resolvedUrls);
      } catch (err) {
        this.error = "Failed to save layout.";
        console.error(err);
      }
    },

    // Add a new tile
    addTile(content: TileContent): string | null {
      if (!this.currentLayout) return null;

      // Validate: Only one campfire tile per grid
      if (content.type === ContentType.CAMPFIRE) {
        const hasCampfireTile = this.currentLayout.tiles.some(
          (tile) => tile.content.type === ContentType.CAMPFIRE,
        );
        if (hasCampfireTile) {
          // Use toast to notify user
          const toastStore = useToastStore();
          toastStore.addToast("Only one campfire allowed per grid", "error");
          return null;
        }
      }

      const isProfile = content.type === ContentType.PROFILE;
      const tileWidth = isProfile ? 4 : 2;
      const tileHeight = isProfile ? 4 : 2;

      const tiles = this.currentLayout.tiles;
      const colNum = this.currentLayout.colNum || 12;

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

      this.currentLayout.tiles.push(newTile);
      this.updateLayout();

      return newTile.i;
    },

    setTileContent(id: string, content: TileContent) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((t) => t.i === id);
      if (!tile) return;

      tile.content = content;
      if (content.type === ContentType.PROFILE) {
        tile.w = 4;
        tile.h = 4;
        adjustTilePosition(tile, this.currentLayout.colNum);
      }
      this.updateLayout();
    },

    ensureSuggestionTiles() {
      if (!this.currentLayout) return;
      if (this.currentLayout.tiles.length !== 0) return;
      this.currentLayout.tiles = createStarterTiles();
      this.updateLayout();
    },

    patchTileContent(id: string, patch: Partial<AnyTileContent>) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((t) => t.i === id);
      if (!tile) return;

      tile.content = {
        ...(tile.content as AnyTileContent),
        ...(patch as Partial<AnyTileContent>),
      } as TileContent;

      this.updateLayout();
    },

    setGridTheme(themeId: string) {
      if (!this.currentLayout) return;
      this.currentLayout.themeId = themeId;
      this.updateLayout();
    },

    // Toggle whether non-owners can duplicate this grid as a template
    setDuplicatable(value: boolean) {
      if (!this.currentLayout) return;
      this.currentLayout.duplicatable = value;
      this.updateLayout();
    },

    addBackgroundImage(url: string, embed: boolean) {
      if (!this.currentLayout) return;

      this.currentLayout.backgroundImageSrc = url;
      this.currentLayout.backgroundEmbed = embed;
      this.updateLayout();
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

      const gridEl = document.querySelector<HTMLElement>(".vue-grid-layout");
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
      if (!this.currentLayout) return null;

      const source = this.currentLayout.tiles.find((t) => t.i === id);
      if (!source) return null;

      const tiles = this.currentLayout.tiles;
      const colNum = this.currentLayout.colNum || 12;

      // Use the currently displayed size (which may come from breakpoint
      // overrides) so the duplicate matches what the user actually sees.
      const bp = this.activeBreakpoint;
      const bpOverride = this.currentLayout.overrides?.[bp]?.[id];
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

      this.currentLayout.tiles.push(newTile);

      // Copy breakpoint overrides from the source tile to the duplicate
      if (this.currentLayout.overrides) {
        for (const overrideBp of Object.keys(
          this.currentLayout.overrides,
        ) as Breakpoint[]) {
          const posMap = this.currentLayout.overrides[overrideBp];
          if (posMap?.[id]) {
            posMap[newId] = {
              ...posMap[id],
              x: position.x,
              y: position.y,
            };
          }
        }
      }

      this.updateLayout();

      return newId;
    },

    // Remove a tile (also cleans up any optimistic upload state)
    removeTile(id: string) {
      if (!this.currentLayout) return;

      // If the tile was using a blob URL for optimistic preview, revoke it
      const tile = this.currentLayout.tiles.find((t) => t.i === id);
      if (tile) {
        const src = "src" in tile.content ? (tile.content as { src: string }).src : undefined;
        if (typeof src === "string" && src.startsWith("blob:")) {
          URL.revokeObjectURL(src);
        }
      }

      // Clean up any upload tracking state for this tile
      delete this.uploadingTiles[id];
      delete this.resolvedUrls[id];

      // Clean up stale breakpoint override entries for this tile
      if (this.currentLayout.overrides) {
        for (const bp of Object.keys(
          this.currentLayout.overrides,
        ) as Breakpoint[]) {
          const posMap = this.currentLayout.overrides[bp];
          if (posMap) delete posMap[id];
        }
      }

      this.currentLayout.tiles = this.currentLayout.tiles.filter(
        (t) => t.i !== id,
      );
      this.saveLayout(); // Persist changes
    },

    // Resize a tile.
    // At non-lg breakpoints the displayed dimensions come from overrides,
    // so we update those instead of only touching the base tile.
    resizeTile(id: string, w: number, h: number) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((tile) => tile.i === id);
      if (!tile) return;

      const bp = this.activeBreakpoint;

      if (bp === "lg") {
        // Desktop: update the base tile directly (existing behaviour)
        tile.w = w;
        tile.h = h;
        adjustTilePosition(tile, this.currentLayout.colNum);
        // Keep displayPositions in sync so updateLayout's sync-back
        // doesn't revert the programmatic resize.
        const dp = this.displayPositions.find((p) => p.i === id);
        if (dp) {
          dp.w = w;
          dp.h = h;
          dp.x = tile.x;
        }
        this.updateLayout();
        return;
      }

      // ── Non-lg breakpoint ──────────────────────────────────────
      // Only update the override for this breakpoint — leave the base
      // tile (lg) dimensions untouched so other breakpoints are unaffected.
      const bpCols = bp === "sm" ? 4 : 8;
      const clampedW = Math.min(w, bpCols);

      // Build / update the override for this breakpoint
      if (!this.currentLayout.overrides) {
        this.currentLayout.overrides = {};
      }
      if (!this.currentLayout.overrides[bp]) {
        // Seed overrides from the current display positions so we don't
        // lose the positions of every other tile.
        const positions: Record<string, TilePosition> = {};
        for (const pos of this.displayPositions) {
          positions[pos.i] = { x: pos.x, y: pos.y, w: pos.w, h: pos.h };
        }
        this.currentLayout.overrides[bp] = positions;
      }

      const overrides = this.currentLayout.overrides[bp];
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

      this.updateLayout();
    },

    toggleTileBorder(id: string) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((tile) => tile.i === id);
      if (tile) {
        tile.borderEnabled = tile.borderEnabled === false ? true : false;
        this.updateLayout();
      }
    },

    toggleLinkBackground(id: string) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((tile) => tile.i === id);
      if (!tile || tile.content.type !== ContentType.LINK) return;

      const linkContent = tile.content as LinkContent;
      linkContent.linkBackgroundEnabled = linkContent.linkBackgroundEnabled === false;
      this.updateLayout();
    },

    // Update the entire layout
    updateLayout() {
      // Block updates when the user can't edit (non-owner or view-only preview).
      if (!this.canEdit) {
        return;
      }

      // At the lg (default) breakpoint, displayLayout may have been rebuilt as
      // detached copies (e.g. after repacking out-of-bounds tiles). vue3-grid-layout
      // mutates those copies in-place during drag/resize, so the store's canonical
      // tiles can become stale. Sync the rendered positions back before saving.
      if (
        this.activeBreakpoint === "lg" &&
        this.currentLayout &&
        this.displayPositions.length
      ) {
        for (const pos of this.displayPositions) {
          const tile = this.currentLayout.tiles.find((t) => t.i === pos.i);
          if (tile) {
            tile.x = pos.x;
            tile.y = pos.y;
            tile.w = pos.w;
            tile.h = pos.h;
          }
        }
      }

      this.saveLayout(); // Persist changes
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
      if (!this.currentLayout) return undefined;
      return this.currentLayout.overrides?.[bp];
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
      if (!this.currentLayout || bp === "lg") return;

      if (!this.currentLayout.overrides) {
        this.currentLayout.overrides = {};
      }

      // Snapshot every tile's current rendered position
      const positions: Record<string, TilePosition> = {};
      for (const pos of this.displayPositions) {
        positions[pos.i] = { x: pos.x, y: pos.y, w: pos.w, h: pos.h };
      }
      this.currentLayout.overrides[bp] = positions;
      // Tell Grid.vue not to rebuild displayLayout — positions are already correct
      this.skipOverrideRebuild = true;
      this.updateLayout();
    },

    saveBreakpointPositions(
      bp: Breakpoint,
      tiles: Array<{ i: string; x: number; y: number; w: number; h: number }>,
    ) {
      if (!this.currentLayout || bp === "lg") return;

      const positions: Record<string, TilePosition> = {};
      for (const tile of tiles) {
        positions[tile.i] = { x: tile.x, y: tile.y, w: tile.w, h: tile.h };
      }

      if (!this.currentLayout.overrides) {
        this.currentLayout.overrides = {};
      }
      this.currentLayout.overrides[bp] = positions;
      this.saveLayout();
    },

    resetBreakpoint(bp: Breakpoint) {
      if (!this.currentLayout || bp === "lg") return;
      if (this.currentLayout.overrides) {
        delete this.currentLayout.overrides[bp];
      }
      this.saveLayout();
    },

    // Reset grid-viewing state when navigating away from a grid page.
    // Prevents stale isOwner / currentLayout from leaking into non-grid routes.
    clearCurrentLayout() {
      this.currentLayout = null;
      this.isOwner = false;
      this.displayPositions = [];
      this.activeTileId = null;
      this.activePanelId = null;
      this.forcedBreakpoint = null;
      this.viewportBreakpoint = "lg";
    },

    async deleteLayout(id: string) {
      const userId = getAuthProvider().getCurrentUserId();
      const layout = this.layouts.find((l) => l.id === id);
      if (!userId || !layout || layout.userId !== userId) {
        return;
      }

      try {
        await svc().deleteLayout(id);
        this.layouts = this.layouts.filter((layout) => layout.id !== id);

        if (this.currentLayout?.id === id) {
          this.currentLayout = null;
        }
      } catch (err) {
        this.error = "Failed to delete layout.";
        console.error(err);
      }
    },

    // Rename a layout by updating its name
    async renameLayout(id: string, newName: string) {
      try {
        const layout = this.layouts.find((l) => l.id === id);
        if (!layout) {
          throw new Error("Layout not found");
        }

        // Update the layout name
        layout.name = newName;
        await svc().updateLayout(layout);

        // Update current layout if it's the one being renamed
        if (this.currentLayout?.id === id) {
          this.currentLayout.name = newName;
        }
      } catch (err) {
        this.error = "Failed to rename layout.";
        console.error(err);
        throw err;
      }
    },
  },
});
