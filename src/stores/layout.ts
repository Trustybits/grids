import { defineStore } from "pinia";
import { type Layout } from "@/types/Layout";
import { getLayoutService } from "@/services/LayoutServiceFactory"; // Factory to switch services dynamically
import { ContentType, type TileContent } from "@/types/TileContent";
import type { Breakpoint, TilePosition } from "@/types/Tile";
import { v4 as uuidv4 } from "uuid";
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  mapFirestoreToLayout,
  createDefaultLayout,
} from "@/types/FirestoreMappers";
import { auth, db } from "@/firebase";
import { createTile } from "@/utils/TileUtils";
import { useToastStore } from "@/stores/toast";
import heroGif from "@/assets/images/hero.gif";

const layoutService = getLayoutService();
const createTextDoc = (lines: string[]) => {
  const parseInlineMarkdown = (text: string) => {
    const nodes: Array<{ type: string; text?: string; marks?: Array<{ type: string }> }> = [];
    const regex = /(\*|_)([^*_]+?)\1/;
    let remaining = text;

    while (remaining.length > 0) {
      const match = regex.exec(remaining);
      if (!match) {
        if (remaining) {
          nodes.push({ type: "text", text: remaining });
        }
        break;
      }

      const [fullMatch, , italicText] = match;
      const matchIndex = match.index;
      if (matchIndex > 0) {
        nodes.push({ type: "text", text: remaining.slice(0, matchIndex) });
      }
      nodes.push({ type: "text", text: italicText, marks: [{ type: "italic" }] });
      remaining = remaining.slice(matchIndex + fullMatch.length);
    }

    return nodes;
  };

  const content = lines.flatMap((line) => {
    if (line.trim() === "") {
      return [
        {
          type: "paragraph",
          content: [{ type: "hardBreak" }],
        },
      ];
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      return [
        {
          type: "heading",
          attrs: { level },
          content: text ? [{ type: "text", text }] : [],
        },
      ];
    }

    if (line.trim() === "---") {
      return [
        {
          type: "horizontalRule",
        },
      ];
    }

    const parts = line.split("\n");
    const paragraphContent = parts.flatMap((part, index) => {
      const nodes = parseInlineMarkdown(part);
      if (index < parts.length - 1) {
        nodes.push({ type: "hardBreak" });
      }
      return nodes;
    });

    return [
      {
        type: "paragraph",
        content: paragraphContent,
      },
    ];
  });

  return JSON.stringify({
    type: "doc",
    content,
  });
};

const createStarterTiles = () => {
  const startX = 0;

  return [
    createTile(
      ContentType.SUGGESTION,
      uuidv4(),
      startX,
      6,
      4,
      4,
      { action: "profile", label: "Add Profile" },
      ""
    ),
    createTile(
      ContentType.IMAGE,
      uuidv4(),
      startX + 4,
      0,
      5,
      5,
      { src: heroGif },
      ""
    ),
    {
      ...createTile(
        ContentType.TEXT,
        uuidv4(),
        startX + 9,
        0,
        2,
        3,
        {
          text: createTextDoc([
            "# 👋",
            "#### Welcome to grids.so!",
            "Enjoy your new home.\n\n",
            "---",
            "*you can find more tile types below.*👇",
          ]),
        },
        ""
      ),
      borderEnabled: false,
    },
    createTile(
      ContentType.EMBED,
      uuidv4(),
      startX + 9,
      2,
      3,
      2,
      { src: "https://www.youtube.com/embed/7ccH8u8fj8Y?si=hnB1rbMIsMCWpPO8" },
      ""
    ),
    createTile(
      ContentType.CHAT,
      uuidv4(),
      startX + 4,
      5,
      3,
      4,
      {},
      ""
    ),
    createTile(
      ContentType.SUGGESTION,
      uuidv4(),
      startX + 7,
      5,
      2,
      2,
      { action: "link", label: "Add Link" },
      ""
    ),
  ];
};

