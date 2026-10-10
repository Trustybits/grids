import { defineStore } from "pinia";

const GRID_GUIDE_STORAGE_KEY = "grids.showGridGuide";

// The editor's grid guide defaults on, but the owner's choice to hide it should
// survive reloads, so it is persisted locally rather than kept session-only.
function readShowGridGuide(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(GRID_GUIDE_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export const useGridUiStore = defineStore("gridUi", {
  state: () => ({
    activeTileId: null as string | null,
    activePanelId: null as string | null,
    pendingFocusTileId: null as string | null,
    // Mobile 2.0: the tile whose `/EDIT` sheet is open. Deliberately separate
    // from `activeTileId`, which means "this tile's desktop toolbar panel is
    // open" — the desktop toolbar is gated off under Mobile 2.0, and one field
    // meaning two things would leave neither safe to reason about.
    mobileEditTileId: null as string | null,
    // Phone floating toolbars (`editor-mobile-toolbar`). `mobileEditTileId`
    // stays the single selected tile; these layer on top of it. The actions
    // below keep them consistent — only one of popover / sheet / arrange is
    // ever open, and switching tiles closes all three.
    /** Tiles picked in multi-edit; `null` means multi-edit is off. */
    mobileMultiSelectIds: null as string[] | null,
    /** Tile in move/resize mode (hold or the Arrange tool). */
    mobileArrangeTileId: null as string | null,
    /** Tool whose popover is open. */
    mobileOpenToolId: null as string | null,
    /** The toolbar grown into the "All settings" sheet. */
    mobileSheetExpanded: false,
    showMetaData: false,
    showMetaDataVerbose: false,
    showGridGuide: readShowGridGuide(),
  }),

  actions: {
    setMenuActive(tileId: string) {
      this.activeTileId = tileId;
      this.activePanelId = null;
    },

    setPanelActive(tileId: string, panelId: string) {
      this.activeTileId = tileId;
      this.activePanelId = panelId;
    },

    toggleMenuActive(tileId: string) {
      if (this.activePanelId) {
        this.activePanelId = null;
        if (this.activeTileId === tileId) return;
      }

      this.activeTileId =
        this.activeTileId === tileId ? null : tileId;
    },

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

    setMobileEditTile(tileId: string | null) {
      if (this.mobileEditTileId !== tileId) {
        // A different tile starts fresh: nothing open belongs to it.
        this.mobileOpenToolId = null;
        this.mobileSheetExpanded = false;
        if (this.mobileArrangeTileId !== tileId) {
          this.mobileArrangeTileId = null;
        }
      }
      this.mobileEditTileId = tileId;
      if (tileId === null) this.mobileMultiSelectIds = null;
    },

    /** Enter (id) or leave (null) move/resize mode. Arranging selects. */
    setMobileArrangeTile(tileId: string | null) {
      if (tileId !== null) {
        this.mobileMultiSelectIds = null;
        this.setMobileEditTile(tileId);
        this.mobileOpenToolId = null;
        this.mobileSheetExpanded = false;
      }
      this.mobileArrangeTileId = tileId;
    },

    /** Open a tool's popover (or close it with null). Leaves arrange/sheet. */
    setMobileOpenTool(toolId: string | null) {
      this.mobileOpenToolId = toolId;
      if (toolId !== null) {
        this.mobileSheetExpanded = false;
        this.mobileArrangeTileId = null;
      }
    },

    setMobileSheetExpanded(expanded: boolean) {
      this.mobileSheetExpanded = expanded;
      if (expanded) {
        this.mobileOpenToolId = null;
        this.mobileArrangeTileId = null;
      }
    },

    /** Start multi-edit with the selected tile (if any) as the first pick. */
    enterMobileMultiSelect() {
      this.mobileMultiSelectIds = this.mobileEditTileId
        ? [this.mobileEditTileId]
        : [];
      this.mobileOpenToolId = null;
      this.mobileSheetExpanded = false;
      this.mobileArrangeTileId = null;
    },

    /** Add or remove a tile; emptying the selection leaves multi-edit. */
    toggleMobileMultiSelectTile(tileId: string) {
      if (!this.mobileMultiSelectIds) return;
      const ids = this.mobileMultiSelectIds.includes(tileId)
        ? this.mobileMultiSelectIds.filter((id) => id !== tileId)
        : [...this.mobileMultiSelectIds, tileId];
      this.mobileOpenToolId = null;
      if (ids.length === 0) {
        this.clearMobileEditor();
        return;
      }
      this.mobileMultiSelectIds = ids;
    },

    /** Back to nothing selected (S0) from any phone editing state. */
    clearMobileEditor() {
      this.mobileEditTileId = null;
      this.mobileMultiSelectIds = null;
      this.mobileArrangeTileId = null;
      this.mobileOpenToolId = null;
      this.mobileSheetExpanded = false;
    },

    /**
     * Drop ids for tiles that no longer exist (deleted, undone, resynced), so
     * no state can point at a tile that isn't on screen.
     */
    pruneMobileEditor(existingIds: ReadonlySet<string>) {
      if (
        this.mobileArrangeTileId &&
        !existingIds.has(this.mobileArrangeTileId)
      ) {
        this.mobileArrangeTileId = null;
      }
      if (this.mobileMultiSelectIds) {
        // Multi-edit first: losing the first pick must not end the session
        // while other picks remain.
        const kept = this.mobileMultiSelectIds.filter((id) =>
          existingIds.has(id),
        );
        if (kept.length === 0) {
          this.clearMobileEditor();
          return;
        }
        if (kept.length !== this.mobileMultiSelectIds.length) {
          this.mobileMultiSelectIds = kept;
        }
        if (this.mobileEditTileId && !existingIds.has(this.mobileEditTileId)) {
          this.mobileEditTileId = kept[0];
        }
        return;
      }
      if (this.mobileEditTileId && !existingIds.has(this.mobileEditTileId)) {
        this.setMobileEditTile(null);
      }
    },

    setPendingFocusTileId(tileId: string | null) {
      this.pendingFocusTileId = tileId;
    },

    consumePendingFocus(tileId: string): boolean {
      if (this.pendingFocusTileId !== tileId) return false;
      this.pendingFocusTileId = null;
      return true;
    },

    setShowMetaData(value: boolean) {
      this.showMetaData = value;
    },

    setShowMetaDataVerbose(value: boolean) {
      this.showMetaDataVerbose = value;
    },

    setShowGridGuide(value: boolean) {
      this.showGridGuide = value;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            GRID_GUIDE_STORAGE_KEY,
            value ? "1" : "0",
          );
        } catch {
          // Ignore storage failures (private mode, quota); the in-memory
          // preference still applies for this session.
        }
      }
    },

    resetSessionState() {
      this.activeTileId = null;
      this.activePanelId = null;
      this.pendingFocusTileId = null;
      this.clearMobileEditor();
    },

    reset() {
      this.$reset();
    },
  },
});
