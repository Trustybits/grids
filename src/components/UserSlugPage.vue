<template>
  <div class="slug-page">
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <div class="error-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4m0 4h.01" />
        </svg>
      </div>
      <h1>{{ errorTitle }}</h1>
      <p class="error-description">{{ errorMessage }}</p>
      
      <div class="cta-section">
        <p class="cta-text">Want to claim <strong>@{{ slug }}</strong>?</p>
        <router-link to="/login" class="cta-button">
          Create Account & Claim Handle
        </router-link>
        <router-link to="/" class="secondary-link">
          Or browse home
        </router-link>
      </div>
    </div>

    <!-- Display the grid directly at the slug URL -->
    <div v-else-if="gridLoaded" class="grid-container">
      <div class="background-image-container">
        <div :style="backgroundStyle" class="background-image-overlay"></div>
        
        <div class="layout-container">
          <!--
            Option B: Floating breakpoint switcher at top of viewport.
          -->
          <BreakpointSwitcher
            v-if="layoutStore.isOwner && switcherVariant === 'floating'"
            variant="floating"
          />

          <!--
            Toolbar area: tile-add buttons hidden during view-only preview
            (canEdit), breakpoint switcher stays visible for owners (isOwner).
          -->
          <div v-if="layoutStore.canEdit" class="toolbar">
            <div class="row">
              <div class="col-md-12">
                <!-- Option A: Inline — sits inside the toolbar row -->
                <div v-if="switcherVariant === 'inline'" class="toolbar-with-switcher">
                  <grid-buttons />
                  <BreakpointSwitcher variant="inline" />
                </div>
                <grid-buttons v-else />
              </div>
            </div>
            <!-- Option D: Toolbar-row — second row below the toolbar -->
            <BreakpointSwitcher
              v-if="switcherVariant === 'toolbar-row'"
              variant="toolbar-row"
            />
          </div>
          <!--
            View-only fallback: show just the switcher so owner can switch back.
          -->
          <div v-else-if="layoutStore.isOwner && switcherVariant === 'inline'" class="toolbar">
            <div class="row">
              <div class="col-md-12">
                <BreakpointSwitcher variant="inline" />
              </div>
            </div>
          </div>
          <div v-else-if="layoutStore.isOwner && switcherVariant === 'toolbar-row'" class="toolbar">
            <BreakpointSwitcher variant="toolbar-row" />
          </div>
          <grid :row-height="75" />
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePageTitle } from '@/composables/usePageTitle';
import { useDynamicFavicon } from '@/composables/useDynamicFavicon';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useLayoutStore } from '@/stores/layout';
import Grid from '@/components/Grid.vue';
import GridButtons from '@/components/TileButtons.vue';
import BreakpointSwitcher from '@/components/BreakpointSwitcher.vue';

// ── Breakpoint switcher placement (mirrors GridPage.vue) ─────
// Change this value to flip between the three UI placements:
//   "inline"      → Option A: sits inside the tile-add toolbar row
//   "floating"    → Option B: fixed pill near the top of the viewport
//   "toolbar-row" → Option D: second row stacked below the toolbar
type SwitcherVariant = 'inline' | 'floating' | 'toolbar-row';
const switcherVariant = 'floating' as SwitcherVariant;
import { useThemeStore } from '@/stores/theme';

const route = useRoute();
const layoutStore = useLayoutStore();
const themeStore = useThemeStore();
const isLoading = ref(true);
const error = ref(false);
const errorTitle = ref('Handle Not Found');
const errorMessage = ref('');
const slug = ref('');
const gridLoaded = ref(false);

const pageTitle = computed(() => slug.value ? `@${slug.value}` : undefined);
usePageTitle(pageTitle, '—');

// Find the first profile tile in the current layout and use its photo as the favicon
// This makes the favicon specific to each grid page rather than global per user
const profilePhotoUrl = computed(() => {
  const tiles = layoutStore.currentLayout?.tiles;
  if (!tiles) return null;
  
  // Find the first profile/bio tile
  const profileTile = tiles.find(tile => tile.content?.type === 'profile');
  if (!profileTile?.content) return null;
  
  // Type assertion since we know it's a profile tile
  const profileContent = profileTile.content as any;
  return profileContent.profilePhotoUrl || null;
});

