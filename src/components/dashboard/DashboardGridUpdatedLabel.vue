<template>
  <span class="grid-updated" :data-tooltip="title">{{ label }}</span>
</template>

<script setup lang="ts">
import type { Layout } from "@/types/Layout";
import { useDashboardLayoutUpdated } from "@/composables/useDashboardLayoutUpdated";

const props = defineProps<{
  layout: Layout;
}>();

const { label, title } = useDashboardLayoutUpdated(() => props.layout);
</script>

<style scoped>
.grid-updated {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  color: var(--color-content-default);
  white-space: nowrap;
}
</style>
