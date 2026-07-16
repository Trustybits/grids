<!--
  MobileColorPicker.vue

  Mobile 2.0 color-picker sheet body (Figma "Grid Settings — Color" 1588-7129).
  Rises from behind the bottom command pill once that pill has morphed into the
  `/HEX` command input (the same morph/rise pattern as the settings sheet and
  the add-a-tile carousel), and rests flush on top of it as one surface.

  Contents (SLIDERS tab only for now — the VALUE BOX numeric-entry tab and the
  grid eyedropper are deferred follow-ups): a saturation/brightness HSB pad, a
  hue slider, and a horizontally-scrollable row of preset + saved swatches.

  HSV is the source of truth while dragging (hue → H, pad X → S, pad Y → V) so a
  channel bottoming out doesn't lose the hue; hex is derived and surfaced to the
  parent via `update:modelValue`. `preview` fires continuously during a pad/hue
  drag (the parent applies it to the grid background live, without touching undo
  history), and `commit` fires once at the end of a gesture (pad/hue pointer-up,
  swatch tap) so the whole drag collapses into a single undo entry.
-->
<template>
  <div class="mcp-panel" role="group" aria-label="Color picker">
    <div
      ref="padRef"
      class="mcp-pad"
      role="slider"
      aria-label="Saturation and brightness"
      :style="{ backgroundColor: hueHex }"
      data-testid="mcp-pad"
      @pointerdown="onPadPointerDown"
    >
      <span
        class="mcp-thumb"
        :style="{
          left: `${hsv.s * 100}%`,
          top: `${(1 - hsv.v) * 100}%`,
          backgroundColor: modelValue,
        }"
      />
    </div>

    <div
      ref="hueRef"
      class="mcp-hue"
      role="slider"
      aria-label="Hue"
      @pointerdown="onHuePointerDown"
    >
      <span class="mcp-thumb" :style="{ left: `${(hsv.h / 360) * 100}%` }" />
    </div>

    <div class="mcp-swatches" role="listbox" aria-label="Saved and preset colors">
      <button
        v-for="color in swatches"
        :key="color"
        type="button"
        class="mcp-swatch"
        :class="{ 'is-selected': isSelected(color) }"
        role="option"
        :aria-selected="isSelected(color)"
        :aria-label="color"
        :style="{ backgroundColor: color }"
        @click="onSwatch(color)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from "@/utils/color";

const props = withDefaults(
  defineProps<{ modelValue: string; swatches?: string[] }>(),
  { swatches: () => [] },
);

const emit = defineEmits<{
  (e: "update:modelValue", hex: string): void;
  (e: "preview", hex: string): void;
  (e: "commit", hex: string): void;
}>();

const padRef = ref<HTMLElement | null>(null);
const hueRef = ref<HTMLElement | null>(null);

const hsv = reactive<Hsv>(hexToHsv(props.modelValue) ?? { h: 0, s: 1, v: 1 });

// The pure hue at full saturation/value — the base color the pad tints with its
// white (→right) and black (→bottom) gradients.
const hueHex = computed(() => hsvToHex({ h: hsv.h, s: 1, v: 1 }));

const isSelected = (color: string): boolean =>
  normalizeHex(color) === normalizeHex(props.modelValue);

// Resync from the parent ONLY on a genuine external change (hex typed, swatch
// picked elsewhere). Our own emits round-trip back as an equal hex, which we
// skip so a channel at its extreme can't reset the retained hue.
watch(
  () => props.modelValue,
  (hex) => {
    const incoming = normalizeHex(hex);
    if (!incoming || incoming === hsvToHex(hsv)) return;
    const next = hexToHsv(incoming);
    if (next) Object.assign(hsv, next);
  },
);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const applyPad = (event: PointerEvent) => {
  const el = padRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  hsv.s = clamp01((event.clientX - rect.left) / rect.width);
  hsv.v = 1 - clamp01((event.clientY - rect.top) / rect.height);
  const hex = hsvToHex(hsv);
  emit("update:modelValue", hex);
  emit("preview", hex);
};

const applyHue = (event: PointerEvent) => {
  const el = hueRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  hsv.h = clamp01((event.clientX - rect.left) / rect.width) * 360;
  const hex = hsvToHex(hsv);
  emit("update:modelValue", hex);
  emit("preview", hex);
};

// A single active drag at a time; `apply` is the axis handler bound on start.
let apply: ((event: PointerEvent) => void) | null = null;

const onMove = (event: PointerEvent) => {
  if (apply) apply(event);
};

const onUp = () => {
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
  apply = null;
  emit("commit", hsvToHex(hsv));
};

const beginDrag = (
  event: PointerEvent,
  handler: (event: PointerEvent) => void,
) => {
  apply = handler;
  handler(event);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
};

const onPadPointerDown = (event: PointerEvent) => beginDrag(event, applyPad);
const onHuePointerDown = (event: PointerEvent) => beginDrag(event, applyHue);

const onSwatch = (color: string) => {
  const hex = normalizeHex(color);
  if (!hex) return;
  const next = hexToHsv(hex);
  if (next) Object.assign(hsv, next);
  emit("update:modelValue", hex);
  emit("commit", hex);
};

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
});
</script>

<style lang="scss" scoped>
.mcp-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: 100%;
  padding: var(--spacing-md);
  background-color: var(--color-toolbar-background);
  border: var(--border-width) solid var(--color-stroke);
  // Square the bottom corners so the panel lines up flush with the (top-squared)
  // `/HEX` command input resting directly beneath it.
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-xl);
}

.mcp-pad {
  position: relative;
  width: 100%;
  height: 140px;
  border-radius: var(--radius-md);
  touch-action: none;
  // White fades left→right, black fades bottom→top, over the base hue color.
  background-image:
    linear-gradient(to top, #000, rgba(0, 0, 0, 0)),
    linear-gradient(to right, #fff, rgba(255, 255, 255, 0));
  // Stroke as an inset ring rather than a real border: it sits on top of the
  // gradient inside the rounded corners, so there's no vivid-gradient bleed
  // under a translucent border and no corner tearing from clipping the
  // background to a smaller (padding-box) radius than the border.
  box-shadow: inset 0 0 0 var(--border-width) var(--color-stroke);
  cursor: crosshair;
}

.mcp-hue {
  position: relative;
  width: 100%;
  height: 24px;
  border-radius: var(--radius-full);
  touch-action: none;
  box-shadow: inset 0 0 0 var(--border-width) var(--color-stroke);
  background-image: linear-gradient(
    to right,
    #ff0000 0%,
    #ffff00 17%,
    #00ff00 33%,
    #00ffff 50%,
    #0000ff 67%,
    #ff00ff 83%,
    #ff0000 100%
  );
  cursor: ew-resize;
}

.mcp-thumb {
  position: absolute;
  top: 50%;
  width: 22px;
  height: 22px;
  transform: translate(-50%, -50%);
  border: 2px solid var(--color-light-100);
  border-radius: var(--radius-full);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}

.mcp-swatches {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mcp-swatch {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--easing-smooth);

  &.is-selected {
    border: var(--border-width-lg) solid var(--color-purple);
    transform: scale(1.06);
  }
}
</style>
