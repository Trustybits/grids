import { computed, readonly, ref, shallowRef } from "vue";
import {
  resolveResponsiveLayoutVersion,
  type Breakpoint,
  type Grid,
} from "@grids/contracts/types";
import type { GridViewContext } from "@/grid-context/GridViewContext";
import { toCanonicalLayoutItems } from "@/utils/GriddleAdapter";

export function createDemoGridViewContext(grid: Grid): GridViewContext {
  const gridRef = shallowRef(grid);
  const forcedBreakpoint = ref<Breakpoint | null>(null);
  const activeBreakpoint = ref<Breakpoint>("lg");
  const viewportBreakpoint = ref<Breakpoint>("lg");
  // Grid.vue owns version-aware responsive projection. Seed the context with
  // canonical geometry until the engine publishes its final rendered state.
  const displayPositions = ref(toCanonicalLayoutItems(grid.tiles));
  const pendingFocusTileId = ref<string | null>(null);
  const noop = () => {};

  return {
    mode: "demo",

    grid: computed(() => readonly(gridRef.value)),
    isOwner: computed(() => false),
    canEdit: computed(() => false),
    activePreview: computed(() => null),
    isPreviewActive: computed(() => false),
    blocksGridMutation: computed(() => false),
    effectiveResponsiveLayoutVersion: computed(() =>
      resolveResponsiveLayoutVersion(
        gridRef.value.responsiveLayoutVersion,
      ),
    ),
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
    pendingFocusTileId: computed(() => pendingFocusTileId.value),

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
    startResponsiveLayoutPreview: () => false,
    stopPreview: noop,

    beginMove: noop,
    commitMove: noop,
    beginResize: noop,
    commitResize: noop,
    beginEditing: noop,
    commitEditing: noop,
    setTileContent: noop,
    patchTileContent: noop,
    patchTileContentSilently: noop,
    autosaveTileContent: noop,
    patchDocumentItem: noop,
    updateCaption: noop,
    removeTile: noop,
    duplicateTile: () => null,
    resizeTile: noop,
    toggleTileBorder: noop,
    toggleLinkBackground: noop,

    setPendingFocusTileId: (tileId) => {
      pendingFocusTileId.value = tileId;
    },
    setPanelActive: noop,
    toggleMenuActive: noop,
    togglePanelActive: noop,
    closeMenus: noop,
    getCookieValue: () => null,
  };
}
