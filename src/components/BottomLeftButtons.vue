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
    <DiscordButton data-tooltip="Join our Discord" />
    <ShareButton v-if="isOnGridPage" data-tooltip="Share" />
    <UseTemplateButton
      v-if="isOnGridPage && !isOwner && isDuplicatable"
      data-tooltip="Use this Grid as a Template"
    />
    <!-- tooltips for GridMenu and UserMenu are contained in the components themselves -->
    <GridMenu v-if="isOnGridPage && isOwner" />
    <UserMenu v-if="isAuthenticated" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase";
import { useLayoutStore } from "@/stores/layout";
import DiscordButton from "./DiscordButton.vue";
import GridMenu from "./GridMenu.vue";
import ShareButton from "./ShareButton.vue";
import UseTemplateButton from "./UseTemplateButton.vue";
import UserMenu from "./UserMenu.vue";

const route = useRoute();
const layoutStore = useLayoutStore();
const isAuthenticated = ref(false);

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    isAuthenticated.value = !!user;
  });
});

// A "grid page" is either /grid/:id or a slug route (/:slug) that loaded a grid.
// Named routes like /dashboard, /login, /privacy, /terms are NOT grid pages.
const NON_GRID_PATHS = [
  "/",
  "/dashboard",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
  "/notion-callback",
];

const isOnGridPage = computed(() => {
  const path = route.path;
  // Explicit /grid/:id routes are always grid pages
  if (path.startsWith("/grid/")) return true;
  // Any top-level slug route (/:slug) counts as a grid page,
  // as long as it's not one of the known non-grid routes
  if (!NON_GRID_PATHS.includes(path)) return true;
  return false;
});

// Clear stale layout state when navigating away from a grid page.
// Without this, isOwner and currentLayout persist from the last grid
// and leak into non-grid routes like /dashboard.
watch(
  () => route.path,
  (newPath, oldPath) => {
    // Check if we're navigating FROM a grid page TO a non-grid page
    const wasOnGrid =
      oldPath?.startsWith("/grid/") ||
      (oldPath && !NON_GRID_PATHS.includes(oldPath));
    const isOnGrid =
      newPath.startsWith("/grid/") || !NON_GRID_PATHS.includes(newPath);

    if (wasOnGrid && !isOnGrid) {
      layoutStore.clearCurrentLayout();
    }
  },
  { flush: "pre" }, // Run before component re-renders to avoid flash of stale buttons
);

// GridMenu shows when the logged-in user owns the currently loaded grid
const isOwner = computed(() => layoutStore.isOwner);

// UseTemplateButton shows when the grid owner has opted in to public duplication
const isDuplicatable = computed(
  () => layoutStore.currentLayout?.duplicatable ?? false,
);
</script>

<style lang="scss" scoped>
.bottom-left-buttons {
  position: fixed;
  bottom: var(--spacing-md);
  left: var(--spacing-md);
  z-index: var(--z-fixed);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.bottom-left-buttons > [data-tooltip] {
  &::after {
    bottom: auto;
    left: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%) scale(0.9);
  }

  &:hover::after {
    transform: translateY(-50%) scale(1);
  }
}
</style>