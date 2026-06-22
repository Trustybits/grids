import { computed } from "vue";
import { defineStore, storeToRefs } from "pinia";
import type {
  Breakpoint,
  CopyDepth,
  DocumentItem,
  Grid,
  TileContent,
  AnyTileContent,
} from "@grids/contracts/types";
import type { Snapshot } from "@/undo/UndoTypes";
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

  function $reset(): void {
    ui.reset();
    viewport.reset();
    collection.reset();
    session.reset();
    history.reset();
    uploads.reset();
    compatibility.reset();
  }

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

    captureSnapshot: (actionLabel: string) =>
      controller.captureSnapshot(actionLabel, {
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    refreshStableSnapshot: () =>
      controller.refreshStableSnapshot({
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    pushUndoSnapshot: (actionLabel: string) =>
      controller.pushUndoSnapshot(actionLabel, {
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    undo: () =>
      controller.undo({
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    redo: () =>
      controller.redo({
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    undoRedoUntil: (snapshotId: number) =>
      controller.undoRedoUntil(snapshotId, {
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    applySnapshot: (snapshot: Snapshot) =>
      controller.applySnapshot(snapshot, {
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    beginEditing: (tileId: string) =>
      controller.beginEditing(tileId, {
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    commitEditing: () =>
      controller.commitEditing({
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    beginMove: () =>
      controller.beginMove({
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    commitMove: () =>
      controller.commitMove(
        {
          resolvedUrls: uploads.resolvedUrls,
          resolvedDocumentItemUrls:
            uploads.resolvedDocumentItemUrls,
        },
      ),
    beginResize: () =>
      controller.beginResize({
        resolvedUrls: uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          uploads.resolvedDocumentItemUrls,
      }),
    commitResize: () =>
      controller.commitResize(
        {
          resolvedUrls: uploads.resolvedUrls,
          resolvedDocumentItemUrls:
            uploads.resolvedDocumentItemUrls,
        },
      ),
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
    createGrid: (name: string) => {
      return controller.createGrid(name);
    },
    duplicateGrid: (
      sourceGrid: Grid,
      copyDepth: CopyDepth = "full",
    ) => {
      return controller.duplicateGrid(sourceGrid, copyDepth);
    },
    loadGrid: controller.loadGrid.bind(controller),
    loadDemoGrid: controller.loadDemoGrid.bind(controller),
    recordRecent: controller.recordRecent.bind(controller),
    loadRecents: controller.loadRecents.bind(controller),
    saveRecents: controller.saveRecents.bind(controller),
    toggleVerticalCompact:
      controller.toggleVerticalCompact.bind(controller),
    setVerticalCompact:
      controller.setVerticalCompact.bind(controller),
    saveGrid: () =>
      controller.saveGrid(
        uploads.resolvedUrls,
        uploads.resolvedDocumentItemUrls,
      ),
    addTile: (content: TileContent) => controller.addTile(content),
    setTileContent: (id: string, content: TileContent) =>
      controller.setTileContent(id, content),
    patchTileContent: (
      id: string,
      patch: Partial<AnyTileContent>,
    ) => controller.patchTileContent(id, patch),
    patchDocumentItem: (
      tileId: string,
      itemId: string,
      patch: Partial<DocumentItem>,
    ) => controller.patchDocumentItem(tileId, itemId, patch),
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
    updateGrid: controller.updateGrid.bind(controller),
    setActiveBreakpoint: controller.setActiveBreakpoint.bind(controller),
    setViewportBreakpoint:
      controller.setViewportBreakpoint.bind(controller),
    setForcedBreakpoint: (breakpoint: Breakpoint | null) =>
      controller.setForcedBreakpoint(
        breakpoint,
        session.currentGrid,
        uploads.resolvedUrls,
        uploads.resolvedDocumentItemUrls,
      ),
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
    deleteGrid: (id: string) => controller.deleteGrid(id),
    renameGrid: (id: string, newName: string) => {
      return controller.renameGrid(id, newName);
    },
    $reset,
  };
});