useDynamicFavicon(profilePhotoUrl);

const backgroundStyle = computed(() => {
  return {
    backgroundImage: `url(${layoutStore.currentLayout?.backgroundImageSrc})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  };
});

/**
 * Resolve slug to user's default grid and load it directly
 */
const resolveSlug = async () => {
  slug.value = route.params.slug as string;
  
  if (!slug.value) {
    error.value = true;
    errorMessage.value = 'No handle provided.';
    isLoading.value = false;
    return;
  }

  try {
    // Get slug document from public slugs collection
    const slugRef = doc(db, 'slugs', slug.value.toLowerCase());
    const slugSnap = await getDoc(slugRef);
    
    if (!slugSnap.exists() || !slugSnap.data()?.userId) {
      error.value = true;
      errorMessage.value = `The handle "@${slug.value}" doesn't exist or is not currently in use.`;
      isLoading.value = false;
      return;
    }

    const slugData = slugSnap.data();
    
    // Check if user has set a default grid (stored in slugs collection for public access)
    if (!slugData.defaultGridId) {
      error.value = true;
      errorTitle.value = 'No Default Grid';
      errorMessage.value = `@${slug.value} hasn't set a default grid yet.`;
      isLoading.value = false;
      return;
    }

    // Load the grid directly using the layout store
    await layoutStore.loadLayout(slugData.defaultGridId);
    gridLoaded.value = true;
    isLoading.value = false;
  } catch (err) {
    console.error('Error resolving slug:', err);
    error.value = true;
    errorMessage.value = 'An error occurred while loading this handle.';
    isLoading.value = false;
  }
};

// Apply the grid's saved theme when the layout finishes loading
watch(
  () => layoutStore.currentLayout?.themeId,
  (themeId) => {
    themeStore.applyGridTheme(themeId);
  },
);

onMounted(() => {
  resolveSlug();
});

// Restore dark mode when leaving the slug page
onUnmounted(() => {
  themeStore.resetToAppDefault();
});
</script>

<style scoped>
.slug-page {
  min-height: 100vh;
  background-color: var(--color-content-background);
}

.slug-page:has(.loading-state),
.slug-page:has(.error-state) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
}

.grid-container {
  width: 100%;
  height: 100%;
}

.background-image-container {
  width: 100%;
  height: 100%;
}

.background-image-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}

.layout-container {
  padding-top: 2rem;
}

.toolbar {
  position: fixed;
  z-index: var(--z-dropdown);
  bottom: 0rem;
  left: 50vw;
  transform: translate(-50%, -10%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* Option A: inline — wraps tile buttons + breakpoint switcher in one row */
.toolbar-with-switcher {
  display: flex;
  align-items: center;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  text-align: center;
  max-width: 500px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-tile-stroke);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state p {
  margin: 0;
  color: var(--color-content-default);
  font-size: 14px;
}

.error-icon {
  color: var(--color-content-default);
}

.error-state h1 {
  margin: 0;
  font-size: 24px;
  color: var(--color-text-primary);
}

.error-description {
  margin: 0;
  color: var(--color-content-default);
  font-size: 14px;
  line-height: 1.5;
}

.cta-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-tile-stroke);
  width: 100%;
}

.cta-text {
  margin: 0;
  font-size: 16px;
  color: var(--color-text-primary);
}

.cta-button {
  padding: var(--spacing-md) var(--spacing-xl);
  background-color: var(--primary-color);
  color: var(--color-text-primary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 600;
  transition: all var(--duration-fast) var(--easing-smooth);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.cta-button:hover {
  background-color: var(--color-content-high);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.secondary-link {
  color: var(--color-content-default);
  text-decoration: none;
  font-size: 14px;
  transition: color var(--duration-fast) var(--easing-smooth);
}

.secondary-link:hover {
  color: var(--color-text-primary);
  text-decoration: underline;
}
</style>
