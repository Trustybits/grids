<template>
  <div id="app">
    <AppStatusBanners
      :is-stubbed-mode="isStubbedMode"
      :show-viewport-warning="!isMarketingPage"
    />

    <!-- Left Navigation Bar (hidden on marketing pages like /pricing) -->
    <LeftNavBar v-if="isAuthenticated && !isMarketingPage && !mobile2ChromeActive" />

    <!-- Mobile 2.0 top app bar + menu drawer (replaces desktop top-bar / dashboard header) -->
    <template v-if="mobile2ChromeActive">
      <MobileAppBar
        :mode="mobile2HomeActive ? 'home' : 'grid'"
        @open-menu="isMobileMenuOpen = true"
        @new-grid="handleNewGrid"
      />
      <MobileMenuDrawer
        :open="isMobileMenuOpen"
        @close="isMobileMenuOpen = false"
      />
    </template>

    <!-- Top Bar for Grid Name Editor -->
    <div ref="topBarRef" class="top-bar" v-else-if="showTopBar">
      <GridNameEditor v-if="showTitleEditor" :isAuthenticated="isAuthenticated" />
    </div>

    <!-- Main Content Area -->
    <div class="main-content" :class="{ 'has-left-nav': isAuthenticated && !isMarketingPage }">
      <router-view />
    </div>

    <!-- Global bottom-left buttons (Share, Discord, UserMenu, GridMenu) -->
    <BottomLeftButtons v-if="!hideBottomCornerButtons && !mobile2ChromeActive" />

    <!-- Mobile 2.0 bottom command bar (owner editing chrome on mobile) -->
    <MobileGridBar v-if="mobile2GridActive" />

    <!-- Toast Notifications -->
    <ToastContainer />

    <!-- Pixel Racers Game (Easter Egg) -->
    <PixelRacersGame />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LeftNavBar from './components/grid/LeftNavBar.vue';
import BottomLeftButtons from './components/app/AppBar.vue';
import MobileGridBar from './components/app/MobileGridBar.vue';
import MobileAppBar from './components/app/MobileAppBar.vue';
import MobileMenuDrawer from './components/app/MobileMenuDrawer.vue';
import GridNameEditor from './components/grid/GridNameEditor.vue';
import ToastContainer from './components/ui-controls/ToastContainer.vue';
import PixelRacersGame from './components/grid/PixelRacersGame.vue';
import AppStatusBanners from './components/app/AppStatusBanners.vue';
import { useGridSessionStore } from '@/stores/grid/gridSession';
import { useGridController } from '@/controllers/useGridController';
import { getServiceFactory } from '@/services/ServiceFactorySingleton';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import type { AuthUser } from '@grids/contracts/auth';
import { usePostHog } from '@/composables/usePostHog';
import { useFeatureFlags } from '@/composables/useFeatureFlags';
import { initTier } from '@/composables/useTier';
import { initContributions } from '@/composables/useContributions';
import { initMobileExperience, useMobileExperience } from '@/composables/useMobileExperience';
import { isMarketingPath, isNonGridPath } from '@/constants/marketing';

withDefaults(
  defineProps<{
    isStubbedMode?: boolean;
  }>(),
  {
    isStubbedMode: false,
  },
);

const { identify, reset: resetPostHog } = usePostHog();
const { reloadFlags } = useFeatureFlags();
const { isMobile2 } = useMobileExperience();

const route = useRoute();
const router = useRouter();
const sessionStore = useGridSessionStore();
const controller = useGridController();
const isMarketingPage = computed(() => isMarketingPath(route.path));
const hideBottomCornerButtons = isMarketingPage;

const user = ref<AuthUser | null>(null);
const previousUser = ref<AuthUser | null>(null);
const isInitialLoad = ref(true);
const isMobileMenuOpen = ref(false);

onMounted(() => {
  // Boot global tier + contribution listeners once for the app session.
  // (Badges are subscribed to per-component via useBadges since they're
  // public and may be needed for visited profile pages, not just self.)
  initTier();
  initContributions();
  initMobileExperience();

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
      // Refresh flags now that PostHog knows who this is — user-targeted
      // rollouts (e.g. beta-mobile-2) don't apply until flags reload.
      void reloadFlags();
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

// Routes that are definitely NOT grid pages. Must stay in sync with
// NON_GRID_PATHS in BottomLeftButtons.vue.

const isOnGridPage = computed(() => {
  const path = route.path;
  if (path.startsWith("/grid/")) return true;
  if (isNonGridPath(path)) return false;
  // Slug routes (/:slug) that loaded a real grid
  return !!sessionStore.currentGrid && !sessionStore.isDemoGrid;
});

const isOnDashboard = computed(() => route.path.startsWith("/dashboard"));

// Mobile 2.0 owner editing chrome: the redesigned bottom bar replaces the
// desktop tile toolbar + bottom corner buttons for enrolled owners on mobile.
const mobile2GridActive = computed(
  () => isMobile2.value && isOnGridPage.value && sessionStore.isOwner,
);

// The mobile home chrome (dashboard): the AppBar + drawer replace the
// LeftNavBar, bottom corner buttons, and the dashboard's own header.
const mobile2HomeActive = computed(
  () => isMobile2.value && isAuthenticated.value && isOnDashboard.value,
);

// Any page where the Mobile 2.0 top AppBar + menu drawer are shown.
const mobile2ChromeActive = computed(
  () => mobile2GridActive.value || mobile2HomeActive.value,
);

const handleNewGrid = async () => {
  isMobileMenuOpen.value = false;
  const id = await controller.createGrid("Untitled Grid");
  if (id) router.push(`/grid/${id}`);
};

// Clear stale layout state when navigating away from a grid page.
// Lives here (not BottomLeftButtons) so it fires even when that
// component is unmounted (e.g. on /pricing).
watch(
  () => route.path,
  (newPath, oldPath) => {
    const wasOnGrid =
      oldPath?.startsWith("/grid/") ||
      (oldPath != null && !isNonGridPath(oldPath));
    const isOnGrid =
      newPath.startsWith("/grid/") || !isNonGridPath(newPath);

    if (wasOnGrid && !isOnGrid) {
      controller.clearSession();
    }
  },
  { flush: "pre" },
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
  top: var(--app-status-banners-height, 0px);
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  z-index: var(--z-topbar);
  pointer-events: none;
  background-color: transparent;
}

.top-bar > * {
  pointer-events: auto;
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
