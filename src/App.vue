<template>
  <div id="app">
    <!-- Left Navigation Bar -->
    <LeftNavBar v-if="isAuthenticated" />

    <!-- User Menu at Bottom Left -->
    <UserMenu v-if="isAuthenticated" />

    <!-- Top Bar for Layout Title Editor and Theme Toggle -->
    <div class="top-bar" v-if="showTopBar">
      <LayoutTitleEditor v-if="showTitleEditor" />
      <ThemeToggle />
    </div>

    <!-- Main Content Area -->
    <div class="main-content" :class="{ 'has-left-nav': isAuthenticated }">
      <router-view />
    </div>

    <!-- Toast Notifications -->
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import LeftNavBar from './components/LeftNavBar.vue';
import UserMenu from './components/UserMenu.vue';
import LayoutTitleEditor from './components/LayoutTitleEditor.vue';
import ThemeToggle from './components/ThemeToggle.vue';
import ToastContainer from './components/ToastContainer.vue';
import { useLayoutStore } from '@/stores/layout';
import { auth } from '@/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
const route = useRoute();
const layoutStore = useLayoutStore();

const user = ref<User | null>(null);

onMounted(() => {
  onAuthStateChanged(auth, (currentUser) => {
    user.value = currentUser;
  });
});

const isAuthenticated = computed(() => !!user.value);

const showTitleEditor = computed(() => {
  return layoutStore.isOwner && route.path.startsWith("/grid");
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
  // backdrop-filter: blur(20px);
  // background-color: var(--color-content-background);
  // opacity: 0.95;
}

.main-content {
  padding-left: 0;
}

.main-content.has-left-nav {
  // Space for left nav bar
}

.section {
  max-width: 1524px;
  margin: 0 auto;
  padding: 2rem;
}

.container {
  // margin: 0 !important;
  display: block;
}

.w-fit {
  width: fit-content;
}
</style>