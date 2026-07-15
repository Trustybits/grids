<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <p v-if="gridView.isLoading">Loading layout...</p>
  <div
    v-else-if="projectedLayout.length"
    ref="scaleWrapperRef"
    class="grid-scale-wrapper"
    :style="scaleWrapperStyle"
    @pointerdown.capture="onGridPointerDown"
  >
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
} from "vue";
import { GriddleGrid, useGriddle } from "@griddle/vue";
import {
  gridContentSize,
  type Tile as GriddleTile,
} from "@griddle/core";
import GridTile from "./Tile.vue";
import { useResponsiveGridLayout } from "@/composables/useResponsiveGridLayout";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import {
  buildGridConfig,
  fromGriddleTile,
  fromGriddleTiles,
  toGriddleTiles,
} from "@/utils/GriddleAdapter";
import {
  TILE_DRAGGING_ID,
  TILE_GEOMETRY_VERSION,
  TILE_RESIZE_REQUEST,
} from "@/grid-context/tileInteractionKeys";

export default {
  components: {
    GriddleGrid,
    GridTile,
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
      projectedLayout,
      gridInnerStyle,
      gridLayoutRef,
      gridWidth,
      responsiveColumnCount: responsiveColNum,
      scaleWrapperRef,
      scaleWrapperStyle,
      waitForLayoutReady,
      markLayoutReady,
    } = useResponsiveGridLayout({
      baseColumnCount: baseColNum,
      forcedBreakpoint: () => gridView.forcedBreakpoint,
      tiles: () => gridView.grid?.tiles ?? [],
      overrides: () => gridView.grid?.overrides,
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

    // --- Griddle engine ----------------------------------------------------
    // Griddle owns tile state; we feed it the projected responsive layout and
    // read committed positions back on drag/resize end. `contractTiles` maps a
    // Griddle tile id back to our `Tile` for the #tile slot.
    const contractTiles = computed(() => gridView.grid?.tiles ?? []);
    const tilesById = computed(
      () => new Map(contractTiles.value.map((tile) => [tile.i, tile])),
    );

    const griddleTiles = computed(() =>
      toGriddleTiles(projectedLayout.value, contractTiles.value, {
        editable: gridView.canEdit,
      }),
    );

    const gridConfig = computed(() =>
      buildGridConfig({
        cols: responsiveColNum.value,
        rowHeight: props.rowHeight,
        margin,
        verticalCompact: gridView.verticalCompact,
        // grids.so owns page scroll + outer transform:scale(); the grid must
        // size to content and not lock touch-action. And we never handle
        // draw-to-create, so gate it off.
        scroll: "none",
        drawToCreate: false,
      }),
    );

    const api = useGriddle({
      config: gridConfig.value,
      tiles: griddleTiles.value,
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

    // Publish live tile positions so GridMenu and updateBreakpointOverride can
    // snapshot them. Replaces the old deep-watch on the mutable layout array.
    watch(api.version, () => {
      gridView.setDisplayPositions(fromGriddleTiles(api.tiles.value));
    });

    // Load the projected layout + config into the engine whenever they change
    // (breakpoint switch, tile add/remove, edit-gate change, compaction
    // toggle, or reconciliation after a committed gesture). Guarded so a
    // reactive reload can never fight a live drag/resize.
    let interacting = false;
    const syncEngine = async (): Promise<void> => {
      api.loadJSON({
        version: 1,
        config: gridConfig.value,
        tiles: griddleTiles.value,
      });
      // loadJSON/updateConfig don't apply gravity; compact explicitly so a
      // gravity:'top' layout settles immediately.
      if (gridView.verticalCompact) api.grid.compactAll();
      await nextTick();
      markLayoutReady();
    };

    watch([griddleTiles, gridConfig], () => {
      if (interacting) return;
      void syncEngine();
    });

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

    const onDragStart = (id: string): void => {
      interacting = true;
      draggingTileId.value = id;
      if (gridView.canEdit) gridView.beginMove();
    };

    const onDragEnd = (_id: string, committed: boolean): void => {
      interacting = false;
      draggingTileId.value = null;
      if (committed && gridView.canEdit) {
        gridView.setDisplayPositions(fromGriddleTiles(api.tiles.value));
        gridView.commitMove();
      }
    };

    const onResizeStart = (_id: string): void => {
      interacting = true;
      if (gridView.canEdit) gridView.beginResize();
    };

    const onResizeEnd = (_id: string, committed: boolean): void => {
      interacting = false;
      if (committed && gridView.canEdit) {
        gridView.setDisplayPositions(fromGriddleTiles(api.tiles.value));
        gridView.commitResize();
      }
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
      projectedLayout,
      tilesById,
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
      resizeTileThroughEngine,
    };
  },
};
</script>

<style scoped>
.grid-scale-wrapper {
  overflow: hidden;
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
