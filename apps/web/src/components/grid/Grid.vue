<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <p v-if="gridView.isLoading">Loading layout...</p>
  <div
    v-else-if="contractTiles.length"
    ref="scaleWrapperRef"
    class="grid-scale-wrapper"
    :style="scaleWrapperStyle"
    @pointerdown.capture="onGridPointerDown"
  >
    <!--
      Shared canvas container: the visual guide overlay and the interactive
      tile engine share one top-left origin here so centering and the mobile
      transform: scale() can never diverge between the two layers.
    -->
    <div class="grid-canvas-container">
      <GridVisualGuide
        v-if="gridView.canEdit && gridView.showGridGuide"
        :style="guideTransformStyle"
        :cols="responsiveColNum"
        :row-height="rowHeight"
        :margin="margin"
        :tiles="gridView.displayPositions"
        :is-interacting="isInteracting"
      />
      <GriddleGrid
        ref="gridLayoutRef"
        class-name="grid-container"
        :api="api"
        :height="griddleContentHeight"
        :selection="griddleSelection"
        :show-grid="false"
        :style="gridInnerStyle"
        @drag-start="onDragStart"
        @drag-end="onDragEnd"
        @resize-start="onResizeStart"
        @resize-end="onResizeEnd"
      >
        <template #tile="{ tile: griddleTile }">
          <GridTile
            v-if="tilesById.get(griddleTile.id)"
            :ref="(instance) => setGridTileRef(griddleTile.id, instance)"
            :tile="tilesById.get(griddleTile.id)!"
            :layout="fromGriddleTile(griddleTile)"
          />
        </template>
      </GriddleGrid>
    </div>
  </div>
  <p v-else class="empty-grid-message">No tiles yet</p>
</template>

<script lang="ts">
import {
  proxyRefs,
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  type CSSProperties,
} from "vue";
import { GriddleGrid, useGriddle } from "@griddle/vue";
import {
  gridContentSize,
  reflowTiles,
  type Tile as GriddleTile,
} from "@griddle/core";
import GridTile from "./Tile.vue";
import GridVisualGuide from "./GridVisualGuide.vue";
import { useResponsiveGridLayout } from "@/composables/useResponsiveGridLayout";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import {
  buildGridConfig,
  fromGriddleTile,
  fromGriddleTiles,
  toCanonicalLayoutItems,
  toGriddlePlacements,
  toGriddleTiles,
} from "@/utils/GriddleAdapter";
import { isHiddenSuggestion } from "@/utils/TileUtils";
import {
  TILE_DRAGGING_ID,
  TILE_GEOMETRY_VERSION,
  TILE_REMOVE_REQUEST,
  TILE_RESIZE_REQUEST,
} from "@/grid-context/tileInteractionKeys";

