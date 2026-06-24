import { computed, ref, shallowRef } from "vue";
import type { Breakpoint, Grid } from "@grids/contracts/types";
import type { GridViewContext } from "@/grid-view/GridViewContext";
import { projectGridLayout } from "@/utils/GridLayoutUtils";

function projectInitialDisplayPositions(grid: Grid) {
  return projectGridLayout({
    tiles: grid.tiles,
    breakpoint: "lg",
    columns: grid.colNum,
    overrides: grid.overrides,
  });
}

export function createDemoGridViewContext(grid: Grid): GridViewContext {
  const gridRef = shallowRef(grid);
  const forcedBreakpoint = ref<Breakpoint | null>(null);
  const activeBreakpoint = ref<Breakpoint>("lg");
  const viewportBreakpoint = ref<Breakpoint>("lg");
  const displayPositions = ref(projectInitialDisplayPositions(grid));
  const pendingFocusTileId = ref<string | null>(null);
  const noop = () => {};

  return {
    mode: "demo",

    grid: computed(() => gridRef.value),
    isOwner: computed(() => false),
    canEdit: computed(() => false),
    isLoading: computed(() => false),
    verticalCompact: computed(() => gridRef.value.verticalCompact),
    activeBreakpoint: computed(() => activeBreakpoint.value),
    viewportBreakpoint: computed(() => viewportBreakpoint.value),
    forcedBreakpoint: computed(() => forcedBreakpoint.value),
    displayPositions: computed(() => displayPositions.value),
    showMetaData: computed(() => false),
    showMetaDataVerbose: computed(() => false),
    uploadingTiles: computed(() => ({})),
    activeTileId: computed(() => null),
    activePanelId: computed(() => null),
    pendingFocusTileId,

    registerLayoutReadinessAdapter: () => noop,
    setActiveBreakpoint: (breakpoint) => {
      activeBreakpoint.value = breakpoint;
    },
    setViewportBreakpoint: (breakpoint) => {
      viewportBreakpoint.value = breakpoint;
    },
    setForcedBreakpoint: (breakpoint) => {
      forcedBreakpoint.value = breakpoint;
    },
    setDisplayPositions: (positions) => {
      displayPositions.value = positions.map((position) => ({
        ...position,
      }));
    },
    commitCompactedLayout: noop,

    beginMove: noop,
    commitMove: noop,
    beginResize: noop,
    commitResize: noop,
    beginEditing: noop,
    commitEditing: noop,
    setTileContent: noop,
    patchTileContent: noop,
    autosaveTileContent: noop,
    patchDocumentItem: noop,
    updateCaption: noop,
    removeTile: noop,
    duplicateTile: () => null,
    resizeTile: noop,
    toggleTileBorder: noop,
    toggleLinkBackground: noop,

    setPanelActive: noop,
    toggleMenuActive: noop,
    togglePanelActive: noop,
    closeMenus: noop,
    getCookieValue: () => null,
  };
}
