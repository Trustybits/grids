<!-- eslint-disable vue/multi-word-component-names, vue/no-unused-components -->
<template>
  <p v-if="gridView.isLoading">Loading layout...</p>
  <div
    v-else-if="displayLayout.length"
    ref="scaleWrapperRef"
    class="grid-scale-wrapper"
    :style="scaleWrapperStyle"
  >
    <GridLayout
      ref="gridLayoutRef"
      class="grid-container"
      :layout="displayLayout"
      :col-num="responsiveColNum"
      :row-height="rowHeight"
      :is-draggable="isEditable"
      :is-resizable="isEditable"
      :vertical-compact="gridView.verticalCompact"
      :prevent-collision="false"
      :restore-on-drag="true"
      :use-css-transforms="true"
      :margin="[margin, margin]"
      :style="gridInnerStyle"
      @layout-ready="reportRenderedLayout"
      @layout-updated="reportRenderedLayout"
    >
      <GridTile
        v-for="entry in renderedTiles"
        :key="entry.tile.i"
        :tile="entry.tile"
        :layout="entry.layout"
      />
    </GridLayout>
  </div>
  <p v-else class="empty-grid-message">No tiles yet</p>
</template>

<script lang="ts">
import { proxyRefs, computed, nextTick, onUnmounted, watch } from "vue";
import { GridLayout, GridItem } from "vue3-grid-layout";
// import VueGridLayout from "vue-grid-layout-v3";
import GridTile from "./Tile.vue";
import { useResponsiveGridLayout } from "@/composables/useResponsiveGridLayout";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import {
  packGridLayout,
  reconcileGridLayout,
} from "@/utils/GridLayoutUtils";

export default {
  components: {
    GridLayout,
    GridItem, // eslint-disable-line vue/no-unused-components -- used internally by vue3-grid-layout
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
      renderedLayout: displayLayout,
      gridInnerStyle,
      gridLayoutRef,
      gridWidth,
      layoutRevision,
      reportRenderedLayout,
      responsiveColumnCount: responsiveColNum,
      scaleWrapperRef,
      scaleWrapperStyle,
      waitForLayoutReady,
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

    watch(
      layoutRevision,
      async () => {
        if (displayLayout.value.length > 0) return;
        await nextTick();
        reportRenderedLayout([]);
      },
      { immediate: true, flush: "post" },
    );

    const renderedTiles = computed(() => {
      const tilesById = new Map(
        (gridView.grid?.tiles ?? []).map((tile) => [tile.i, tile]),
      );
      return displayLayout.value.flatMap((layout) => {
        const tile = tilesById.get(layout.i);
        return tile ? [{ tile, layout }] : [];
      });
    });

    // Publish rendered tile positions so GridMenu and updateBreakpointOverride
    // can snapshot them. Deep watch is needed because vue3-grid-layout mutates
    // tile x/y/w/h in-place during drag/resize.
    watch(
      displayLayout,
      (tiles) => {
        gridView.setDisplayPositions(
          tiles.map((t) => ({ i: t.i, x: t.x, y: t.y, w: t.w, h: t.h })),
        );
      },
      { immediate: true, deep: true },
    );

    // Delegates to gridView.canEdit — the single source of truth for
    // whether grid manipulation (drag/resize) is allowed right now.
    const isEditable = computed(() => gridView.canEdit);

    // When gravity is toggled on, compact tiles and publish the positions
    // through the view context.
    watch(
      () => gridView.verticalCompact,
      (isCompact, wasCompact) => {
        if (!gridView.grid || !gridView.canEdit) return;
        if (activeBreakpoint.value !== "lg") return;

        // Only act when gravity is turned ON (false -> true)
        if (isCompact && !wasCompact) {
          const compacted = packGridLayout(
            displayLayout.value,
            responsiveColNum.value,
          );

          displayLayout.value = reconcileGridLayout(
            displayLayout.value,
            compacted,
          );

          // Commit the compacted positions into canonical tiles and persist.
          gridView.commitCompactedLayout(compacted);
        }
      },
    );

    return {
      gridView,
      gridWidth,
      margin,
      displayLayout,
      renderedTiles,
      responsiveColNum,
      activeBreakpoint,
      isEditable,
      scaleWrapperStyle,
      gridInnerStyle,
      gridLayoutRef,
      reportRenderedLayout,
      scaleWrapperRef,
    };
  },

  // mounted() {
  //   document.body.style.backgroundImage = 'url("https://images.pexels.com/photos/247599/pexels-photo-247599.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1")';
  //   document.body.style.backgroundRepeat = 'no-repeat';
  //   // document.body.style.backgroundColor = 'lightblue';
  //   // document.body.style.fontFamily = 'Arial';
  //   // Add more styles as needed
  // },
  // beforeUnmount() {
  //   // Reset styles when the component is destroyed (optional)
  //   // document.body.style.backgroundColor = '#ffffff00';
  //   document.body.style.backgroundImage = 'none';
  //   // document.body.style.backgroundColor = 'blue';
  //   // document.body.style.fontFamily = 'Inter';
  // }
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

.vue-grid-layout {
  background-color: #ffffff00;
  position: relative;
  left: auto;
  margin: 0 auto;
}

/* Visual styling handled by custom.scss globally */
/* Grid only handles animation behavior */
.vue-grid-item {
  /* Smooth snap-back animation when tile is released after dragging */
  &:not(.resizing):not(.vue-draggable-dragging) {
    transition:
      transform var(--duration-slow) var(--easing-spring),
      width var(--duration-slow) var(--easing-spring),
      height var(--duration-slow) var(--easing-spring) !important;
  }

  /* Dragging state handled in custom.scss with !important to override inline styles */
  &.vue-draggable-dragging {
    transition: none !important;
    z-index: var(--z-grid-dragging) !important;
    cursor: grabbing !important;
  }

  /* Disable transitions while resizing for immediate feedback */
  &.resizing {
    transition: none !important;
    opacity: 0.85 !important;
  }
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

<style>
/* Global styles for vue3-grid-layout placeholder - must be unscoped to work */
.vue-grid-placeholder {
  /* Remove all transitions and animations to prevent flickering */
  transition: none !important;
  animation: none !important;

  /* Visual styling */
  background: rgba(255, 255, 255, 0.15) !important;
  border-radius: var(--tile-border-radius) !important;

  /* Hidden by default — prevents the phantom circle on page load and
     the stale placeholder lingering at the wrong position after drop. */
  display: none !important;

  position: absolute !important;
  z-index: var(--z-grid-placeholder) !important;
  pointer-events: none !important;
}

/* Only show the placeholder while a tile is actively being dragged.
   :has(.vue-draggable-dragging) matches when any child grid-item is mid-drag. */
.vue-grid-layout:has(.vue-draggable-dragging) .vue-grid-placeholder {
  display: block !important;
  opacity: 0.3 !important;
}

/* Elevate the grid-item-container when its child grid-item is being dragged,
   so the dragged tile renders above all sibling tile containers.
   Without this, the z-index on .vue-draggable-dragging is trapped inside its
   parent container and can't rise above other tiles' containers. */
.grid-item-container:has(.vue-draggable-dragging) {
  z-index: var(--z-grid-dragging) !important;
}

/* Allow native vertical scroll when touch starts on a grid item.
   vue3-grid-layout sets touch-action: none on items, which blocks scroll.
   Restoring pan-y lets the browser handle vertical swipe-to-scroll normally.
   When a tile is actively being dragged we override back to none so drag works. */
.vue-grid-item:not(.vue-draggable-dragging) {
  touch-action: pan-y !important;
}
</style>