export default {
  components: {
    GriddleGrid,
    GridTile,
    GridVisualGuide,
  },
  props: {
    rowHeight: {
      type: Number,
      default: 75,
    },
    // When true, suppress Grid.vue's built-in viewport→grid auto-scaling.
    // The marketing-homepage embed uses this so it can apply its own
    // CSS transform: scale() to fit each device-frame size during the
    // hero scroll-jack, without compounding on top of the internal scale.
    disableAutoScale: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const gridView = proxyRefs(useGridViewContext());
    const margin = 48;

    const baseColNum = computed(() => {
      return gridView.grid?.colNum ?? 12;
    });

    const {
      activeBreakpoint,
      gridInnerStyle,
      gridLayoutRef,
      gridWidth,
      mobileScale,
      responsiveColumnCount: responsiveColNum,
      scaleWrapperRef,
      scaleWrapperStyle,
      waitForLayoutReady,
      markLayoutPending,
      markLayoutReady,
    } = useResponsiveGridLayout({
      baseColumnCount: baseColNum,
      forcedBreakpoint: () => gridView.forcedBreakpoint,
      rowHeight: () => props.rowHeight,
      margin,
      disableAutoScale: () => props.disableAutoScale,
      onBreakpointsChanged: (active, viewport) => {
        gridView.setActiveBreakpoint(active);
        gridView.setViewportBreakpoint(viewport);
      },
    });

    const disposeLayoutReadiness =
      gridView.registerLayoutReadinessAdapter({
        waitForLayoutReady,
      });
    onUnmounted(disposeLayoutReadiness);

    // The visual guide overlays the grid engine at the same origin. Under the
    // mobile viewport fit it must scale by the same factor as the tile layer
    // (which receives its transform through gridInnerStyle) to stay aligned.
    const guideTransformStyle = computed<CSSProperties>(() =>
      mobileScale.value >= 1
        ? {}
        : {
            transformOrigin: "top left",
            transform: `scale(${mobileScale.value})`,
          },
    );

    // Reactive interaction flag for the visual guide (brighten while dragging or
    // resizing). Kept separate from the non-reactive `interacting` sync latch
    // below, which gates engine reloads.
    const isInteracting = ref(false);

    // --- Griddle engine ----------------------------------------------------
    // Griddle owns tile state and all responsive geometry. `contractTiles`
    // maps a Griddle tile id back to our `Tile` for the #tile slot.
    const contractTiles = computed(() => gridView.grid?.tiles ?? []);
    // Hidden suggestions leave the render map but stay in the layout below, so
    // the cell they reserved reads as empty space without reflowing neighbours.
    const tilesById = computed(
      () =>
        new Map(
          contractTiles.value
            .filter((tile) => !isHiddenSuggestion(tile, gridView.canEdit))
            .map((tile) => [tile.i, tile]),
        ),
    );

    const canonicalLayout = computed(() =>
      toCanonicalLayoutItems(contractTiles.value),
    );

    const isDerivedLayout = computed(
      () => responsiveColNum.value < baseColNum.value,
    );

    const activeGriddlePlacements = computed(() => {
      if (!isDerivedLayout.value) return undefined;

      return toGriddlePlacements(
        gridView.grid?.overrides?.[activeBreakpoint.value],
      );
    });

    const griddleTiles = computed(() =>
      toGriddleTiles(canonicalLayout.value, contractTiles.value, {
        editable: gridView.canEdit,
      }),
    );

    const gridConfig = computed(() =>
      buildGridConfig({
        cols: responsiveColNum.value,
        rowHeight: props.rowHeight,
        margin,
        // Saved breakpoint placements remain exact during the initial reflow
        // transaction below. Keep engine gravity configured, though, so later
        // user moves and resizes compact normally at every breakpoint.
        verticalCompact: gridView.verticalCompact,
        // grids.so owns page scroll + outer transform:scale(); the grid must
        // size to content and not lock touch-action. And we never handle
        // draw-to-create, so gate it off.
        scroll: "none",
        drawToCreate: false,
      }),
    );

    // Griddle validates a snapshot before installing it. Always load canonical
    // geometry in its persisted column space; a narrower target is installed
    // only by the explicit reflow transaction below.
    const engineLoadConfig = computed(() => ({
      ...gridConfig.value,
      cols: baseColNum.value,
    }));

    const api = useGriddle({
      config: engineLoadConfig.value,
      // Enter all app geometry through the guarded sync transaction below.
      // This keeps construction safe even if persisted geometry is invalid.
      tiles: [],
    });
    provide(TILE_GEOMETRY_VERSION, api.version);

    // @griddle/vue@0.1.1 passes its numeric content height directly to a Vue
    // style binding, which browsers reject instead of treating as pixels. Since
    // every Griddle tile is absolutely positioned, that collapses both the
    // content layer and grid root to zero height. Give the root an explicit CSS
    // height from Griddle's own sizing helper; its internal min-height: 100%
    // then restores the full containing block for the governed tiles.
    const griddleContentHeight = computed(
      () =>
        `${gridContentSize(api.config.value, api.tiles.value).height + margin}px`,
    );

    // Selection is a controlled Griddle feature. The app only supports
    // single-tile gestures and owns its hover/edit visuals, so keep Griddle's
    // selection empty to avoid its built-in blue outline.
    const griddleSelection = new Set<string>();

    // Load canonical source + config into the engine whenever they change
    // (breakpoint switch, tile add/remove, edit-gate change, compaction toggle,
    // or reconciliation after a committed gesture). Guarded so a reactive
    // reload can never fight a live gesture.
    // Intermediate load/reflow/compaction events are deliberately not
    // published: GridMenu and gesture commits see only the settled engine.
    let interacting = false;
    let engineSyncPending = false;
    let syncGeneration = 0;
    let lastSyncedBreakpoint: typeof activeBreakpoint.value | null = null;
    const syncEngine = async (): Promise<void> => {
      const generation = ++syncGeneration;
      const breakpoint = activeBreakpoint.value;
      const breakpointChanged =
        lastSyncedBreakpoint !== null &&
        lastSyncedBreakpoint !== breakpoint;
      lastSyncedBreakpoint = breakpoint;
      markLayoutPending();
      const previousSnapshot = api.toJSON();
      let usedAuthoritativePlacements =
        activeGriddlePlacements.value !== undefined;
      let keptPreviousState = false;

      const loadTarget = (
        placements: typeof activeGriddlePlacements.value,
        sourceTiles: GriddleTile[] = griddleTiles.value,
      ): void => {
        api.loadJSON({
          version: 1,
          config: engineLoadConfig.value,
          tiles: sourceTiles,
        });

        // The canonical target is loaded as-is. A narrower target always takes
        // exactly one explicit route through Griddle's responsive algorithm.
        if (isDerivedLayout.value) {
          api.reflow({
            cols: responsiveColNum.value,
            strategy: "griddle-v1",
            ...(placements ? { placements } : {}),
          });
        }

        // Reflow and loadJSON do not apply gravity. Preserve placements during
        // ordinary reconciliation, but a real breakpoint transition must
        // settle gravity after reflow so structural changes made elsewhere
        // cannot leave stale gaps behind.
        const shouldApplyGravity =
          gridView.verticalCompact &&
          (placements === undefined || breakpointChanged);
        if (shouldApplyGravity) api.grid.compactAll();
      };

      try {
        loadTarget(activeGriddlePlacements.value);
      } catch (initialError) {
        try {
          // One bounded recovery stays entirely inside Griddle: repair the
          // canonical snapshot with the same immutable strategy, discard any
          // rejected saved placements, then use automatic target reflow.
          const repairedCanonical = reflowTiles(griddleTiles.value, {
            cols: baseColNum.value,
            strategy: "griddle-v1",
          });
          loadTarget(undefined, repairedCanonical);
          usedAuthoritativePlacements = false;
          console.warn(
            "Grids: Griddle rejected a layout; recovered with automatic reflow.",
            initialError,
          );
        } catch (recoveryError) {
          keptPreviousState = true;
          try {
            api.loadJSON(previousSnapshot);
          } catch (restoreError) {
            console.error(
              "Grids: failed to restore the last legal Griddle state.",
              restoreError,
            );
          }
          console.error(
            "Grids: Griddle rejected both the selected layout and its automatic recovery; keeping the last legal engine state.",
            { initialError, recoveryError },
          );
        }
      }
      await nextTick();
      if (generation !== syncGeneration) return;

      const settled = fromGriddleTiles(api.tiles.value);
      gridView.setDisplayPositions(settled);
      if (
        !keptPreviousState &&
        breakpointChanged &&
        gridView.verticalCompact &&
        usedAuthoritativePlacements
      ) {
        gridView.commitCompactedLayout(settled);
      }
      markLayoutReady();
    };

    watch(
      [
        griddleTiles,
        gridConfig,
        activeGriddlePlacements,
      ],
      () => {
        if (interacting) {
          engineSyncPending = true;
          markLayoutPending();
          return;
        }
        void syncEngine();
      },
    );

    const finishInteraction = (): void => {
      interacting = false;
      if (!engineSyncPending) return;
      engineSyncPending = false;
      void syncEngine();
    };

    onMounted(() => {
      void syncEngine();
    });

    // --- Gesture wiring ----------------------------------------------------
    type GridTileClickTarget = {
      handleGridShortClick(event: PointerEvent): void;
    };
    type GridClickCandidate = {
      tileId: string;
      pointerId: number;
      startX: number;
      startY: number;
      event: PointerEvent;
    };

    const gridTileRefs = new Map<string, GridTileClickTarget>();
    const setGridTileRef = (id: string, instance: unknown): void => {
      const target = instance as GridTileClickTarget | null;
      if (target?.handleGridShortClick) {
        gridTileRefs.set(id, target);
      } else {
        gridTileRefs.delete(id);
      }
    };

    const CLICK_MOVE_THRESHOLD = 12;
    let gridClickCandidate: GridClickCandidate | null = null;

    const onGridPointerDown = (event: PointerEvent): void => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest(
          'button, a, input, textarea, select, [role="button"], [data-griddle-handle]',
        )
      ) {
        return;
      }

      const tileElement = target.closest<HTMLElement>("[data-griddle-tile]");
      const tileId = tileElement?.dataset.griddleTile;
      if (!tileId) return;

      gridClickCandidate = {
        tileId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        event,
      };
    };

    const clearGridClickCandidate = (): void => {
      gridClickCandidate = null;
    };

    const onGridPointerUp = (event: PointerEvent): void => {
      const candidate = gridClickCandidate;
      clearGridClickCandidate();
      if (
        !candidate ||
        event.pointerType !== "mouse" ||
        event.pointerId !== candidate.pointerId ||
        event.button !== 0
      ) {
        return;
      }

      const distance = Math.hypot(
        event.clientX - candidate.startX,
        event.clientY - candidate.startY,
      );
      if (distance <= CLICK_MOVE_THRESHOLD) {
        gridTileRefs
          .get(candidate.tileId)
          ?.handleGridShortClick(candidate.event);
      }
    };

    onMounted(() => {
      // Resolve the app's short-click before Griddle finalizes its gesture.
      // Published Griddle versions refresh their tile slot on pointer-up even
      // when the pointer never moved, which can invalidate `gridTileRefs`
      // before a bubble-phase listener reaches it. Newer Griddle versions do
      // not start a drag until movement crosses the threshold, but capture
      // keeps this integration correct while that package update rolls out.
      window.addEventListener("pointerup", onGridPointerUp, true);
      window.addEventListener("pointercancel", clearGridClickCandidate);
    });
    onUnmounted(() => {
      window.removeEventListener("pointerup", onGridPointerUp, true);
      window.removeEventListener("pointercancel", clearGridClickCandidate);
      gridTileRefs.clear();
    });

    // Grid-level drag/resize events publish the current gesture to Tile.vue so
    // it can drive its drag visual state.
    const draggingTileId = ref<string | null>(null);
    provide(TILE_DRAGGING_ID, draggingTileId);

    const resizeTileThroughEngine = (
      id: string,
      width: number,
      height: number,
    ): void => {
      if (!gridView.canEdit) return;

      const tile = api.grid.getTile(id);
      if (!tile) return;
      const targetWidth = Math.min(width, responsiveColNum.value);
      if (tile.w === targetWidth && tile.h === height) return;

      // Toolbar resizes are programmatic gestures. Run the mutation through
      // Griddle (rather than bulk-loading an overlapping projected layout) so
      // collision displacement and structural repacking complete atomically.
      gridView.beginResize();
      const targetCol = Math.min(
        tile.col,
        responsiveColNum.value - targetWidth,
      );
      if (targetCol !== tile.col) {
        api.moveTile(id, { col: targetCol, row: tile.row });
      }
      const committed = api.resizeTile(id, {
        w: targetWidth,
        h: height,
      });
      if (!committed) {
        // Valid presets are expected to fit after the responsive width clamp.
        // Close the pending history gesture defensively if Griddle rejects it
        // so a later resize cannot inherit stale pending history state.
        gridView.commitResize();
        return;
      }

      const resolved = fromGriddleTiles(api.tiles.value);
      gridView.setDisplayPositions(resolved);
      gridView.commitResize();
    };
    provide(TILE_RESIZE_REQUEST, resizeTileThroughEngine);

    const removeTileThroughEngine = (id: string): void => {
      if (!gridView.canEdit) return;

      const tileExists = api.grid.getTile(id) !== undefined;
      const hadAuthoritativePlacements =
        activeGriddlePlacements.value !== undefined;

      if (!tileExists) {
        gridView.removeTile(id);
        return;
      }

      api.removeTile(id);
      const settled = fromGriddleTiles(api.tiles.value);
      gridView.setDisplayPositions(settled);

      // The controller still owns the structural mutation, undo snapshot, and
      // cleanup. Passing the settled layout lets it persist post-removal
      // gravity in the same transaction without creating overrides for a
      // breakpoint that was already automatic.
      gridView.removeTile(
        id,
        gridView.verticalCompact && hadAuthoritativePlacements
          ? settled
          : undefined,
      );
    };
    provide(TILE_REMOVE_REQUEST, removeTileThroughEngine);

    const onDragStart = (id: string): void => {
      interacting = true;
      isInteracting.value = true;
      draggingTileId.value = id;
      if (gridView.canEdit) gridView.beginMove();
    };

    const onDragEnd = (_id: string, committed: boolean): void => {
      interacting = false;
      isInteracting.value = false;
      draggingTileId.value = null;
      if (committed && gridView.canEdit) {
        gridView.setDisplayPositions(fromGriddleTiles(api.tiles.value));
        gridView.commitMove();
      }
      finishInteraction();
    };

    const onResizeStart = (_id: string): void => {
      interacting = true;
      isInteracting.value = true;
      if (gridView.canEdit) gridView.beginResize();
    };

    const onResizeEnd = (_id: string, committed: boolean): void => {
      interacting = false;
      isInteracting.value = false;
      if (committed && gridView.canEdit) {
        gridView.setDisplayPositions(fromGriddleTiles(api.tiles.value));
        gridView.commitResize();
      }
      finishInteraction();
    };

    // When gravity is toggled on, compact tiles through the engine and persist.
    // The controller routes positions to canonical tiles (lg) or per-breakpoint
    // overrides (md/sm).
    watch(
      () => gridView.verticalCompact,
      (isCompact, wasCompact) => {
        if (!gridView.grid || !gridView.canEdit) return;
        if (isCompact && !wasCompact) {
          api.updateConfig({ gravity: "top" });
          api.grid.compactAll();
          const compacted = fromGriddleTiles(api.tiles.value);
          gridView.setDisplayPositions(compacted);
          gridView.commitCompactedLayout(compacted);
        }
      },
    );

    return {
      gridView,
      api,
      griddleContentHeight,
      griddleSelection,
      margin,
      gridWidth,
      contractTiles,
      tilesById,
      responsiveColNum,
      guideTransformStyle,
      isInteracting,
      fromGriddleTile: (tile: GriddleTile) => fromGriddleTile(tile),
      activeBreakpoint,
      scaleWrapperStyle,
      gridInnerStyle,
      gridLayoutRef,
      scaleWrapperRef,
      setGridTileRef,
      onGridPointerDown,
      onDragStart,
      onDragEnd,
      onResizeStart,
      onResizeEnd,
      removeTileThroughEngine,
      resizeTileThroughEngine,
    };
  },
};
</script>

