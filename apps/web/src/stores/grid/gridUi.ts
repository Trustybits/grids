import { defineStore } from "pinia";

export const useGridUiStore = defineStore("gridUi", {
  state: () => ({
    activeTileId: null as string | null,
    activePanelId: null as string | null,
    pendingFocusTileId: null as string | null,
    showMetaData: false,
    showMetaDataVerbose: false,
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

    resetSessionState() {
      this.activeTileId = null;
      this.activePanelId = null;
      this.pendingFocusTileId = null;
    },

    reset() {
      this.$reset();
    },
  },
});
