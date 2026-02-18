<template>
  <p v-if="layoutStore.isLoading">Loading layout...</p>
  <grid-layout
    v-else-if="displayLayout.length"
    class="grid-container"
    :layout="displayLayout"
    :col-num="responsiveColNum"
    :row-height="effectiveRowHeight"
    :is-draggable="isEditable"
    :is-resizable="isEditable"
    :vertical-compact="layoutStore.verticalCompact"
    :prevent-collision="false"
    :restore-on-drag="true"
    :use-css-transforms="true"
    :margin="[margin, margin]"
    :style="{ width: `${gridWidth}px` }"
  >
    <grid-tile v-for="tile in displayLayout" :key="tile.i" :tile="tile" />
  </grid-layout>
  <p v-else>No tiles yet.</p>
</template>

<script lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { GridLayout, GridItem } from "vue3-grid-layout";
// import VueGridLayout from "vue-grid-layout-v3";
import GridTile from "./GridTile.vue";
import { useLayoutStore } from "@/stores/layout";
import { type Tile, type Breakpoint } from "@/types/Tile";

export default {
  components: {
    GridLayout,
    GridItem,
    GridTile,
  },
  props: {
    rowHeight: {
      type: Number,
      default: 75,
    },
    containerWidth: {
      type: Number,
      default: 0,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const route = useRoute(); // Access route parameters
    const viewportWidth = ref(
      typeof window !== "undefined" ? window.innerWidth : 0
    );

    const onResize = () => {
      viewportWidth.value = window.innerWidth;
    };

    // Margin between tiles. Tightened in preview frames.
    // Mobile (sm, 4-col) → 24px, Tablet (md, 8-col) → 32px, Desktop → 48px
    const margin = computed(() => {
      if (props.containerWidth <= 0) return 48;
      const mode = layoutStore.previewMode;
      if (mode === 'mobile') return 16;
      if (mode === 'tablet') return 32;
      return 48;
    });

    // Effective width used for layout calculations.
    // When containerWidth is provided (e.g. phone preview), use that instead.
    const effectiveWidth = computed(() =>
      props.containerWidth > 0 ? props.containerWidth : viewportWidth.value
    );

    const baseColNum = computed(() => {
      return layoutStore.currentLayout?.colNum ?? 12;
    });

    const hasOverlap = (
      placed: Tile[],
      x: number,
      y: number,
      w: number,
      h: number
    ) => {
      return placed.some((tile) => {
        return !(
          x + w <= tile.x ||
          x >= tile.x + tile.w ||
          y + h <= tile.y ||
          y >= tile.y + tile.h
        );
      });
    };

    const findFirstAvailableSpot = (
      placed: Tile[],
      width: number,
      height: number,
      columns: number,
      startY = 0
    ) => {
      let y = Math.max(0, startY);
      while (true) {
        for (let x = 0; x <= columns - width; x += 1) {
          if (!hasOverlap(placed, x, y, width, height)) {
            return { x, y };
          }
        }
        y += 1;
      }
    };

    const scaleTileToFit = (tile: Tile, columns: number) => {
      if (tile.w <= columns) {
        return { ...tile };
      }

      const scale = columns / tile.w;
      return {
        ...tile,
        w: columns,
        h: Math.max(1, Math.round(tile.h * scale)),
      };
    };

    const packTiles = (tiles: Tile[], columns: number) => {
      const ordered = [...tiles].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        if (a.x !== b.x) return a.x - b.x;
        return String(a.i).localeCompare(String(b.i));
      });
      const placed: Tile[] = [];

      ordered.forEach((tile) => {
        const withinBounds = tile.x >= 0 && tile.x + tile.w <= columns;
        const canKeep =
          withinBounds &&
          !hasOverlap(placed, tile.x, tile.y, tile.w, tile.h);

        if (canKeep) {
          placed.push({ ...tile });
          return;
        }

        const startY = withinBounds ? tile.y : tile.y + 1;
        const spot = findFirstAvailableSpot(
          placed,
          tile.w,
          tile.h,
          columns,
          startY
        );
        placed.push({ ...tile, x: spot.x, y: spot.y });
      });

      const placedById = new Map(placed.map((tile) => [tile.i, tile]));
      return tiles.map((tile) => placedById.get(tile.i) ?? tile);
    };

    const naturalColNum = computed(() => {
      const w = effectiveWidth.value;
      // Explicit pixel thresholds:
      //   ≥ 1280px → 12-col (desktop, tiles at native size)
      //   800–1279px → 8-col (tablet, tiles scale to fit)
      //   < 800px  → 4-col (mobile, tiles scale to fit)
      if (baseColNum.value >= 12 && w >= 1560) return 12;
      if (baseColNum.value >= 8  && w >= 800)  return Math.min(8, baseColNum.value);
      return Math.min(4, baseColNum.value);
    });

    // When previewMode is set by the toolbar toggle, override the natural column count.
    const responsiveColNum = computed(() => {
      const mode = layoutStore.previewMode;
      if (mode === 'mobile') return Math.min(4, baseColNum.value);
      if (mode === 'tablet') return Math.min(8, baseColNum.value);
      return naturalColNum.value;
    });

    const colNumToBreakpoint = (cols: number): Breakpoint => {
      if (cols <= 4) return 'sm';
      if (cols <= 8) return 'md';
      return 'lg';
    };

    const activeBreakpoint = computed<Breakpoint>(() => {
      return colNumToBreakpoint(responsiveColNum.value);
    });

    // Keep the store in sync so other components can read the active breakpoint
    watch(activeBreakpoint, (bp) => {
      layoutStore.setActiveBreakpoint(bp);
    }, { immediate: true });

    // Stable ref that vue3-grid-layout can mutate in-place.
    // At lg we hand it the store's own reactive array (mutations persist naturally).
    // At smaller breakpoints we build a one-time array and only rebuild when the
    // underlying data (tile list, breakpoint, or overrides) actually changes.
    const displayLayout = ref<Tile[]>([]);

    const buildBreakpointLayout = (): Tile[] => {
      const tiles = layoutStore.currentLayout?.tiles ?? [];
      const bp = activeBreakpoint.value;
      const cols = responsiveColNum.value;

      if (bp === 'lg') {
        return tiles;
      }

      const overrides = layoutStore.getBreakpointPositions(bp);
      if (overrides && Object.keys(overrides).length > 0) {
        const customized: Tile[] = [];
        const unplaced: Tile[] = [];

        for (const tile of tiles) {
          const pos = overrides[tile.i];
          if (pos) {
            customized.push({ ...tile, ...pos });
          } else {
            unplaced.push(scaleTileToFit(tile, cols));
          }
        }

        const finalLayout = [...customized];
        for (const tile of unplaced) {
          const spot = findFirstAvailableSpot(finalLayout, tile.w, tile.h, cols);
          finalLayout.push({ ...tile, x: spot.x, y: spot.y });
        }

        return finalLayout;
      }

      // No saved overrides — auto-repack (current behavior)
      const resizedTiles = tiles.map((tile) =>
        scaleTileToFit(tile, cols)
      );

      return packTiles(resizedTiles, cols);
    };

    // Rebuild when breakpoint, tile count, or overrides change.
    // Using a deep-ish watch key so we don't rebuild on every in-place mutation.
    watch(
      [
        activeBreakpoint,
        () => layoutStore.currentLayout?.tiles?.length,
        () => layoutStore.currentLayout?.tiles?.map((t) => t.i).join(','),
        () => JSON.stringify(layoutStore.currentLayout?.overrides),
      ],
      () => {
        if (layoutStore.skipOverrideRebuild) {
          layoutStore.skipOverrideRebuild = false;
          return;
        }
        displayLayout.value = buildBreakpointLayout();
      },
      { immediate: true }
    );

    // Publish rendered tile positions so GridMenu and updateBreakpointOverride
    // can snapshot them. Deep watch is needed because vue3-grid-layout mutates
    // tile x/y/w/h in-place during drag/resize.
    watch(displayLayout, (tiles) => {
      layoutStore.setDisplayPositions(
        tiles.map((t) => ({ i: t.i, x: t.x, y: t.y, w: t.w, h: t.h }))
      );
    }, { immediate: true, deep: true });

    const isEditable = computed(() => {
      if (!layoutStore.isOwner) return false;
      // Owners can always edit — at non-lg breakpoints, dragging/resizing will
      // auto-create overrides via updateBreakpointOverride.
      return true;
    });

    // At mobile (4 cols) and tablet (8 cols) breakpoints, derive rowHeight from
    // the available pixel width so tiles scale uniformly in both dimensions
    // (square units), capped at the original rowHeight. Desktop is unchanged.
    const effectiveRowHeight = computed(() => {
      if (responsiveColNum.value <= 8) {
        const cols = responsiveColNum.value;
        const m = margin.value;
        const totalWidth = props.containerWidth > 0
          ? props.containerWidth
          : effectiveWidth.value;
        // cell width = (totalWidth - (cols+1)*margin) / cols
        const cellWidth = (totalWidth - (cols + 1) * m) / cols;
        return Math.max(1, Math.min(props.rowHeight, Math.round(cellWidth)));
      }
      return props.rowHeight;
    });

    const gridWidth = computed(() => {
      // In preview mode use the container width directly so vue3-grid-layout
      // fills it exactly.
      if (props.containerWidth > 0) return props.containerWidth;
      return responsiveColNum.value * effectiveRowHeight.value +
        (responsiveColNum.value + 1) * margin.value;
    });


    // Load layout using ID from the route
    onMounted(() => {
      onResize();
      window.addEventListener("resize", onResize);
      const layoutId = route.params.id;
      if (layoutId) {
        layoutStore.loadLayout(layoutId as string);
      } else {
        console.error("Layout ID is missing in the route.");
      }
    });

    onUnmounted(() => {
      window.removeEventListener("resize", onResize);
    });

    return {
      layoutStore,
      gridWidth,
      margin,
      displayLayout,
      responsiveColNum,
      activeBreakpoint,
      isEditable,
      effectiveRowHeight,
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
.vue-grid-layout {
  background-color: #ffffff00;
  position: relative;
  left: auto;
  transform: none;
  margin: 0 auto;
}

/* Visual styling handled by custom.scss globally */
/* Grid only handles animation behavior */
.vue-grid-item {
  /* Smooth snap-back animation when tile is released after dragging */
  &:not(.resizing):not(.vue-draggable-dragging) {
    transition: transform var(--duration-slow) var(--easing-spring),
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
  z-index: -1 !important;
  pointer-events: none !important;
}

/* Only show the placeholder while a tile is actively being dragged.
   :has(.vue-draggable-dragging) matches when any child grid-item is mid-drag. */
.vue-grid-layout:has(.vue-draggable-dragging) .vue-grid-placeholder {
  display: block !important;
  opacity: 0.3 !important;
}
</style>
