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
      this.mobileEditTileId = tileId;
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
      this.mobileEditTileId = null;
    },

    reset() {
      this.$reset();
    },
  },
});
