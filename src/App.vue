<template>
  <div id="app">
    <!-- Left Navigation Bar -->
    <LeftNavBar />

    <!-- Top Bar for Layout Title Editor and Theme Toggle -->
    <div class="top-bar" v-if="showTopBar">
      <LayoutTitleEditor v-if="showTitleEditor" />
      <ThemeToggle />
    </div>

    <!-- Main Content Area -->
    <div v-if="isAuthChecked" class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import LeftNavBar from './components/LeftNavBar.vue';
import LayoutTitleEditor from './components/LayoutTitleEditor.vue';
import ThemeToggle from './components/ThemeToggle.vue';
import { useLayoutStore } from '@/stores/layout';
import { useAuthGuard } from "@/composables/useAuthGuard";

const { isAuthChecked } = useAuthGuard();
const route = useRoute();
const layoutStore = useLayoutStore();

const showTitleEditor = computed(() => {
  return layoutStore.currentLayout && route.path.startsWith("/grid");
});

const showTopBar = computed(() => {
  return showTitleEditor.value;
});
</script>

<style lang="scss">
.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  z-index: var(--z-base);
  backdrop-filter: blur(20px);
  background-color: var(--color-content-background);
  opacity: 0.95;
}

.main-content {
  padding-left: 20px; // Space for left nav bar
}

.section {
  max-width: 1524px;
  margin: 0 auto;
  padding: 2rem;
}

.container {
  // margin: 0 !important;
}

.w-fit {
  width: fit-content;
}
</style>