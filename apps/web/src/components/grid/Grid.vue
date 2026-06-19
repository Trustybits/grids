<!-- eslint-disable vue/multi-word-component-names, vue/no-unused-components -->
<template>
  <p v-if="gridStore.isLoading">Loading layout...</p>
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
      :vertical-compact="gridStore.verticalCompact"
      :prevent-collision="false"
      :restore-on-drag="true"
      :use-css-transforms="true"
      :margin="[margin, margin]"
      :style="gridInnerStyle"
    >
      <GridTile v-for="tile in displayLayout" :key="tile.i" :tile="tile" />
    </GridLayout>
  </div>
  <p v-else class="empty-grid-message">No tiles yet</p>
</template>

<script lang="ts">
import { computed, ref, watch } from "vue";
import { GridLayout, GridItem } from "vue3-grid-layout";
// import VueGridLayout from "vue-grid-layout-v3";
import GridTile from "./Tile.vue";
import { useResponsiveGridLayout } from "@/composables/useResponsiveGridLayout";
import { useGridStore } from "@/stores/grid";
import { type Tile } from "@grids/contracts/types";

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
    const gridStore = useGridStore();
    const margin = 48;

    const baseColNum = computed(() => {
      return gridStore.currentGrid?.colNum ?? 12;
    });

    const hasOverlap = (
      placed: Tile[],
      x: number,
      y: number,
      w: number,
      h: number,
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
      startY = 0,
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
        // Scale down tiles that are too wide for the grid
        const scaledTile =
          tile.w > columns ? scaleTileToFit(tile, columns) : tile;

        const withinBounds =
          scaledTile.x >= 0 && scaledTile.x + scaledTile.w <= columns;
        const canKeep =
          withinBounds &&
          !hasOverlap(
            placed,
            scaledTile.x,
            scaledTile.y,
            scaledTile.w,
            scaledTile.h,
          );

        if (canKeep) {
          placed.push({ ...scaledTile });
          return;
        }

        const startY = withinBounds ? scaledTile.y : 0;
        const spot = findFirstAvailableSpot(
          placed,
          scaledTile.w,
          scaledTile.h,
          columns,
          startY,
        );
        placed.push({ ...scaledTile, x: spot.x, y: spot.y });
      });

      const placedById = new Map(placed.map((tile) => [tile.i, tile]));
      return tiles.map((tile) => placedById.get(tile.i) ?? tile);
    };

    const {
      activeBreakpoint,
      gridInnerStyle,
      gridLayoutRef,
      gridWidth,
      responsiveColumnCount: responsiveColNum,
      scaleWrapperRef,
      scaleWrapperStyle,
    } = useResponsiveGridLayout({
      baseColumnCount: baseColNum,
      forcedBreakpoint: () => gridStore.forcedBreakpoint,
      tiles: () => gridStore.currentGrid?.tiles ?? [],
      overrides: () => gridStore.currentGrid?.overrides,
      rowHeight: () => props.rowHeight,
      margin,
      disableAutoScale: () => props.disableAutoScale,
      onBreakpointsChanged: (active, viewport) => {
        gridStore.setActiveBreakpoint(active);
        gridStore.setViewportBreakpoint(viewport);
      },
    });

    // Stable ref that vue3-grid-layout can mutate in-place.
    // At lg we hand it the store's own reactive array (mutations persist naturally).
    // At smaller breakpoints we build a one-time array and only rebuild when the
    // underlying data (tile list, breakpoint, or overrides) actually changes.
    const displayLayout = ref<Tile[]>([]);

    const buildBreakpointLayout = (): Tile[] => {
      const tiles = gridStore.currentGrid?.tiles ?? [];
      const bp = activeBreakpoint.value;
      const cols = responsiveColNum.value;

      if (bp === "lg") {
        // Validate that all tiles fit within bounds and don't have invalid positions
        const needsRepacking = tiles.some(
          (tile) => tile.w > cols || tile.x < 0 || tile.x + tile.w > cols,
        );

        if (needsRepacking) {
          // Repack tiles to fix any out-of-bounds issues
          return packTiles(tiles, cols);
        }

        return [...tiles];
      }

      const overrides = gridStore.getBreakpointPositions(bp);
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
          const spot = findFirstAvailableSpot(
            finalLayout,
            tile.w,
            tile.h,
            cols,
          );
          finalLayout.push({ ...tile, x: spot.x, y: spot.y });
        }

        return finalLayout;
      }

      // No saved overrides — auto-repack (current behavior)
      const resizedTiles = tiles.map((tile) => scaleTileToFit(tile, cols));

      return packTiles(resizedTiles, cols);
    };

    // Rebuild when breakpoint, tile count, or overrides change.
    // Using a deep-ish watch key so we don't rebuild on every in-place mutation.
    // Note: verticalCompact is NOT watched here - gravity changes are handled separately
    watch(
      [
        activeBreakpoint,
        () => gridStore.undoRedoVersion,
        () => gridStore.currentGrid?.tiles?.length,
        () => gridStore.currentGrid?.tiles?.map((t) => t.i).join(","),
        () =>
          gridStore.currentGrid?.tiles
            ?.map((t) => `${t.i}:${t.w}x${t.h}`)
            .join(","),
        () =>
          gridStore.currentGrid?.tiles
            ?.map((t) => `${t.i}:${t.borderEnabled !== false}`)
            .join(","),
        () => JSON.stringify(gridStore.currentGrid?.overrides),
        () =>
          gridStore.currentGrid?.tiles
            ?.map((t) => {
              const c = t.content as Record<string, unknown>;
              const thumbs = c.thumbnails as Record<string, Record<string, unknown>> | undefined;
              return `${t.i}:${c.trackName ?? ""}:${c.albumArt ?? ""}:${c.title ?? ""}:${thumbs?.default?.url ?? ""}`;
            })
            .join("|"),
      ],
      () => {
        if (gridStore.skipOverrideRebuild) {
          gridStore.skipOverrideRebuild = false;
          return;
        }
        displayLayout.value = buildBreakpointLayout();
      },
      { immediate: true },
    );

    // At non-lg breakpoints, buildBreakpointLayout returns copied tile objects.
    // When setTileContent mutates a store tile, the copy in displayLayout is stale.
    // This watcher detects content-type changes on store tiles and syncs the
    // corresponding displayLayout copy in-place so GridTile sees the update
    // without a full remount of all tiles.
    watch(
      () =>
        gridStore.currentGrid?.tiles?.map((t) => t.content.type).join(","),
      () => {
        const storeTiles = gridStore.currentGrid?.tiles;
        if (!storeTiles) return;
        for (const storeTile of storeTiles) {
          const displayTile = displayLayout.value.find(
            (t) => t.i === storeTile.i,
          );
          if (displayTile && displayTile.content !== storeTile.content) {
            displayTile.content = storeTile.content;
            displayTile.w = storeTile.w;
            displayTile.h = storeTile.h;
            displayTile.x = storeTile.x;
            displayTile.y = storeTile.y;
          }
        }
      },
    );

    // Sync async-fetched content fields and tile colors to displayLayout copies at non-lg breakpoints.
    // Examples: music trackName/albumArt, YouTube title/thumbnails,
    // link metaTitle/metaDescription/metaImageUrl, and backgroundColor.
    // patchTileContent replaces these fields without changing content.type, so the type watcher
    // above doesn't catch them.
    watch(
      () =>
        gridStore.currentGrid?.tiles
          ?.map((t) => {
            const c = t.content as Record<string, unknown>;
            const thumbs = c.thumbnails as Record<string, Record<string, unknown>> | undefined;
            return `${t.i}:${c.backgroundColor ?? ""}:${c.trackName ?? ""}:${c.albumArt ?? ""}:${c.title ?? ""}:${thumbs?.default?.url ?? ""}:${c.metaTitle ?? ""}:${c.metaDescription ?? ""}:${c.metaImageUrl ?? ""}:${c.metaSiteName ?? ""}:${c.faviconUrl ?? ""}:${c.domain ?? ""}`;
          })
          .join("|"),
      () => {
        const storeTiles = gridStore.currentGrid?.tiles;
        if (!storeTiles) return;
        for (const storeTile of storeTiles) {
          const displayTile = displayLayout.value.find(
            (t) => t.i === storeTile.i,
          );
          if (displayTile && displayTile.content !== storeTile.content) {
            displayTile.content = storeTile.content;
          }
        }
      },
    );

    // Publish rendered tile positions so GridMenu and updateBreakpointOverride
    // can snapshot them. Deep watch is needed because vue3-grid-layout mutates
    // tile x/y/w/h in-place during drag/resize.
    watch(
      displayLayout,
      (tiles) => {
        gridStore.setDisplayPositions(
          tiles.map((t) => ({ i: t.i, x: t.x, y: t.y, w: t.w, h: t.h })),
        );
      },
      { immediate: true, deep: true },
    );

    // Delegates to gridStore.canEdit — the single source of truth for
    // whether grid manipulation (drag/resize) is allowed right now.
    const isEditable = computed(() => gridStore.canEdit);

    // When gravity is toggled on, compact tiles and save positions to store
    watch(
      () => gridStore.verticalCompact,
      (isCompact, wasCompact) => {
        if (!gridStore.currentGrid || !gridStore.canEdit) return;
        if (activeBreakpoint.value !== "lg") return;

        // Only act when gravity is turned ON (false -> true)
        if (isCompact && !wasCompact) {
          const tiles = gridStore.currentGrid.tiles;
          const compacted = packTiles([...tiles], responsiveColNum.value);

          // Update each tile's position in the store's tiles array
          compacted.forEach((compactedTile) => {
            const storeTile = tiles.find((t) => t.i === compactedTile.i);
            if (storeTile) {
              storeTile.x = compactedTile.x;
              storeTile.y = compactedTile.y;
            }
          });

          // Force displayLayout to update by creating a new array reference
          // This triggers the animation while maintaining the store connection
          displayLayout.value = [...tiles];

          // Save to database
          gridStore.updateGrid();
        }
      },
    );

    return {
      gridStore,
      gridWidth,
      margin,
      displayLayout,
      responsiveColNum,
      activeBreakpoint,
      isEditable,
      scaleWrapperStyle,
      gridInnerStyle,
      gridLayoutRef,
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
