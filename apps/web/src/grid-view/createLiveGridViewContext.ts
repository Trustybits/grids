import { computed, toRef } from "vue";
import type { GridViewContext } from "@/grid-view/GridViewContext";
import { useGridStore } from "@/stores/grid";

export function createLiveGridViewContext(): GridViewContext {
  const gridStore = useGridStore();

  return {
    mode: "live",

    grid: computed(() => gridStore.currentGrid),
    isOwner: computed(() => gridStore.isOwner),
    canEdit: computed(() => gridStore.canEdit),
    isLoading: computed(() => gridStore.isLoading),
    verticalCompact: computed(() => gridStore.verticalCompact),
    activeBreakpoint: computed(() => gridStore.activeBreakpoint),
    viewportBreakpoint: computed(() => gridStore.viewportBreakpoint),
    forcedBreakpoint: computed(() => gridStore.forcedBreakpoint),
    displayPositions: computed(() => gridStore.displayPositions),
    showMetaData: computed(() => gridStore.showMetaData),
    showMetaDataVerbose: computed(() => gridStore.showMetaDataVerbose),
    uploadingTiles: computed(() => gridStore.uploadingTiles),
    activeTileId: computed(() => gridStore.activeTileId),
    activePanelId: computed(() => gridStore.activePanelId),
    pendingFocusTileId: toRef(gridStore, "pendingFocusTileId"),

    registerLayoutReadinessAdapter:
      gridStore.registerLayoutReadinessAdapter.bind(gridStore),
    setActiveBreakpoint:
      gridStore.setActiveBreakpoint.bind(gridStore),
    setViewportBreakpoint:
      gridStore.setViewportBreakpoint.bind(gridStore),
    setForcedBreakpoint:
      gridStore.setForcedBreakpoint.bind(gridStore),
    setDisplayPositions:
      gridStore.setDisplayPositions.bind(gridStore),
    commitCompactedLayout:
      gridStore.commitCompactedLayout.bind(gridStore),

    beginMove: gridStore.beginMove.bind(gridStore),
    commitMove: gridStore.commitMove.bind(gridStore),
    beginResize: gridStore.beginResize.bind(gridStore),
    commitResize: gridStore.commitResize.bind(gridStore),
    beginEditing: gridStore.beginEditing.bind(gridStore),
    commitEditing: gridStore.commitEditing.bind(gridStore),
    setTileContent: gridStore.setTileContent.bind(gridStore),
    patchTileContent: gridStore.patchTileContent.bind(gridStore),
    autosaveTileContent:
      gridStore.autosaveTileContent.bind(gridStore),
    patchDocumentItem: gridStore.patchDocumentItem.bind(gridStore),
    updateCaption: gridStore.updateCaption.bind(gridStore),
    removeTile: gridStore.removeTile.bind(gridStore),
    duplicateTile: gridStore.duplicateTile.bind(gridStore),
    resizeTile: gridStore.resizeTile.bind(gridStore),
    toggleTileBorder: gridStore.toggleTileBorder.bind(gridStore),
    toggleLinkBackground:
      gridStore.toggleLinkBackground.bind(gridStore),

    setPanelActive: gridStore.setPanelActive.bind(gridStore),
    toggleMenuActive: gridStore.toggleMenuActive.bind(gridStore),
    togglePanelActive:
      gridStore.togglePanelActive.bind(gridStore),
    closeMenus: gridStore.closeMenus.bind(gridStore),
    getCookieValue: gridStore.getCookieValue.bind(gridStore),
  };
}
