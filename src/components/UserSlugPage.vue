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
          <div v-if="layoutStore.isOwner" class="toolbar">
            <div class="row">
              <div class="col-md-12">
                <grid-buttons />
              </div>
            </div>
          </div>
          <phone-preview-overlay :mode="layoutStore.previewMode" :url="pageUrl">
            <template #default="{ containerWidth }">
              <grid :row-height="75" :container-width="containerWidth" />
            </template>
          </phone-preview-overlay>
        </div>
      </div>

      <ShareButton />
      <GridMenu
        v-if="layoutStore.isOwner"
        @select-image="() => {}"
        @embed-background="() => {}"
        @confirm-delete="() => {}"
      />
      <Divider />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useLayoutStore } from '@/stores/layout';
import Grid from '@/components/Grid.vue';
import GridButtons from '@/components/TileButtons.vue';
import GridMenu from '@/components/GridMenu.vue';
import ShareButton from '@/components/ShareButton.vue';
import Divider from '@/components/Divider.vue';
import PhonePreviewOverlay from '@/components/PhonePreviewOverlay.vue';

const route = useRoute();
const layoutStore = useLayoutStore();
const isLoading = ref(true);
const error = ref(false);
const errorTitle = ref('Handle Not Found');
const errorMessage = ref('');
const slug = ref('');
const gridLoaded = ref(false);

const pageUrl = computed(() => window.location.href);

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

onMounted(() => {
  resolveSlug();
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
