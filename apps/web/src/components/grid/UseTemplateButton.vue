<template>
  <IconButton @click="handleUseTemplate">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15.5 13v4m-2-2h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </IconButton>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { useLayoutStore } from "@/stores/layout";
import { useToastStore } from "@/stores/toast";
import IconButton from '@/components/ui-elements/IconButton.vue';

const router = useRouter();
const route = useRoute();
const layoutStore = useLayoutStore();
const toastStore = useToastStore();

const handleUseTemplate = async () => {
  if (!getAuthProvider().getCurrentUserId()) {
    router.push({ path: '/login', query: { redirect: route.fullPath } });
    return;
  }

  if (!layoutStore.currentLayout) return;

  const newId = await layoutStore.duplicateLayout(layoutStore.currentLayout, 'structure');
  if (newId) {
    toastStore.addToast('Grid duplicated as a new template!', 'success');
    router.push(`/grid/${newId}`);
  } else {
    toastStore.addToast('Failed to duplicate grid.', 'error');
  }
};
</script>
