<template>
  <!--
    "Use as Template" button — visible to non-owners on grids that have
    duplication enabled (duplicatable: true). Authenticated users get a
    full copy of the grid; unauthenticated visitors are redirected to login.
  -->
  <div class="use-template-button">
    <button
      type="button"
      class="use-template-button__btn"
      @click="handleUseTemplate"
    >
      <div class="use-template-icon">
        <!-- Copy/template icon (two overlapping rectangles with a plus) -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- Small plus sign to distinguish from the plain copy icon -->
          <path d="M15.5 13v4m-2-2h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { getAuth } from "firebase/auth";
import { useLayoutStore } from "@/stores/layout";
import { useToastStore } from "@/stores/toast";

const router = useRouter();
const route = useRoute();
const layoutStore = useLayoutStore();
const toastStore = useToastStore();
const auth = getAuth();

const handleUseTemplate = async () => {
  // If the visitor isn't logged in, redirect to login with a return URL
  // so they land back here after signing in.
  if (!auth.currentUser) {
    router.push({ path: '/login', query: { redirect: route.fullPath } });
    return;
  }

  if (!layoutStore.currentLayout) return;

  // Public template copies only clone layout structure, not content
  const newId = await layoutStore.duplicateLayout(layoutStore.currentLayout, 'structure');
  if (newId) {
    toastStore.addToast('Grid duplicated as a new template!', 'success');
    router.push(`/grid/${newId}`);
  } else {
    toastStore.addToast('Failed to duplicate grid.', 'error');
  }
};
</script>

<style lang="scss" scoped>
.use-template-button {
  position: relative;
}

.use-template-button__btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--duration-fast) var(--easing-smooth);
  padding: 0;
  border: none;
  line-height: 0;

  &:hover {
    background: var(--color-base-34);

    .use-template-icon {
      color: var(--color-figma-purple);
    }
  }
}

.use-template-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--color-content-default);
  transition: color var(--duration-fast) var(--easing-smooth);

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}
</style>
