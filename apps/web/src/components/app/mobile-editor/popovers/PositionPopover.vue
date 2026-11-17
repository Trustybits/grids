<!--
  PositionPopover.vue — Position (Figma 147:23904): where the text sits
  vertically. Top and Bottom are off when the tile renders centred anyway
  (`disableTopBottomAlign`, e.g. a single short line).
-->
<template>
  <PopoverChoices
    label="Vertical position"
    :options="options"
    :model-value="current"
    @select="set"
  />
</template>

<script setup lang="ts">
import { computed, markRaw } from "vue";
import PopoverChoices, { type PopoverChoice } from "./PopoverChoices.vue";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { useMobileTileEdit } from "@/composables/useMobileTileEdit";
import { WRITERS } from "@/registries/tileToolbar/mobileTools";
import AlignTopIcon from "@/components/icons/toolbar/AlignTopIcon.vue";
import AlignMiddleIcon from "@/components/icons/toolbar/AlignMiddleIcon.vue";
import AlignBottomIcon from "@/components/icons/toolbar/AlignBottomIcon.vue";

type Vertical = "top" | "center" | "bottom";

const visit = useToolPopoverVisit();
const { handle } = useMobileTileEdit();

// Only the live single tile can say it renders centred.
const centredOnly = computed(
  () =>
    visit.tiles.value.length === 1 &&
    !!handle.value?.childComponent.value?.disableTopBottomAlign,
);

const options = computed<PopoverChoice[]>(() => [
  {
    value: "top",
    label: "Top",
    icon: markRaw(AlignTopIcon),
    disabled: centredOnly.value,
  },
  { value: "center", label: "Middle", icon: markRaw(AlignMiddleIcon) },
  {
    value: "bottom",
    label: "Bottom",
    icon: markRaw(AlignBottomIcon),
    disabled: centredOnly.value,
  },
]);

const current = computed(() => visit.read(WRITERS.verticalAlign));

const set = (value: string) =>
  visit.write(WRITERS.verticalAlign, value as Vertical);
</script>
