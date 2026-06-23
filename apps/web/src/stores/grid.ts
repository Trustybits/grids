import { computed } from "vue";
import { defineStore, storeToRefs } from "pinia";
import type { Breakpoint } from "@grids/contracts/types";
import { useGridController } from "@/controllers/useGridController";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useGridCollectionStore } from "@/stores/grid/gridCollection";
import { useGridCompatibilityStore } from "@/stores/grid/gridCompatibility";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useGridUploadsStore } from "@/stores/grid/gridUploads";
import { selectGridFacadeLoading } from "@/stores/grid/gridFacadePolicy";

export const useGridStore = defineStore("grid", () => {
  const ui = useGridUiStore();
  const viewport = useGridViewportStore();
  const collection = useGridCollectionStore();
  const compatibility = useGridCompatibilityStore();
  const session = useGridSessionStore();
  const history = useGridHistoryStore();
  const uploads = useGridUploadsStore();
  const controller = useGridController();
  const uiRefs = storeToRefs(ui);
  const viewportRefs = storeToRefs(viewport);
  const collectionRefs = storeToRefs(collection);
  const compatibilityRefs = storeToRefs(compatibility);
  const sessionRefs = storeToRefs(session);
  const historyRefs = storeToRefs(history);
  const uploadRefs = storeToRefs(uploads);

  const isLoading = computed({
    get: () =>
      selectGridFacadeLoading({
        collectionLoading: collectionRefs.isLoading.value,
        sessionLoading: sessionRefs.isLoading.value,
      }),
    set: (value: boolean) => {
      session.setLoading(value);
    },
  });
  const canEdit = computed(() =>
    controller.canEdit({
      isOwner: sessionRefs.isOwner.value,
      forcedBreakpoint: viewportRefs.forcedBreakpoint.value,
      viewportBreakpoint: viewportRefs.viewportBreakpoint.value,
    }),
  );

  return {
    undoRedoVersion: historyRefs.stackVersion,
    grids: collectionRefs.grids,
    currentGrid: sessionRefs.currentGrid,
    isLoading,
    error: compatibilityRefs.error,
    showMetaData: uiRefs.showMetaData,
    showMetaDataVerbose: uiRefs.showMetaDataVerbose,
    isOwner: sessionRefs.isOwner,
    isDemoGrid: sessionRefs.isDemoGrid,
    sessionGeneration: sessionRefs.sessionGeneration,
    persistenceStatus: sessionRefs.persistenceStatus,
    persistenceError: sessionRefs.persistenceError,
    recentGridIds: collectionRefs.recentGridIds,
    activeTileId: uiRefs.activeTileId,
    activePanelId: uiRefs.activePanelId,
    uploadingTiles: uploadRefs.uploadingTiles,
    resolvedUrls: uploadRefs.resolvedUrls,
    resolvedDocumentItemUrls:
      uploadRefs.resolvedDocumentItemUrls,
    pendingFocusTileId: uiRefs.pendingFocusTileId,
    activeBreakpoint: viewportRefs.activeBreakpoint,
    viewportBreakpoint: viewportRefs.viewportBreakpoint,
    forcedBreakpoint: viewportRefs.forcedBreakpoint,
    displayPositions: viewportRefs.displayPositions,
    verticalCompact: sessionRefs.verticalCompact,
    canEdit,
    canUndo: historyRefs.canUndo,
    canRedo: historyRefs.canRedo,
    undoActionLabel: historyRefs.undoActionLabel,
    redoActionLabel: historyRefs.redoActionLabel,
    undoRedoStacks: historyRefs.undoRedoStacks,

    setMenuActive: controller.setMenuActive.bind(controller),
    setPanelActive: controller.setPanelActive.bind(controller),
    toggleMenuActive: controller.toggleMenuActive.bind(controller),
    togglePanelActive: controller.togglePanelActive.bind(controller),
    closeMenus: controller.closeMenus.bind(controller),
    checkShowMetaDataCookie:
      controller.checkShowMetaDataCookie.bind(controller),
    setShowMetaData: controller.setShowMetaData.bind(controller),
    setShowMetaDataVerbose:
      controller.setShowMetaDataVerbose.bind(controller),
    getCookieValue: controller.getCookieValue.bind(controller),
    setCookieValue: controller.setCookieValue.bind(controller),
    registerLayoutReadinessAdapter:
      controller.registerLayoutReadinessAdapter.bind(controller),

    captureSnapshot: controller.captureSnapshot.bind(controller),
    refreshStableSnapshot:
      controller.refreshStableSnapshot.bind(controller),
    pushUndoSnapshot:
      controller.pushUndoSnapshot.bind(controller),
    undo: controller.undo.bind(controller),
    redo: controller.redo.bind(controller),
    undoRedoUntil: controller.undoRedoUntil.bind(controller),
    applySnapshot: controller.applySnapshot.bind(controller),
    beginEditing: controller.beginEditing.bind(controller),
    commitEditing: controller.commitEditing.bind(controller),
    beginMove: controller.beginMove.bind(controller),
    commitMove: controller.commitMove.bind(controller),
    beginResize: controller.beginResize.bind(controller),
    commitResize: controller.commitResize.bind(controller),
    setTileUploading: controller.setTileUploading.bind(controller),
    clearTileUploading:
      controller.clearTileUploading.bind(controller),
    setResolvedUrl: controller.setResolvedUrl.bind(controller),
    setResolvedDocumentItemUrl:
      controller.setResolvedDocumentItemUrl.bind(controller),
    getResolvedUrl: controller.getResolvedUrl.bind(controller),
    clearResolvedUrl: controller.clearResolvedUrl.bind(controller),
    clearResolvedDocumentItemsForTile:
      controller.clearResolvedDocumentItemsForTile.bind(controller),
    fetchGrids: controller.fetchGrids.bind(controller),
    createGrid: controller.createGrid.bind(controller),
    duplicateGrid: controller.duplicateGrid.bind(controller),
    loadGrid: controller.loadGrid.bind(controller),
    loadDemoGrid: controller.loadDemoGrid.bind(controller),
    recordRecent: controller.recordRecent.bind(controller),
    loadRecents: controller.loadRecents.bind(controller),
    saveRecents: controller.saveRecents.bind(controller),
    toggleVerticalCompact:
      controller.toggleVerticalCompact.bind(controller),
    setVerticalCompact:
      controller.setVerticalCompact.bind(controller),
    scheduleSave: controller.scheduleSave.bind(controller),
    flushSaves: controller.flushSaves.bind(controller),
    saveGrid: controller.saveGrid.bind(controller),
    renameCurrentGrid: controller.renameCurrentGrid.bind(controller),
    addTile: controller.addTile.bind(controller),
    setTileContent: controller.setTileContent.bind(controller),
    patchTileContent: controller.patchTileContent.bind(controller),
    patchDocumentItem: controller.patchDocumentItem.bind(controller),
    updateCaption: controller.updateCaption.bind(controller),
    resolveUploadedUrl: controller.resolveUploadedUrl.bind(controller),
    setGridTheme: controller.setGridTheme.bind(controller),
    setDuplicatable:
      controller.setDuplicatable.bind(controller),
    addBackgroundImage:
      controller.addBackgroundImage.bind(controller),
    removeBackgroundImage:
      controller.removeBackgroundImage.bind(controller),
    setCustomOgImage:
      controller.setCustomOgImage.bind(controller),
    removeCustomOgImage:
      controller.removeCustomOgImage.bind(controller),
    setBackgroundColor:
      controller.setBackgroundColor.bind(controller),
    removeBackgroundColor:
      controller.removeBackgroundColor.bind(controller),
    getViewportGridY:
      controller.getViewportGridY.bind(controller),
    duplicateTile: controller.duplicateTile.bind(controller),
    removeTile: controller.removeTile.bind(controller),
    resizeTile: controller.resizeTile.bind(controller),
    toggleTileBorder:
      controller.toggleTileBorder.bind(controller),
    toggleLinkBackground:
      controller.toggleLinkBackground.bind(controller),
    commitRenderedDesktopLayout:
      controller.commitRenderedDesktopLayout.bind(controller),
    commitCompactedLayout:
      controller.commitCompactedLayout.bind(controller),
    updateGrid: controller.updateGrid.bind(controller),
    setActiveBreakpoint: controller.setActiveBreakpoint.bind(controller),
    setViewportBreakpoint:
      controller.setViewportBreakpoint.bind(controller),
    setForcedBreakpoint:
      controller.setForcedBreakpoint.bind(controller),
    setDisplayPositions:
      controller.setDisplayPositions.bind(controller),
    getBreakpointPositions: (breakpoint: Breakpoint) =>
      controller.getBreakpointPositions(
        session.currentGrid,
        breakpoint,
      ),
    hasBreakpointOverride: (breakpoint: Breakpoint) =>
      controller.hasBreakpointOverride(
        session.currentGrid,
        breakpoint,
      ),
    updateBreakpointOverride:
      controller.updateBreakpointOverride.bind(controller),
    saveBreakpointPositions:
      controller.saveBreakpointPositions.bind(controller),
    resetBreakpoint: controller.resetBreakpoint.bind(controller),
    clearCurrentGrid: () => controller.clearSession(),
    deleteGrid: controller.deleteGrid.bind(controller),
    renameGrid: controller.renameGrid.bind(controller),
    $reset: () => controller.resetFacade(),
  };
});
