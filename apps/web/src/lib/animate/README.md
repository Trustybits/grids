# `lib/animate`

Shared animation toolkit: pure-JS tweening, a named background-preset
registry, a pointer-based draggable composable, and a Vue drop-in
(`BackgroundLayer.vue`) that renders any preset as an absolutely-positioned
layer. No GSAP or other animation library — CSS `@keyframes`, SVG patterns,
and the Web Animations timing model (`requestAnimationFrame`) only.

Built to power the OG Image Studio (`src/components/og/`), but everything
here is generic — usable for tile backgrounds, grid backgrounds, or any other
surface that wants an animated fill.

## Using `BackgroundLayer` in a tile or grid component

```vue
<template>
  <div class="my-tile">
    <BackgroundLayer :config="bgConfig" class="my-tile__bg" />
    <div class="my-tile__content">
      <!-- tile content renders above the background layer -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { BackgroundLayer, type BackgroundConfig } from "@/lib/animate";

const bgConfig = ref<BackgroundConfig>({
  presetId: "aurora",
  color: "#18181b",
  stops: [
    { color: "#6366f1", offset: 0 },
    { color: "#8b5cf6", offset: 100 },
  ],
  speed: 14,
});
</script>

<style scoped>
.my-tile {
  position: relative;
}

.my-tile__bg {
  z-index: 0;
}

.my-tile__content {
  position: relative;
  z-index: 1;
}
</style>
```

`BackgroundLayer` fills its nearest positioned ancestor (`position: absolute;
inset: 0`), so give the wrapping element `position: relative` and stack
foreground content above it with `z-index`.

## Using `useAnimatedBackground` directly

For cases that need the raw style/SVG output instead of the component (e.g.
compositing into a canvas export), call the composable directly:

```ts
import { useAnimatedBackground, type BackgroundConfig } from "@/lib/animate";

const config = ref<BackgroundConfig>({ presetId: "dot-grid", patternColor: "#fff3", patternSize: 24 });
const { styleObject, svgMarkup, cssVars } = useAnimatedBackground(config);
```

`styleObject` is a Vue style-binding-ready object for CSS-only presets;
`svgMarkup` is inline SVG markup for pattern presets (dot grid, line grid,
hexagons, noise, etc.).

## Wiring a tile's `tileBackground` field to the picker

If a tile type wants an editable background, store a `BackgroundConfig` on
its `TileContent` (as a plain JSON-serializable field — every `BackgroundConfig`
property is a primitive or array of primitives) and pass it straight into
`<BackgroundLayer :config="tile.content.tileBackground" />`. The OG Studio's
`OGInspector.vue` shows a full tabbed Solid | Gradient | Animated | Pattern
picker UI you can lift the same control patterns from.

## Draggable

```ts
import { useDraggable } from "@/lib/animate";

const el = ref<HTMLElement | null>(null);
const { isDragging, x, y } = useDraggable({
  el,
  onDrag: ({ x, y }) => { /* position feedback */ },
});
```

Uses `pointerdown` / `pointermove` / `pointerup` with `setPointerCapture` so
mouse and touch share one code path.

## Tweening

`tween()` and `timeline()` in `tween.ts` are dependency-free numeric
tweens driven by `requestAnimationFrame`, with a small easing-function
library (`ease.linear`, `ease.outCubic`, `ease.outElastic`, `ease.outBounce`,
etc.) — used internally by nothing here yet, but available for imperative
animations (e.g. animating a tile's rotation/scale on drop) that don't fit
the CSS-transition model `BackgroundLayer` uses.