<style scoped>
.grid-scale-wrapper {
  overflow: hidden;
}

/*
  Shared origin for the visual guide overlay and the tile engine. The container
  shrink-wraps the grid (`max-content`) and centers itself, so the grid keeps
  its centered placement while the absolutely-positioned guide — pinned to this
  container's top-left — lands on the exact same origin as the grid. This is
  what keeps guide slots and real tiles from diverging horizontally.
*/
.grid-canvas-container {
  position: relative;
  width: max-content;
  max-width: 100%;
  margin-inline: auto;
}

.empty-grid-message {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--bg-contrast-color-low, var(--color-content-low));
  margin: 0;
  pointer-events: none;
}

.suggestion-grid-tile {
  background: rgba(255, 255, 255, 0.02) !important;
  border: 2px dashed rgba(255, 255, 255, 0.3) !important;
  box-shadow: none !important;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 255, 255, 0.5) !important;
    transform: translateY(-2px);
  }
}

.suggestion-tile-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
}

.suggestion-icon {
  font-size: 2.5rem;
  opacity: 0.7;
  transition: all 0.3s ease;
}

.suggestion-grid-tile:hover .suggestion-icon {
  opacity: 1;
  transform: scale(1.1);
}

.suggestion-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-color);
  opacity: 0.6;
  transition: opacity 0.3s ease;
}

.suggestion-grid-tile:hover .suggestion-label {
  opacity: 0.9;
}
</style>
