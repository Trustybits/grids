<!--
  StylePopover.vue — Style (Figma 147:22739): Bold · Italic · Underline ·
  Strike · Code, and the horizontal alignment, over all the text in the tile(s).
  A mark that is on for only part of the text reads as off; tapping it turns
  it on everywhere.
-->
<template>
  <div class="pp-stack">
    <div class="pp-section">
      <p class="pp-label">Style</p>
      <PopoverChoices
        label="Text style"
        :options="markOptions"
        multiple
        @select="toggleMark"
      />
    </div>
    <div class="pp-section">
      <p class="pp-label">Alignment</p>
      <PopoverChoices
        label="Alignment"
        :options="alignOptions"
        :model-value="align"
        @select="setAlign"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw } from "vue";
import PopoverChoices, { type PopoverChoice } from "./PopoverChoices.vue";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { WRITERS } from "@/registries/tileToolbar/mobileTools";
import type { ToggleableMark } from "@/utils/richText/formatting";
import AlignLeftIcon from "@/components/icons/toolbar/AlignLeftIcon.vue";
import AlignCenterIcon from "@/components/icons/toolbar/AlignCenterIcon.vue";
import AlignRightIcon from "@/components/icons/toolbar/AlignRightIcon.vue";

const visit = useToolPopoverVisit();

const MARKS: { id: ToggleableMark; glyph: string; name: string }[] = [
  { id: "bold", glyph: "B", name: "Bold" },
  { id: "italic", glyph: "I", name: "Italic" },
  { id: "underline", glyph: "U", name: "Underline" },
  { id: "strike", glyph: "S", name: "Strikethrough" },
  { id: "code", glyph: "</>", name: "Code" },
];

const markOptions = computed<PopoverChoice[]>(() =>
  MARKS.map((mark) => ({
    value: mark.id,
    label: mark.glyph,
    ariaLabel: mark.name,
    labelClass: `pp-mark pp-mark--${mark.id}`,
    on: visit.read(WRITERS[mark.id]) === true,
  })),
);

const toggleMark = (id: string) => {
  const writer = WRITERS[id as ToggleableMark];
  visit.write(writer, visit.read(writer) !== true);
};

const alignOptions: PopoverChoice[] = [
  { value: "left", ariaLabel: "Align left", icon: markRaw(AlignLeftIcon) },
  { value: "center", ariaLabel: "Align center", icon: markRaw(AlignCenterIcon) },
  { value: "right", ariaLabel: "Align right", icon: markRaw(AlignRightIcon) },
];

const align = computed(() => visit.read(WRITERS.textAlign));

const setAlign = (value: string) =>
  visit.write(WRITERS.textAlign, value as "left" | "center" | "right");
</script>
