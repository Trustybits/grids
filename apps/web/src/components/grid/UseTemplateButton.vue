<template>
  <Button variant="ghost" icon-only @click="handleUseTemplate">
    <template #icon-left>
      <DuplicatePlusIcon :size="20" />
    </template>
  </Button>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { useGridStore } from "@/stores/grid";
import { useToastStore } from "@/stores/toast";
import Button from '@/components/ui-elements/Button.vue';
import DuplicatePlusIcon from '@/components/icons/DuplicatePlusIcon.vue';

const router = useRouter();
const route = useRoute();
const gridStore = useGridStore();
const toastStore = useToastStore();

const handleUseTemplate = async () => {
  if (!getAuthProvider().getCurrentUserId()) {
    router.push({ path: '/login', query: { redirect: route.fullPath } });
    return;
  }

  if (!gridStore.currentGrid) return;

  const newId = await gridStore.duplicateGrid(gridStore.currentGrid, 'structure');
  if (newId) {
    toastStore.addToast('Grid duplicated as a new template!', 'success');
    router.push(`/grid/${newId}`);
  } else {
    toastStore.addToast('Failed to duplicate grid.', 'error');
  }
};
</script>