export const useLayoutStore = defineStore("layout", {
  state: () => ({
    layouts: [] as Array<Layout>,
    currentLayout: null as Layout | null,
    isLoading: false,
    error: null as string | null,
    showMetaData: false,
    isOwner: false,
    recentLayoutIds: [] as string[],
    activeTileId: null as string | null,
    activePanelId: null as string | null,
    // Tracks tiles that are currently uploading media in the background.
    // Key = tile ID, value = upload progress (0–1) or -1 for indeterminate.
    uploadingTiles: {} as Record<string, number>,
    // Maps tile ID → permanent Firebase URL for tiles still displaying a blob: preview.
    // Used by the Firestore persistence layer to write the real URL instead of the blob.
    // The blob URL stays as the in-memory src so the <img>/<video> element never reloads.
    resolvedUrls: {} as Record<string, string>,
    // When set, the TextContent component for this tile will auto-enter
    // edit mode on mount and place the cursor at the end. Cleared by the
    // component once it consumes the focus request.
    pendingFocusTileId: null as string | null,
    activeBreakpoint: 'lg' as Breakpoint,
    // When true, Grid.vue should skip the next displayLayout rebuild triggered by
    // overrides changing (because the change came from a drag/resize and positions
    // are already correct in the stable ref).
    skipOverrideRebuild: false,
    // Snapshot of tile positions as currently rendered by Grid.vue's displayLayout.
    // Updated by Grid.vue so that GridMenu can read accurate positions for breakpoint saves.
    displayPositions: [] as Array<{ i: string; x: number; y: number; w: number; h: number }>,
  }),

  getters: {
    verticalCompact(): boolean {
      return this.currentLayout?.verticalCompact ?? true;
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

    // Store the permanent Firebase URL for a tile that is still showing a blob preview.
    // This URL is used only for Firestore persistence — the displayed src is unchanged.
    setResolvedUrl(tileId: string, url: string) {
      this.resolvedUrls[tileId] = url;
    },

    // Retrieve the resolved Firebase URL for a tile, if one exists
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

      const userId = auth.currentUser?.uid;
      if (!userId) {
        this.error = "User not authenticated";
        this.isLoading = false;
        return;
      }

      try {
        const layoutsQuery = query(
          collection(db, "layouts"),
          where("userId", "==", userId)
        );
        const querySnapshot = await getDocs(layoutsQuery);

        this.layouts = querySnapshot.docs.map((doc) =>
          mapFirestoreToLayout(doc)
        );
        await this.loadRecents();
        console.log("layouts", this.layouts);
      } catch (err) {
        this.error = "Failed to fetch layouts.";
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },

    // Create a new layout for the user
    async createLayout(name: string): Promise<string | null> {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        this.error = "User not authenticated";
        return null;
      }

      if (!name) {
        name = `Layout ${this.layouts.length + 1}`;
      }

      try {
        const newLayout = createDefaultLayout(userId, name);
        newLayout.tiles = createStarterTiles();
        const docRef = doc(collection(db, "layouts"));
        newLayout.id = docRef.id;

        await layoutService.saveLayout(newLayout);

        // Add the new layout to the state
        this.layouts.push({ ...newLayout });

        return newLayout.id;
      } catch (err) {
        this.error = "Failed to create layout.";
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
        this.currentLayout = await layoutService.fetchLayout(id);
        this.isOwner = !!(
          auth.currentUser?.uid &&
          this.currentLayout?.userId &&
          auth.currentUser.uid === this.currentLayout.userId
        );
        this.checkShowMetaDataCookie();
        this.recordRecent(id);

        if (this.isOwner && (this.currentLayout?.tiles?.length ?? 0) === 0) {
          this.ensureSuggestionTiles();
        }

        try {
          const ref = doc(db, "layouts", id);
          await updateDoc(ref, { lastOpenedAt: serverTimestamp() });
        } catch (e) {
          console.error("Failed to update lastOpenedAt:", e);
        }
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
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      try {
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          const arr = Array.isArray(data?.recentLayoutIds)
            ? data.recentLayoutIds.filter((x: unknown) => typeof x === "string")
            : [];
          this.recentLayoutIds = arr.slice(0, 3);
        } else {
          this.recentLayoutIds = [];
        }
      } catch (err) {
        console.error("Failed to load recent layouts:", err);
      }
    },

    async saveRecents() {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      try {
        const userRef = doc(db, "users", userId);
        await setDoc(
          userRef,
          { recentLayoutIds: this.recentLayoutIds.slice(0, 3) },
          { merge: true }
        );
      } catch (err) {
        console.error("Failed to save recent layouts:", err);
      }
    },

    checkShowMetaDataCookie() {
      const cookieValue = this.getCookieValue("showMetaData");
      this.showMetaData = cookieValue === "true";
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
    // Before persisting, any blob: URLs used for optimistic previews are replaced
    // with their resolved Firebase URLs (if the upload has completed). This keeps
    // the in-memory tile src unchanged so the <img>/<video> element never reloads.
    async saveLayout() {
      if (!this.currentLayout) {
        console.warn("No layout to save.");
        return;
      }

      if (!this.isOwner) {
        return;
      }

      try {
        // Build a shallow copy with blob URLs swapped for resolved Firebase URLs
        const resolvedTiles = this.currentLayout.tiles.map((tile) => {
          const src = (tile.content as any)?.src;
          if (typeof src === "string" && src.startsWith("blob:")) {
            const realUrl = this.resolvedUrls[tile.i];
            if (realUrl) {
              return { ...tile, content: { ...tile.content, src: realUrl } };
            }
          }
          return tile;
        });

        const layoutToSave = { ...this.currentLayout, tiles: resolvedTiles } as Layout;
        await layoutService.saveLayout(layoutToSave);
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
          (tile) => tile.content.type === ContentType.CAMPFIRE
        );
        if (hasCampfireTile) {
          // Use toast to notify user
          const toastStore = useToastStore();
          toastStore.addToast('Only one campfire allowed per grid', 'error');
          return null;
        }
      }

      const isProfile = content.type === ContentType.PROFILE;
      const tileWidth = isProfile ? 4 : 2;
      const tileHeight = isProfile ? 4 : 2;

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
        position = this.findBestXAtRow(tileWidth, tileHeight, viewportY);
      } else {
        // At the top of the grid — use traditional gap search
        position = this.findFirstAvailableSpot(tileWidth, tileHeight);
      }

      // Push existing tiles out of the way BEFORE adding the new tile.
      // This modifies tile Y positions in the reactive data so Vue never
      // renders an intermediate frame with overlapping tiles.
      this.pushTilesForNewItem(position.x, position.y, tileWidth, tileHeight);

      const newTile = createTile(
        content.type,
        uuidv4(),
        position.x,
        position.y,
        tileWidth,
        tileHeight,
        content,
        ""
      );

      this.currentLayout.tiles.push(newTile);
      this.updateLayout();

      return newTile.i;
    },

    setTileContent(id: string, content: TileContent) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((t) => t.i === id);
      if (!tile) return;

      tile.content = content as any;
      if (content.type === ContentType.PROFILE) {
        tile.w = 4;
        tile.h = 4;
        this.adjustTilePosition(tile);
      }
      this.updateLayout();
    },

    ensureSuggestionTiles() {
      if (!this.currentLayout) return;
      if (this.currentLayout.tiles.length !== 0) return;
      this.currentLayout.tiles = createStarterTiles();
      this.updateLayout();
    },

    patchTileContent(id: string, patch: Partial<any>) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((t) => t.i === id);
      if (!tile) return;

      tile.content = {
        ...(tile.content as any),
        ...(patch as any),
      };

      this.updateLayout();
    },

    addBackgroundImage(url: string, embed: boolean) {
      if (!this.currentLayout) return;

      this.currentLayout.backgroundImageSrc = url;
      this.currentLayout.backgroundEmbed = embed;
      this.updateLayout();
    },

    // Calculate the lowest point in the grid
    calculateLowestPoint(): number {
      if (!this.currentLayout || this.currentLayout.tiles.length === 0) {
        return 0;
      }

      return this.currentLayout.tiles.reduce((max, tile) => {
        const bottom = tile.y + tile.h;
        return bottom > max ? bottom : max;
      }, 0);
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

    /**
     * Push existing tiles out of the way to make room for a new tile at the
     * given position. Modifies tile Y positions in-place so that by the time
     * Vue re-renders, the layout is already collision-free — no overlap flash.
     *
     * Algorithm:
     *  1. Push every tile that overlaps the new tile's footprint directly
     *     below it (tile.y = newY + newH).
     *  2. Cascade: sort all tiles top-to-bottom and resolve any secondary
     *     overlaps the same way. Repeat until the layout is stable.
     */
    pushTilesForNewItem(
      newX: number,
      newY: number,
      newW: number,
      newH: number,
    ): void {
      if (!this.currentLayout) return;

      const tiles = this.currentLayout.tiles;

      // Rectangle overlap test (strict — adjacent edges don't count)
      const overlaps = (
        ax: number, ay: number, aw: number, ah: number,
        bx: number, by: number, bw: number, bh: number,
      ): boolean => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

      // First pass: push tiles that directly collide with the new tile
      for (const tile of tiles) {
        if (overlaps(newX, newY, newW, newH, tile.x, tile.y, tile.w, tile.h)) {
          tile.y = newY + newH;
        }
      }

      // Cascade: repeatedly resolve tile-on-tile overlaps until stable.
      // Processing top-to-bottom ensures each tile is only pushed once per pass.
      let settled = false;
      let iterations = 0;
      while (!settled && iterations < 50) {
        settled = true;
        iterations++;

        const sorted = [...tiles].sort((a, b) => a.y - b.y);
        for (let i = 0; i < sorted.length; i++) {
          for (let j = i + 1; j < sorted.length; j++) {
            const a = sorted[i];
            const b = sorted[j];
            if (overlaps(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h)) {
              b.y = a.y + a.h;
              settled = false;
            }
          }
        }
      }
    },

    /**
     * Find the best X position at a specific row for a tile of the given size.
     * Used for viewport-based placement: the Y is already decided (viewport center),
     * so we just need the cleanest X column.
     *
     * Scans left-to-right for a non-overlapping column. If the row is fully
     * occupied, returns x=0 anyway — pushTilesForNewItem will clear the space.
     */
    findBestXAtRow(
      width: number,
      height: number,
      targetY: number,
    ): { x: number; y: number } {
      if (!this.currentLayout) {
        return { x: 0, y: targetY };
      }

      const colNum = this.currentLayout.colNum || 12;

      const hasOverlap = (x: number, y: number): boolean => {
        return this.currentLayout!.tiles.some(tile => {
          return !(
            x + width <= tile.x ||
            x >= tile.x + tile.w ||
            y + height <= tile.y ||
            y >= tile.y + tile.h
          );
        });
      };

      // Try to find a clean (non-overlapping) column at the target row
      for (let x = 0; x <= colNum - width; x++) {
        if (!hasOverlap(x, targetY)) {
          return { x, y: targetY };
        }
      }

      // Row is fully occupied — place at x=0 and let the grid engine
      // push existing tiles out of the way via collision resolution
      return { x: 0, y: targetY };
    },

    /**
     * Find the first available spot for a tile of the given size.
     *
     * When startY > 0 (viewport-based positioning), we first scan downward
     * from startY. If no gap is found within the existing tile bounds, the
     * tile is placed at the bottom of the grid — still near the viewport.
     * This ensures new tiles always appear close to where the user is looking.
     */
    findFirstAvailableSpot(
      width: number,
      height: number,
      startY = 0,
    ): { x: number; y: number } {
      if (!this.currentLayout) {
        return { x: 0, y: 0 };
      }

      const colNum = this.currentLayout.colNum || 12;
      const lowestPoint = this.calculateLowestPoint();
      // Search up to the current bottom + one new tile height
      const maxY = lowestPoint + height;

      // Helper function to check if a position overlaps with any existing tile
      const hasOverlap = (x: number, y: number): boolean => {
        return this.currentLayout!.tiles.some(tile => {
          return !(
            x + width <= tile.x ||  // new tile is to the left
            x >= tile.x + tile.w || // new tile is to the right
            y + height <= tile.y || // new tile is above
            y >= tile.y + tile.h    // new tile is below
          );
        });
      };

      // Scan downward from startY — tiles appear where the user is looking
      for (let y = Math.max(0, startY); y <= maxY; y++) {
        for (let x = 0; x <= colNum - width; x++) {
          if (!hasOverlap(x, y)) {
            return { x, y };
          }
        }
      }

      // If no spot found, fall back to bottom of grid
      return { x: 0, y: lowestPoint };
    },

    // updateTile(id: string, newContent: TileContent) {
    //   if (!this.currentLayout) return;

    //   const tileIndex = this.currentLayout.tiles.findIndex((tile) => tile.i === id);
    //   if (tileIndex !== -1) {
    //     const tile = this.currentLayout.tiles[tileIndex];
    //     this.currentLayout.tiles[tileIndex] = updateTileContent(tile, newContent);
    //     this.saveLayout(); // Persist changes
    //   } else {
    //     console.warn(`Tile with ID ${id} not found.`);
    //   }
    // },

    // Remove a tile (also cleans up any optimistic upload state)
    removeTile(id: string) {
      if (!this.currentLayout) return;

      // If the tile was using a blob URL for optimistic preview, revoke it
      const tile = this.currentLayout.tiles.find((t) => t.i === id);
      if (tile) {
        const src = (tile.content as any)?.src;
        if (typeof src === "string" && src.startsWith("blob:")) {
          URL.revokeObjectURL(src);
        }
      }

      // Clean up any upload tracking state for this tile
      delete this.uploadingTiles[id];
      delete this.resolvedUrls[id];

      // Clean up stale breakpoint override entries for this tile
      if (this.currentLayout.overrides) {
        for (const bp of Object.keys(this.currentLayout.overrides) as Breakpoint[]) {
          const posMap = this.currentLayout.overrides[bp];
          if (posMap) delete posMap[id];
        }
      }

      this.currentLayout.tiles = this.currentLayout.tiles.filter(
        (t) => t.i !== id
      );
      this.saveLayout(); // Persist changes
    },

    // Resize an tile
    resizeTile(id: string, w: number, h: number) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((tile) => tile.i === id);
      if (tile) {
        if (tile.content.type === ContentType.PROFILE) {
          tile.w = 4;
          tile.h = 4;
          this.adjustTilePosition(tile);
          this.updateLayout();
          return;
        }
        tile.w = w;
        tile.h = h;
        this.adjustTilePosition(tile);
        this.updateLayout();
      }
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

      const linkContent = tile.content as any;
      const nextValue = linkContent.linkBackgroundEnabled === false;
      linkContent.linkBackgroundEnabled = nextValue;
      this.updateLayout();
    },

    // Adjust tile's x value to ensure it doesn't extend past colNum
    adjustTilePosition(tile: { x: number; w: number }) {
      if (!this.currentLayout) {
        console.warn("Cannot adjust tile position: currentLayout is null.");
        return;
      }

      const maxX = this.currentLayout.colNum - tile.w;
      if (tile.x > maxX) {
        tile.x = Math.max(0, maxX); // Ensure x doesn't go negative
      }
    },

    // Update the entire layout
    updateLayout() {
      if (!this.isOwner) {
        return;
      }

      const gridElement =
        document.querySelector<HTMLElement>(".vue-grid-layout");
      if (gridElement) {
        const currentWidth = parseFloat(getComputedStyle(gridElement).width);
        if (!isNaN(currentWidth)) {
          gridElement.style.height = `${currentWidth + 1}px`;
        }
      }

      this.saveLayout(); // Persist changes
    },

    // ── Breakpoint overrides ──────────────────────────────────

    setActiveBreakpoint(bp: Breakpoint) {
      this.activeBreakpoint = bp;
    },

    setDisplayPositions(positions: Array<{ i: string; x: number; y: number; w: number; h: number }>) {
      this.displayPositions = positions;
    },

    getBreakpointPositions(bp: Breakpoint): Record<string, TilePosition> | undefined {
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
      if (!this.currentLayout || bp === 'lg') return;

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

    saveBreakpointPositions(bp: Breakpoint, tiles: Array<{ i: string; x: number; y: number; w: number; h: number }>) {
      if (!this.currentLayout || bp === 'lg') return;

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
      if (!this.currentLayout || bp === 'lg') return;
      if (this.currentLayout.overrides) {
        delete this.currentLayout.overrides[bp];
      }
      this.saveLayout();
    },

    async deleteLayout(id: string) {
      if (!this.isOwner) {
        return;
      }

      try {
        await layoutService.deleteLayout(id);
        this.layouts = this.layouts.filter((layout) => layout.id !== id);
    
        if (this.currentLayout?.id === id) {
          this.currentLayout = null;
        }
      } catch (err) {
        this.error = "Failed to delete layout.";
        console.error(err);
      }
    },    
  },
});
