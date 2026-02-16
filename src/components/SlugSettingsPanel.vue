<template>
  <div class="settings-panel">
    <div class="settings-section">
      <div class="section-header">
        <h3>Personal Handle</h3>
        <p class="section-description">
          Your unique handle for sharing your grid. 
          <span v-if="userSlug" class="current-url">
            Current: <a :href="`/${userSlug}`" target="_blank">grids.so/{{ userSlug }}</a>
          </span>
        </p>
      </div>
      
      <button class="settings-btn" @click="openSlugModal">
        {{ userSlug ? 'Change Handle' : 'Claim Handle' }}
      </button>
    </div>

    <div v-if="userSlug" class="settings-section">
      <div class="section-header">
        <h3>Default Grid</h3>
        <p class="section-description">
          Choose which grid loads when someone visits your personal URL (grids.so/{{ userSlug }})
        </p>
      </div>

      <div class="grid-selector">
        <select 
          v-model="selectedGridId" 
          @change="handleDefaultGridChange"
          :disabled="isSavingGrid || layouts.length === 0"
          class="grid-select"
        >
          <option :value="null">No default grid</option>
          <option 
            v-for="layout in layouts" 
            :key="layout.id" 
            :value="layout.id"
          >
            {{ layout.name || 'Untitled Grid' }}
          </option>
        </select>
        
        <span v-if="isSavingGrid" class="saving-indicator">Saving...</span>
        <span v-else-if="saveSuccess" class="save-success">✓ Saved</span>
      </div>

      <p v-if="layouts.length === 0" class="no-grids-message">
        You don't have any grids yet. Create one first!
      </p>
    </div>

    <SlugClaimModal
      :is-open="isSlugModalOpen"
      :current-slug="userSlug"
      @close="closeSlugModal"
      @success="handleSlugSuccess"
    />

    <SuccessToast
      :show="showSuccessToast"
      :message="successMessage"
      :duration="3000"
      @close="showSuccessToast = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { auth } from '@/firebase';
import { getUserProfile, setDefaultGrid } from '@/services/UserProfileService';
import { useLayoutStore } from '@/stores/layout';
import SlugClaimModal from './SlugClaimModal.vue';
import SuccessToast from './SuccessToast.vue';

const layoutStore = useLayoutStore();
const isSlugModalOpen = ref(false);
const userSlug = ref<string | undefined>(undefined);
const selectedGridId = ref<string | null>(null);
const isSavingGrid = ref(false);
const saveSuccess = ref(false);
const showSuccessToast = ref(false);
const successMessage = ref('');

const layouts = computed(() => layoutStore.layouts);

/**
 * Load user profile data
 */
const loadUserProfile = async () => {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  try {
    const profile = await getUserProfile(userId);
    if (profile) {
      userSlug.value = profile.slug;
      selectedGridId.value = profile.defaultGridId || null;
    }
  } catch (error) {
    console.error('Failed to load user profile:', error);
  }
};

/**
 * Handle default grid selection change
 */
const handleDefaultGridChange = async () => {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  isSavingGrid.value = true;
  saveSuccess.value = false;

  try {
    await setDefaultGrid(userId, selectedGridId.value);
    saveSuccess.value = true;
    
    // Clear success message after 2 seconds
    setTimeout(() => {
      saveSuccess.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to set default grid:', error);
    // Revert selection on error
    await loadUserProfile();
  } finally {
    isSavingGrid.value = false;
  }
};

/**
 * Open slug claim modal
 */
const openSlugModal = () => {
  isSlugModalOpen.value = true;
};

/**
 * Close slug claim modal
 */
const closeSlugModal = () => {
  isSlugModalOpen.value = false;
};

/**
 * Handle successful slug claim/update
 */
const handleSlugSuccess = async (newSlug: string) => {
  // Close the modal
  isSlugModalOpen.value = false;
  
  // Reload profile to get fresh data
  await loadUserProfile();
  
  // Show success confirmation toast
  successMessage.value = `Handle updated to @${newSlug}`;
  showSuccessToast.value = true;
};

onMounted(() => {
  loadUserProfile();
});

// Watch for layout changes
watch(() => layoutStore.layouts, () => {
  // If the selected grid was deleted, clear the selection
  if (selectedGridId.value && !layouts.value.find(l => l.id === selectedGridId.value)) {
    selectedGridId.value = null;
  }
});
</script>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg);
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-lg);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.section-description {
  margin: 0;
  font-size: 14px;
  color: var(--color-content-default);
  line-height: 1.5;
}

.current-url {
  display: block;
  margin-top: var(--spacing-xs);
  font-weight: 500;
}

.current-url a {
  color: var(--primary-color);
  text-decoration: none;
  transition: color var(--duration-fast) var(--easing-smooth);
}

.current-url a:hover {
  color: var(--color-content-high);
  text-decoration: underline;
}

.settings-btn {
  align-self: flex-start;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--primary-color);
  color: var(--color-text-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-smooth);
  font-family: var(--font-family-base);
}

.settings-btn:hover {
  background-color: var(--color-content-high);
}

.grid-selector {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.grid-select {
  flex: 1;
  max-width: 400px;
  padding: var(--spacing-sm);
  background-color: var(--color-content-background);
  color: var(--color-text-primary);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: var(--font-family-base);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--easing-smooth);
}

.grid-select:focus {
  outline: none;
  border-color: var(--color-content-high);
}

.grid-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.saving-indicator {
  font-size: 13px;
  color: var(--color-content-default);
}

.save-success {
  font-size: 13px;
  color: #4ade80;
  font-weight: 500;
}

.no-grids-message {
  margin: 0;
  font-size: 13px;
  color: var(--color-content-low);
  font-style: italic;
}
</style>
