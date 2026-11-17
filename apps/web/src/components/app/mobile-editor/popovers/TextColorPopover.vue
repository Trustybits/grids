<!--
  TextColorPopover.vue — Color: the text colour of all the text in the
  tile(s). "Auto" clears it, so the tile picks a colour that contrasts with
  its fill (Figma has no Auto; the code does).
-->
<template>
  <PopoverSwatches
    label="Text color"
    :swatches="TEXT_SWATCHES"
    :model-value="current"
    :lead="{ value: AUTO, label: 'Auto' }"
    @pick="pick"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import PopoverSwatches from "./PopoverSwatches.vue";
import { TEXT_SWATCHES } from "./swatches";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { WRITERS } from "@/registries/tileToolbar/mobileTools";

const AUTO = "auto";

const visit = useToolPopoverVisit();

const current = computed(() => {
  const color = visit.read(WRITERS.textColor);
  return color === null ? AUTO : color;
});

const pick = (value: string) =>
  visit.write(WRITERS.textColor, value === AUTO ? null : value);
</script>
