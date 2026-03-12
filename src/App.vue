<template>
  <div id="app">
    <!-- Left Navigation Bar -->
    <LeftNavBar v-if="isAuthenticated" />

    <!-- Top Bar for Layout Title Editor and Theme Toggle -->
    <div class="top-bar" v-if="showTopBar">
      <LayoutTitleEditor v-if="showTitleEditor" :is-authenticated="isAuthenticated" />
      <ThemeToggle />
    </div>

    <!-- Main Content Area -->
    <div class="main-content" :class="{ 'has-left-nav': isAuthenticated }">
      <router-view />
    </div>

    <!-- Global bottom-left buttons (Share, Discord, UserMenu, GridMenu) -->
    <BottomLeftButtons />

    <!-- Toast Notifications -->
    <ToastContainer />

    <!-- Pixel Racers Game (Easter Egg) -->
    <PixelRacersGame />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import LeftNavBar from './components/LeftNavBar.vue';
import BottomLeftButtons from './components/BottomLeftButtons.vue';
import LayoutTitleEditor from './components/LayoutTitleEditor.vue';
import ThemeToggle from './components/ThemeToggle.vue';
import ToastContainer from './components/ToastContainer.vue';
import PixelRacersGame from './components/PixelRacersGame.vue';
import { useLayoutStore } from '@/stores/layout';
import { auth, db } from '@/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const route = useRoute();
const layoutStore = useLayoutStore();

const user = ref<User | null>(null);
const previousUser = ref<User | null>(null);
const isInitialLoad = ref(true);

onMounted(() => {
  onAuthStateChanged(auth, async (currentUser) => {
    // Track login for existing users (not new signups on page load)
    if (currentUser && !isInitialLoad.value && !previousUser.value) {
      // User just logged in - update lastLogin in Firestore
      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          email: currentUser.email,
          lastLogin: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update lastLogin:', err);
      }
    }
    
    previousUser.value = user.value;
    user.value = currentUser;
    isInitialLoad.value = false;
  });
});

const isAuthenticated = computed(() => !!user.value);

const isOnGridPage = computed(() =>
  route.path.startsWith("/grid") || !!layoutStore.currentLayout
);

const showTitleEditor = computed(() => {
  return isOnGridPage.value;
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
  z-index: var(--z-topbar);
  // backdrop-filter: blur(20px);
  background-color: var(--color-content-background);
  // opacity: 0.95;
}

.main-content {
  padding-left: 0;
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