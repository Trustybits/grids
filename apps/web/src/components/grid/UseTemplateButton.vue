<template>
  <Button variant="ghost" icon-only size="lg" @click="handleUseTemplate">
    <template #icon-left>
      <DuplicatePlusIcon />
    </template>
  </Button>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridController } from "@/controllers/useGridController";
import { useToastStore } from "@/stores/toast";
import Button from '@/components/ui-elements/Button.vue';
import DuplicatePlusIcon from '@/components/icons/DuplicatePlusIcon.vue';

const router = useRouter();
const route = useRoute();
const sessionStore = useGridSessionStore();
const controller = useGridController();
const toastStore = useToastStore();

const handleUseTemplate = async () => {
  if (!getAuthProvider().getCurrentUserId()) {
    router.push({ path: '/login', query: { redirect: route.fullPath } });
    return;
  }

  if (!sessionStore.currentGrid) return;

  const newId = await controller.duplicateGrid(sessionStore.currentGrid, 'structure');
  if (newId) {
    toastStore.addToast('Grid duplicated as a new template!', 'success');
    router.push(`/grid/${newId}`);
  } else {
    toastStore.addToast('Failed to duplicate grid.', 'error');
  }
};
</script>
