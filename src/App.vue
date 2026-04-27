<template>
  <div id="app">
    <!-- Global viewport warning banner — sits above everything including the TopBar.
         Uses sticky positioning so it stays visible on scroll and pushes all
         app content (TopBar, main area, etc.) below it. -->
    <ViewportWarning type="breakpoint-preview" :dismissible="false" />

    <!-- Left Navigation Bar -->
    <LeftNavBar v-if="isAuthenticated" />

    <!-- Top Bar for Layout Title Editor -->
    <div ref="topBarRef" class="top-bar" v-if="showTopBar">
      <LayoutTitleEditor v-if="showTitleEditor" :isAuthenticated="isAuthenticated" />
    </div>

    <!-- Main Content Area -->
    <div class="main-content" :class="{ 'has-left-nav': isAuthenticated }">
      <router-view />
    </div>

    <!-- Global bottom-left buttons (Share, Discord, UserMenu, GridMenu) -->
    <BottomLeftButtons v-if="!hideBottomCornerButtons" />

    <!-- Toast Notifications -->
    <ToastContainer />

    <!-- Pixel Racers Game (Easter Egg) -->
    <PixelRacersGame />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import LeftNavBar from './components/LeftNavBar.vue';
import BottomLeftButtons from './components/BottomLeftButtons.vue';
import LayoutTitleEditor from './components/LayoutTitleEditor.vue';
import ToastContainer from './components/ToastContainer.vue';
import PixelRacersGame from './components/PixelRacersGame.vue';
import ViewportWarning from './components/ViewportWarning.vue';
import { useLayoutStore } from '@/stores/layout';
import { getServiceFactory } from '@/services/ServiceFactorySingleton';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import type { AuthUser } from '@/auth/AuthProvider';
import { usePostHog } from '@/composables/usePostHog';

const { identify, reset: resetPostHog } = usePostHog();

const route = useRoute();
const layoutStore = useLayoutStore();
const hideBottomCornerButtons = computed(() => route.path === '/pricing');

const user = ref<AuthUser | null>(null);
const previousUser = ref<AuthUser | null>(null);
const isInitialLoad = ref(true);

onMounted(() => {
  getAuthProvider().onAuthStateChanged(async (currentUser) => {
    // Track login for existing users (not new signups on page load)
    if (currentUser && !isInitialLoad.value && !previousUser.value) {
      // User just logged in - update lastLogin
      try {
        await getServiceFactory().getUserService().recordLogin(
          currentUser.uid,
          currentUser.email,
        );
      } catch (err) {
        console.error('Failed to update lastLogin:', err);
      }
    }

    // Sync identity with PostHog so person profiles get created.
    // Runs on initial load (restored session), login, and logout.
    if (currentUser) {
      identify(currentUser.uid, {
        email: currentUser.email ?? undefined,
        name: currentUser.displayName ?? undefined,
      });
    } else if (previousUser.value) {
      // Only reset if we're transitioning from signed-in to signed-out,
      // so anonymous visitors aren't reset on every page load.
      resetPostHog();
    }

    previousUser.value = user.value;
    user.value = currentUser;
    isInitialLoad.value = false;
  });
});

const isAuthenticated = computed(() => !!user.value);

const isOnGridPage = computed(() =>
  // The marketing homepage embeds a demo <Grid> that populates
  // layoutStore.currentLayout; exclude it so the TopBar / title editor
  // / "Claim my Grid" CTA don't show up on the landing page.
  route.path.startsWith("/grid") ||
  (!!layoutStore.currentLayout && !layoutStore.isDemoLayout)
);

const showTitleEditor = computed(() => {
  return isOnGridPage.value;
});

const showTopBar = computed(() => {
  return showTitleEditor.value;
});

// ── TopBar height → CSS custom property ──────────────────────────
// The floating BreakpointSwitcher reads --topbar-height to position
// itself below the TopBar without overlapping.
const topBarRef = ref<HTMLElement | null>(null);

const updateTopBarHeight = () => {
  nextTick(() => {
    if (showTopBar.value && topBarRef.value) {
      const h = topBarRef.value.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--topbar-height', `${h}px`);
    } else {
      document.documentElement.style.setProperty('--topbar-height', '0px');
    }
  });
};

watch(showTopBar, updateTopBarHeight, { immediate: true });

onMounted(updateTopBarHeight);

onUnmounted(() => {
  document.documentElement.style.setProperty('--topbar-height', '0px');
});
</script>

<style lang="scss">
.top-bar {
  position: fixed;
  /* Offset below the ViewportWarning banner when it's visible.
     --viewport-warning-height is set dynamically by ViewportWarning.vue. */
  top: var(--viewport-warning-height, 0px);
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