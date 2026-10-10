<!--
  MapStylePopover.vue — Style (map): Default, or Auto to follow the light /
  dark theme.
-->
<template>
  <PopoverChoices
    label="Map style"
    :options="OPTIONS"
    :model-value="current"
    @select="(value) => visit.write(WRITERS.mapStyle, value as 'default' | 'auto')"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import PopoverChoices, { type PopoverChoice } from "./PopoverChoices.vue";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { WRITERS } from "@/registries/tileToolbar/mobileTools";

const OPTIONS: PopoverChoice[] = [
  { value: "default", label: "Default" },
  { value: "auto", label: "Auto", hint: "Follows light / dark" },
];

const visit = useToolPopoverVisit();
const current = computed(() => visit.read(WRITERS.mapStyle));
</script>
