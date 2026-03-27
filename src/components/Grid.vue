<template>
  <p v-if="layoutStore.isLoading">Loading layout...</p>
  <div
    v-else-if="displayLayout.length"
    ref="scaleWrapperRef"
    class="grid-scale-wrapper"
    :style="scaleWrapperStyle"
  >
    <grid-layout
      ref="gridLayoutRef"
      class="grid-container"
      :layout="displayLayout"
      :col-num="responsiveColNum"
      :row-height="rowHeight"
      :is-draggable="isEditable"
      :is-resizable="isEditable"
      :vertical-compact="layoutStore.verticalCompact"
      :prevent-collision="false"
      :restore-on-drag="true"
      :use-css-transforms="true"
      :margin="[margin, margin]"
      :style="gridInnerStyle"
    >
      <grid-tile v-for="tile in displayLayout" :key="tile.i" :tile="tile" />
    </grid-layout>
  </div>
  <p v-else>No tiles yet.</p>
</template>

<script lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from "vue";
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
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const route = useRoute(); // Access route parameters
    const margin = 48;
    const viewportWidth = ref(
      typeof window !== "undefined" ? window.innerWidth : 0,
    );

    const onResize = () => {
      viewportWidth.value = window.innerWidth;
    };

    const baseColNum = computed(() => {
      return layoutStore.currentLayout?.colNum ?? 12;
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

    // Map breakpoint names to their column counts
    const breakpointToColNum = (bp: Breakpoint): number => {
      if (bp === "sm") return Math.min(4, baseColNum.value);
      if (bp === "md") return Math.min(8, baseColNum.value);
      return Math.min(12, baseColNum.value);
    };

    // Viewport-derived column count (used when no forced breakpoint is active)
    const viewportColNum = computed(() => {
      const candidates = [12, 8, 4].filter(
        (columns) => columns <= baseColNum.value,
      );
      const fits = (columns: number) => {
        return (
          columns * props.rowHeight + (columns + 1) * margin <=
          viewportWidth.value
        );
      };

      return candidates.find(fits) ?? Math.min(4, baseColNum.value);
    });

    // When forcedBreakpoint is set by the owner, use its column count;
    // otherwise fall back to the viewport-derived value.
    const responsiveColNum = computed(() => {
      const forced = layoutStore.forcedBreakpoint;
      if (forced) return breakpointToColNum(forced);
      return viewportColNum.value;
    });

    const colNumToBreakpoint = (cols: number): Breakpoint => {
      if (cols <= 4) return "sm";
      if (cols <= 8) return "md";
      return "lg";
    };

    // The breakpoint the viewport naturally supports (ignoring any forced override).
    // Used to determine whether a forced breakpoint requires scaling / view-only mode.
    const viewportBreakpoint = computed<Breakpoint>(() => {
      return colNumToBreakpoint(viewportColNum.value);
    });

    const activeBreakpoint = computed<Breakpoint>(() => {
      // Forced breakpoint takes priority over viewport detection
      if (layoutStore.forcedBreakpoint) return layoutStore.forcedBreakpoint;
      return viewportBreakpoint.value;
    });

    // Keep the store in sync so other components can read both breakpoints
    watch(
      [activeBreakpoint, viewportBreakpoint],
      ([active, viewport]) => {
        layoutStore.setActiveBreakpoint(active);
        layoutStore.setViewportBreakpoint(viewport);
      },
      { immediate: true },
    );

    // Stable ref that vue3-grid-layout can mutate in-place.
    // At lg we hand it the store's own reactive array (mutations persist naturally).
    // At smaller breakpoints we build a one-time array and only rebuild when the
    // underlying data (tile list, breakpoint, or overrides) actually changes.
    const displayLayout = ref<Tile[]>([]);

    const buildBreakpointLayout = (): Tile[] => {
      const tiles = layoutStore.currentLayout?.tiles ?? [];
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
        () => layoutStore.currentLayout?.tiles?.length,
        () => layoutStore.currentLayout?.tiles?.map((t) => t.i).join(","),
        () =>
          layoutStore.currentLayout?.tiles
            ?.map((t) => `${t.i}:${t.w}x${t.h}`)
            .join(","),
        () =>
          layoutStore.currentLayout?.tiles
            ?.map((t) => `${t.i}:${t.borderEnabled !== false}`)
            .join(","),
        () => JSON.stringify(layoutStore.currentLayout?.overrides),
        () =>
          layoutStore.currentLayout?.tiles
            ?.map((t) => {
              const c = t.content as any;
              return `${t.i}:${c.trackName ?? ""}:${c.albumArt ?? ""}:${c.title ?? ""}:${c.thumbnails?.default?.url ?? ""}`;
            })
            .join("|"),
      ],
      () => {
        if (layoutStore.skipOverrideRebuild) {
          layoutStore.skipOverrideRebuild = false;
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
        layoutStore.currentLayout?.tiles?.map((t) => t.content.type).join(","),
      () => {
        const storeTiles = layoutStore.currentLayout?.tiles;
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

    // Sync async-fetched content fields (e.g. music trackName/albumArt, YouTube title/thumbnails,
    // link metaTitle/metaDescription/metaImageUrl) to displayLayout copies at non-lg breakpoints.
    // patchTileContent replaces these fields without changing content.type, so the type watcher
    // above doesn't catch them.
    watch(
      () =>
        layoutStore.currentLayout?.tiles
          ?.map((t) => {
            const c = t.content as any;
            return `${t.i}:${c.trackName ?? ""}:${c.albumArt ?? ""}:${c.title ?? ""}:${c.thumbnails?.default?.url ?? ""}:${c.metaTitle ?? ""}:${c.metaDescription ?? ""}:${c.metaImageUrl ?? ""}:${c.metaSiteName ?? ""}:${c.faviconUrl ?? ""}:${c.domain ?? ""}`;
          })
          .join("|"),
      () => {
        const storeTiles = layoutStore.currentLayout?.tiles;
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
        layoutStore.setDisplayPositions(
          tiles.map((t) => ({ i: t.i, x: t.x, y: t.y, w: t.w, h: t.h })),
        );
      },
      { immediate: true, deep: true },
    );

    // Delegates to layoutStore.canEdit — the single source of truth for
    // whether grid manipulation (drag/resize) is allowed right now.
    const isEditable = computed(() => layoutStore.canEdit);

    const gridWidth = computed(() => {
      return (
        responsiveColNum.value * props.rowHeight +
        (responsiveColNum.value + 1) * margin
      );
    });

    const mobileScale = computed(() => {
      if (viewportWidth.value >= gridWidth.value) return 1;
      return viewportWidth.value / gridWidth.value;
    });

    // grid-layout is a Vue component, so its ref may be a component instance (with $el)
    // rather than a plain HTMLElement. We use a loose type to accommodate both cases.
    const gridLayoutRef = ref<{ $el: HTMLElement } | HTMLElement | null>(null);
    const scaleWrapperRef = ref<HTMLElement | null>(null);
    const naturalGridHeight = ref(0);

    let resizeObserver: ResizeObserver | null = null;

    const observeGridHeight = () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      // If the ref is a Vue component instance, access its root DOM element via $el;
      // otherwise it's already a plain HTMLElement (e.g. in test environments).
      const raw = gridLayoutRef.value;
      const el = raw && "$el" in raw ? raw.$el : raw;
      if (!el) return;
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          naturalGridHeight.value = entry.contentRect.height;
        }
      });
      resizeObserver.observe(el);
      naturalGridHeight.value = el.getBoundingClientRect().height;
    };

    const scaleWrapperStyle = computed(() => {
      const scale = mobileScale.value;
      if (scale >= 1) return {};
      const scaledHeight =
        naturalGridHeight.value > 0
          ? naturalGridHeight.value * scale
          : undefined;
      return {
        width: `${viewportWidth.value}px`,
        overflow: "hidden",
        ...(scaledHeight !== undefined ? { height: `${scaledHeight}px` } : {}),
      };
    });

    const gridInnerStyle = computed(() => {
      const scale = mobileScale.value;
      const base = { width: `${gridWidth.value}px` };
      if (scale >= 1) return base;
      return {
        ...base,
        transformOrigin: "top left",
        transform: `scale(${scale})`,
      };
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
      nextTick(() => observeGridHeight());
    });

    watch(displayLayout, () => {
      nextTick(() => observeGridHeight());
    });

    // When gravity is toggled on, compact tiles and save positions to store
    watch(
      () => layoutStore.verticalCompact,
      (isCompact, wasCompact) => {
        if (!layoutStore.currentLayout || !layoutStore.canEdit) return;
        if (activeBreakpoint.value !== "lg") return;

        // Only act when gravity is turned ON (false -> true)
        if (isCompact && !wasCompact) {
          const tiles = layoutStore.currentLayout.tiles;
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
          layoutStore.updateLayout();
        }
      },
    );

    onUnmounted(() => {
      window.removeEventListener("resize", onResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    });

    return {
      layoutStore,
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
  z-index: -1 !important;
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
