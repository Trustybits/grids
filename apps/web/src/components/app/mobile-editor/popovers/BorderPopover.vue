<!--
  BorderPopover.vue — Border: Show / Hide. Sets the value rather than flipping
  it, so in multi-edit every tile ends up the same.
-->
<template>
  <PopoverChoices
    label="Tile border"
    :options="OPTIONS"
    :model-value="current"
    @select="set"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import PopoverChoices, { type PopoverChoice } from "./PopoverChoices.vue";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { WRITERS } from "@/registries/tileToolbar/mobileTools";
import { MIXED } from "@/utils/richText/docTransforms";

const OPTIONS: PopoverChoice[] = [
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
];

const visit = useToolPopoverVisit();

const current = computed(() => {
  const on = visit.read(WRITERS.border);
  if (on === MIXED) return null;
  return on ? "show" : "hide";
});

const set = (value: string) => visit.write(WRITERS.border, value === "show");
</script>
