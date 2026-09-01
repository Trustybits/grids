<!-- eslint-disable vue/multi-word-component-names -->
<!--
  GridVisualGuide
  ----------------
  A non-interactive background "helpline" that draws stylized 1×1 placeholder
  slot boxes across the whole grid canvas, showing users where tiles land and
  snap when dragged or resized.

  Geometry mirrors the live Griddle engine exactly so the guide never drifts
  from real tile positions:

    step   = rowHeight + margin            (e.g. 75 + 48 = 123)
    slot   = rowHeight × rowHeight         (e.g. 75 × 75)
    left   = col × step + margin           (Griddle's half-gap inset + the
    top    = row × step + margin            canvas's other half-gap padding)

  The guide is positioned as an absolute overlay pinned to the same top-left
  origin as the grid engine, inside the shared canvas container in Grid.vue, so
  centering and transform: scale() stay in lockstep with the tile layer.
-->
<template>
  <div
    class="grid-visual-guide"
    :class="{ 'is-interacting': isInteracting }"
    :style="rootStyle"
    aria-hidden="true"
  >
    <div
      v-for="slot in slots"
      :key="slot.key"
      class="grid-visual-guide__slot"
      :style="slot.style"
    />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from "vue";
import type { GridLayoutItem } from "@/types/GridLayout";

export default defineComponent({
  name: "GridVisualGuide",
  props: {
    cols: {
      type: Number,
      required: true,
    },
    rowHeight: {
      type: Number,
      default: 75,
    },
    margin: {
      type: Number,
      default: 48,
    },
    // Current tile placements, used only to size the guide's row extent so it
    // always spans at least the occupied canvas plus a little landing room.
    tiles: {
      type: Array as PropType<readonly GridLayoutItem[]>,
      default: () => [],
    },
    // Extra empty rows drawn below the tallest tile so there's always a visible
    // drop target beneath the current content.
    extraRows: {
      type: Number,
      default: 2,
    },
    // Fewest rows to draw when the canvas is empty or very short.
    minRows: {
      type: Number,
      default: 4,
    },
    // Brightened while a drag/resize gesture is in progress.
    isInteracting: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const step = computed(() => props.rowHeight + props.margin);

    const rowCount = computed(() => {
      const occupiedBottom = props.tiles.reduce(
        (max, tile) => Math.max(max, tile.y + tile.h),
        0,
      );
      return Math.max(props.minRows, occupiedBottom + props.extraRows);
    });

    const rootStyle = computed(() => ({
      width: `${props.cols * step.value + props.margin}px`,
      height: `${rowCount.value * step.value + props.margin}px`,
    }));

    const slots = computed(() => {
      const list: { key: string; style: Record<string, string> }[] = [];
      for (let row = 0; row < rowCount.value; row++) {
        for (let col = 0; col < props.cols; col++) {
          list.push({
            key: `${row}-${col}`,
            style: {
              left: `${col * step.value + props.margin}px`,
              top: `${row * step.value + props.margin}px`,
              width: `${props.rowHeight}px`,
              height: `${props.rowHeight}px`,
            },
          });
        }
      }
      return list;
    });

    return { slots, rootStyle };
  },
});
</script>

<style scoped>
.grid-visual-guide {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.85;
  transition: opacity var(--duration-fast, 150ms) var(--easing-ease-out, ease);
}

.grid-visual-guide.is-interacting {
  opacity: 1;
}

/*
  The guide is drawn against whatever page background is set, so it keys off the
  background-adaptive contrast color (light guide on dark pages, dark guide on
  light ones). Border-radius matches real tiles so empty slots read as landing
  zones for the tiles that will occupy them.
*/
.grid-visual-guide__slot {
  --guide-ink: var(--bg-contrast-color-low, var(--color-content-low, #808080));
  position: absolute;
  box-sizing: border-box;
  border-radius: var(--tile-border-radius, 16px);
  background: color-mix(in srgb, var(--guide-ink) 16%, transparent);
  transition: background-color var(--duration-fast, 150ms)
    var(--easing-ease-out, ease);
}

.grid-visual-guide.is-interacting .grid-visual-guide__slot {
  background: color-mix(in srgb, var(--guide-ink) 28%, transparent);
}
</style>
