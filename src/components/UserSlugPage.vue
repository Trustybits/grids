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
      <h1>Handle Not Found</h1>
      <p>The handle "{{ slug }}" doesn't exist.</p>
      <router-link to="/" class="home-link">Go to Home</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getUserIdBySlug, getUserProfile } from '@/services/UserProfileService';

const route = useRoute();
const router = useRouter();
const isLoading = ref(true);
const error = ref(false);
const slug = ref('');

/**
 * Resolve slug to user and redirect to their default grid
 */
const resolveSlug = async () => {
  slug.value = route.params.slug as string;
  
  if (!slug.value) {
    error.value = true;
    isLoading.value = false;
    return;
  }

  try {
    // Get user ID from slug
    const userId = await getUserIdBySlug(slug.value);
    
    if (!userId) {
      error.value = true;
      isLoading.value = false;
      return;
    }

    // Get user's default grid
    const profile = await getUserProfile(userId);
    
    if (profile?.defaultGridId) {
      // Redirect to their default grid
      await router.replace(`/grid/${profile.defaultGridId}`);
    } else {
      // User has a slug but no default grid set
      error.value = true;
      isLoading.value = false;
    }
  } catch (err) {
    console.error('Error resolving slug:', err);
    error.value = true;
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
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-content-background);
  padding: var(--spacing-lg);
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  text-align: center;
  max-width: 400px;
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

.error-state p {
  margin: 0;
  color: var(--color-content-default);
  font-size: 14px;
}

.home-link {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--primary-color);
  color: var(--color-text-primary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  transition: background-color var(--duration-fast) var(--easing-smooth);
}

.home-link:hover {
  background-color: var(--color-content-high);
}
</style>
