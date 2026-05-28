<template>
  <span class="grid-updated" :data-tooltip="title">{{ label }}</span>
</template>

<script setup lang="ts">
import type { Grid } from "@grids/contracts/types";
import { useDashboardGridUpdated } from "@/composables/useDashboardGridUpdated";

const props = defineProps<{
  grid: Grid;
}>();

const { label, title } = useDashboardGridUpdated(() => props.grid);
</script>

<style scoped>
.grid-updated {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  color: var(--color-content-default);
  white-space: nowrap;
}
</style>
