<template>
  <!-- 
    Global bottom-left button bar. Always visible, pinned to viewport corner.
    Visibility rules:
      - Discord: always shown for everyone
      - Share: shown only on grid pages (both /grid/:id and /:slug)
      - UseTemplate: shown on grid pages for non-owners when the grid allows duplication
      - UserMenu: shown for any authenticated user
      - GridMenu: shown only when viewing a grid the current user owns
  -->
  <div class="bottom-left-buttons">
    <FloatingTooltip
      v-if="!compact && showDiscordButton"
      text="Join our Discord"
      placement="right"
    >
      <DiscordButton />
    </FloatingTooltip>
    <FloatingTooltip v-if="!compact && isOnGridPage" text="Share" placement="right">
      <ShareButton />
    </FloatingTooltip>
    <FloatingTooltip
      v-if="!compact && isOnGridPage && !isOwner && isDuplicatable"
      text="Use this Grid as a Template"
      placement="right"
    >
      <UseTemplateButton />
    </FloatingTooltip>
    <!-- GridMenu and UserMenu render their own FloatingTooltip internally -->
    <GridMenu v-if="!compact && isOnGridPage && isOwner" />
    <UserMenu v-if="isAuthenticated" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import DiscordButton from "@/components/marketing/DiscordButton.vue";
import GridMenu from "@/components/grid/GridSettings.vue";
import ShareButton from "@/components/grid/ShareButton.vue";
import UseTemplateButton from "@/components/grid/UseTemplateButton.vue";
import UserMenu from "@/components/app/UserMenu.vue";
import FloatingTooltip from "@/components/ui-elements/FloatingTooltip.vue";
import { isNonGridPath } from "@/constants/marketing";

// When `compact` is set (Mobile 2.0 grid chrome), collapse to just the user
// menu so the redesigned bottom bar owns the other actions — while keeping the
// user menu reachable (it hosts the Mobile 2.0 opt-out) until the Phase 3 drawer.
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const route = useRoute();
const sessionStore = useGridSessionStore();
const isAuthenticated = ref(false);

onMounted(() => {
  getAuthProvider().onAuthStateChanged((user) => {
    isAuthenticated.value = !!user;
  });
});

// A "grid page" is either /grid/:id or a slug route (/:slug) that loaded a grid.
// Named routes like /dashboard, /login, /privacy, /terms are NOT grid pages.

const isOnGridPage = computed(() => {
  const path = route.path;
  // Explicit /grid/:id routes are always grid pages
  if (path.startsWith("/grid/")) return true;
  // Any top-level slug route (/:slug) counts as a grid page,
  // as long as it's not one of the known non-grid routes
  if (!isNonGridPath(path)) return true;
  return false;
});

// GridMenu shows when the logged-in user owns the currently loaded grid
const isOwner = computed(() => sessionStore.isOwner);

// UseTemplateButton shows when the grid owner has opted in to public duplication
const isDuplicatable = computed(
  () => sessionStore.currentGrid?.duplicatable ?? false,
);

// Hide Discord in bottom-left on marketing landing page.
const showDiscordButton = computed(() => route.path !== "/");
</script>

<style lang="scss" scoped>
.bottom-left-buttons {
  position: fixed;
  bottom: var(--spacing-md);
  /* Left edge aligns with the expanded LeftNavBar (also at --spacing-sm) */
  left: var(--spacing-sm);
  z-index: var(--z-fixed);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
</style>