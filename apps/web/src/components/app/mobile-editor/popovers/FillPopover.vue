<!--
  FillPopover.vue — Fill: the tile's background colour, plus a Fill / Overlay
  switch on tiles that tint their image (image, video, link, documents). The
  switch also sets which treatment the tile shows, as the desktop picker does.
  "No fill" leads the swatches.
-->
<template>
  <div class="pp-stack">
    <PopoverChoices
      v-if="overlayCapable"
      label="Color target"
      :options="TARGETS"
      :model-value="mode"
      @select="setMode"
    />
    <PopoverSwatches
      :label="mode === 'overlay' ? 'Overlay color' : 'Fill color'"
      :swatches="FILL_SWATCHES"
      :model-value="current"
      :lead="{ value: NO_FILL_COLOR, label: 'No fill' }"
      @pick="pick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import PopoverChoices, { type PopoverChoice } from "./PopoverChoices.vue";
import PopoverSwatches from "./PopoverSwatches.vue";
import { FILL_SWATCHES } from "./swatches";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { WRITERS } from "@/registries/tileToolbar/mobileTools";
import { fillOptionsFor } from "@/utils/tileFill";
import { NO_FILL_COLOR } from "@/composables/useColorPicker";
import { MIXED } from "@/utils/richText/docTransforms";

const TARGETS: PopoverChoice[] = [
  { value: "fill", label: "Fill" },
  { value: "overlay", label: "Overlay" },
];

const visit = useToolPopoverVisit();

/** Overlay only when every tile can show one. */
const overlayCapable = computed(
  () =>
    visit.tiles.value.length > 0 &&
    visit.tiles.value.every(
      (tile) => fillOptionsFor(tile.content.type)?.overlayCapable,
    ),
);

const mode = computed(() => {
  if (!overlayCapable.value) return "fill";
  const value = visit.read(WRITERS.colorMode);
  return value === MIXED ? "fill" : value;
});

const current = computed(() =>
  visit.read(mode.value === "overlay" ? WRITERS.overlay : WRITERS.fill),
);

const setMode = (value: string) =>
  visit.write(WRITERS.colorMode, value as "fill" | "overlay");

const pick = (color: string) =>
  visit.write(mode.value === "overlay" ? WRITERS.overlay : WRITERS.fill, color);
</script>
