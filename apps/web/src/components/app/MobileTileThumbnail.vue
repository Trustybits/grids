<!--
  MobileTileThumbnail.vue

  The wireframe artwork on a coverflow card in the Add-a-Tile carousel (Figma
  "Tiles" 1605-7314): an abstract, low-contrast mock of what that tile type
  looks like once it is on the grid — heading/body bars for Text, message
  bubbles for Chat, crossing roads for Map, and so on.

  Deliberately artwork, not a live render: several types (Map, Embed) would need
  a Mapbox instance or a third-party iframe plus content that does not exist yet
  at carousel time, and mounting those in a surface the user is dragging would
  cost the 60fps swipe. Everything here is plain positioned elements.

  Figma lays each tile out in a 150x150 box, so the shape geometry below is kept
  in those coordinates and converted to percentages — the artwork then scales to
  whatever size the card is rendered at. Colors are `currentColor` at two
  opacities ("ink" levels, matching Figma's #222 / #333 on #0f0f0f) so the
  artwork follows the active theme instead of hard-coding greys.
-->
<template>
  <div class="mtt" aria-hidden="true">
    <span
      v-if="artwork.frame"
      class="mtt-frame"
      :style="frameStyle(artwork.frame)"
    />

    <span
      v-for="(shape, index) in artwork.shapes"
      :key="index"
      class="mtt-shape"
      :class="`mtt-shape--ink${shape.ink ?? 1}`"
      :style="shapeStyle(shape)"
    />

    <span v-if="artwork.glyph" class="mtt-glyph" :style="glyphStyle(artwork.glyph)">
      <component :is="icon" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";

/** A positioned block in Figma's 150x150 tile space. */
interface Shape {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 1 = subtle (Figma #222), 2 = stronger (Figma #333). */
  ink?: 1 | 2;
  /** CSS `border-radius`; defaults to a full pill. */
  radius?: string;
  /** Degrees, rotated about the shape's center. */
  rotate?: number;
}

/** The tile type's own icon, placed as the identifying glyph. */
interface Glyph {
  x: number;
  y: number;
  size: number;
}

interface Artwork {
  shapes: Shape[];
  glyph?: Glyph;
  /** A dashed outline (the Embed "webpage" placeholder). */
  frame?: Shape;
}

const props = defineProps<{
  typeId: string;
  icon: Component;
}>();

const BOX = 150;
const pct = (value: number): string =>
  `${Number(((value / BOX) * 100).toFixed(4))}%`;

// Geometry transcribed from Figma "Tiles" (1605-7314). Where Figma used a
// bespoke illustration for the type's glyph (pencil, avatar, pin, flame, …) the
// registry icon for that type stands in, so the carousel can never drift from
// the tile types the toolbar actually offers.
const ARTWORK: Record<string, Artwork> = {
  text: {
    shapes: [
      { x: 19, y: 74, w: 50, h: 10, ink: 2 },
      { x: 19, y: 94, w: 95, h: 5 },
      { x: 19, y: 109, w: 70, h: 5 },
      { x: 19, y: 124, w: 35, h: 5 },
    ],
    glyph: { x: 80, y: 22, size: 44 },
  },
  smart_text: {
    shapes: [
      { x: 19, y: 94, w: 95, h: 5 },
      { x: 19, y: 109, w: 70, h: 5 },
      { x: 19, y: 124, w: 35, h: 5 },
    ],
    glyph: { x: 78, y: 24, size: 46 },
  },
  profile: {
    shapes: [
      { x: 19, y: 74, w: 60, h: 10, ink: 2 },
      { x: 19, y: 89, w: 30, h: 5 },
      { x: 19, y: 109, w: 90, h: 5, ink: 2 },
      { x: 19, y: 119, w: 50, h: 5, ink: 2 },
    ],
    glyph: { x: 18, y: 18, size: 50 },
  },
  chat: {
    shapes: [
      { x: 69, y: 19, w: 60, h: 20, ink: 2, radius: "10px 10px 3px 10px" },
      { x: 19, y: 44, w: 50, h: 20, radius: "10px 10px 10px 3px" },
      { x: 79, y: 69, w: 50, h: 20, ink: 2, radius: "10px 10px 3px 10px" },
      { x: 19, y: 109, w: 85, h: 20, radius: "8px" },
    ],
    glyph: { x: 106, y: 106, size: 24 },
  },
  image: {
    shapes: [],
    glyph: { x: 30, y: 30, size: 90 },
  },
  document: {
    shapes: [
      { x: 47, y: 100, w: 55, h: 5, ink: 2, radius: "5px" },
      { x: 47, y: 110, w: 45, h: 5, ink: 2, radius: "5px" },
      { x: 47, y: 120, w: 25, h: 5, ink: 2, radius: "5px" },
    ],
    glyph: { x: 42, y: 26, size: 66 },
  },
  link: {
    shapes: [
      { x: 19, y: 89, w: 60, h: 15, ink: 2, radius: "10px" },
      { x: 19, y: 114, w: 90, h: 5 },
      { x: 19, y: 124, w: 50, h: 5 },
    ],
    glyph: { x: 95, y: 19, size: 32 },
  },
  embed: {
    frame: { x: 22, y: 67, w: 105, h: 60, radius: "15px" },
    shapes: [
      { x: 88, y: 82, w: 25, h: 30, ink: 2, radius: "5px" },
      { x: 37, y: 85, w: 35, h: 5, ink: 2, radius: "5px" },
      { x: 37, y: 95, w: 15, h: 5, ink: 2, radius: "5px" },
      { x: 37, y: 105, w: 25, h: 5, ink: 2, radius: "5px" },
    ],
    glyph: { x: 45, y: 17, size: 60 },
  },
  map: {
    shapes: [
      { x: 20, y: 30, w: 90, h: 9, radius: "3px", rotate: 18 },
      { x: 6, y: 66, w: 100, h: 9, radius: "3px", rotate: -44 },
      { x: 30, y: 96, w: 100, h: 9, radius: "3px" },
    ],
    glyph: { x: 55, y: 48, size: 40 },
  },
  campfire: {
    shapes: [
      { x: 45, y: 19, w: 60, h: 15, radius: "15px" },
      { x: 20, y: 117, w: 40, h: 10, radius: "5px" },
      { x: 115, y: 114, w: 15, h: 15, radius: "3px" },
    ],
    glyph: { x: 54, y: 50, size: 42 },
  },
};

// Types without bespoke artwork still get a card: their icon, centered.
const FALLBACK: Artwork = { shapes: [], glyph: { x: 40, y: 40, size: 70 } };

const artwork = computed<Artwork>(() => ARTWORK[props.typeId] ?? FALLBACK);

const shapeStyle = (shape: Shape) => ({
  left: pct(shape.x),
  top: pct(shape.y),
  width: pct(shape.w),
  height: pct(shape.h),
  borderRadius: shape.radius ?? "999px",
  transform: shape.rotate ? `rotate(${shape.rotate}deg)` : undefined,
});

const frameStyle = (frame: Shape) => ({
  left: pct(frame.x),
  top: pct(frame.y),
  width: pct(frame.w),
  height: pct(frame.h),
  borderRadius: frame.radius ?? "15px",
});

const glyphStyle = (glyph: Glyph) => ({
  left: pct(glyph.x),
  top: pct(glyph.y),
  width: pct(glyph.size),
  height: pct(glyph.size),
});
</script>

<style lang="scss" scoped>
.mtt {
  position: absolute;
  inset: 0;
  color: var(--color-text-primary);
  overflow: hidden;
}

.mtt-shape {
  position: absolute;
  background: currentColor;
  opacity: 0.1;
}

.mtt-shape--ink2 {
  opacity: 0.18;
}

.mtt-frame {
  position: absolute;
  border: 3px dashed currentColor;
  opacity: 0.12;
}

.mtt-glyph {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  opacity: 0.28;

  :deep(svg) {
    width: 100%;
    height: 100%;
  }
}
</style>
