import { computed, readonly } from "vue";
import type { GridViewContext } from "@/grid-context/GridViewContext";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridUploadsStore } from "@/stores/grid/gridUploads";
import { useGridCollectionStore } from "@/stores/grid/gridCollection";
import { useGridController } from "@/controllers/useGridController";

export function createLiveGridViewContext(): GridViewContext {
  // Resolved inside the factory (not at module scope) so the demo path, which
  // never calls this function, does not pull live stores/controller at setup.
  const session = useGridSessionStore();
  const viewport = useGridViewportStore();
  const ui = useGridUiStore();
  const uploads = useGridUploadsStore();
  const collection = useGridCollectionStore();
  const controller = useGridController();

  return {
    mode: "live",

    grid: computed(() =>
      session.currentGrid === null ? null : readonly(session.currentGrid),
    ),
    isOwner: computed(() => session.isOwner),
    canEdit: computed(() =>
      session.canEditAtBreakpoint(
        viewport.forcedBreakpoint,
        viewport.viewportBreakpoint,
      ),
    ),
    // Loading stays true until every tracked operation finishes: a grid load
    // (session) or a collection fetch can independently gate the canvas.
    isLoading: computed(
      () => collection.isLoading || session.isLoading,
    ),
    verticalCompact: computed(() => session.verticalCompact),
    activeBreakpoint: computed(() => viewport.activeBreakpoint),
    viewportBreakpoint: computed(() => viewport.viewportBreakpoint),
    forcedBreakpoint: computed(() => viewport.forcedBreakpoint),
    displayPositions: computed(() => viewport.displayPositions),
    showMetaData: computed(() => ui.showMetaData),
    showMetaDataVerbose: computed(() => ui.showMetaDataVerbose),
    uploadingTiles: computed(() => uploads.uploadingTiles),
    activeTileId: computed(() => ui.activeTileId),
    activePanelId: computed(() => ui.activePanelId),
    pendingFocusTileId: computed(() => ui.pendingFocusTileId),

    registerLayoutReadinessAdapter:
      controller.registerLayoutReadinessAdapter.bind(controller),
    setActiveBreakpoint:
      controller.setActiveBreakpoint.bind(controller),
    setViewportBreakpoint:
      controller.setViewportBreakpoint.bind(controller),
    setForcedBreakpoint:
      controller.setForcedBreakpoint.bind(controller),
    setDisplayPositions:
      controller.setDisplayPositions.bind(controller),
    commitCompactedLayout:
      controller.commitCompactedLayout.bind(controller),

    beginMove: controller.beginMove.bind(controller),
    commitMove: controller.commitMove.bind(controller),
    beginResize: controller.beginResize.bind(controller),
    commitResize: controller.commitResize.bind(controller),
    beginEditing: controller.beginEditing.bind(controller),
    commitEditing: controller.commitEditing.bind(controller),
    setTileContent: controller.setTileContent.bind(controller),
    patchTileContent: controller.patchTileContent.bind(controller),
    autosaveTileContent:
      controller.autosaveTileContent.bind(controller),
    patchDocumentItem: controller.patchDocumentItem.bind(controller),
    updateCaption: controller.updateCaption.bind(controller),
    removeTile: controller.removeTile.bind(controller),
    duplicateTile: controller.duplicateTile.bind(controller),
    resizeTile: controller.resizeTile.bind(controller),
    toggleTileBorder: controller.toggleTileBorder.bind(controller),
    toggleLinkBackground:
      controller.toggleLinkBackground.bind(controller),

    setPendingFocusTileId: ui.setPendingFocusTileId.bind(ui),
    setPanelActive: controller.setPanelActive.bind(controller),
    toggleMenuActive: controller.toggleMenuActive.bind(controller),
    togglePanelActive:
      controller.togglePanelActive.bind(controller),
    closeMenus: controller.closeMenus.bind(controller),
    getCookieValue: controller.getCookieValue.bind(controller),
  };
}
