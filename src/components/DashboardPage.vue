<template>
  <div class="dashboard">
    <div class="dashboard-sections">
      <div class="dashboard-header">
        <h2>Your Grids</h2>
        <button @click="promptAndCreateLayout" class="new-grid-button">
          New Grid
        </button>
      </div>
      <div class="layout-list">
        <div v-if="isLoading" class="loading">Loading grids...</div>
        <div v-else-if="layouts.length === 0" class="no-layouts">
          You have no grids. Create one to get started!
        </div>
        <ul v-else class="grid-list">
          <li
            v-for="layout in layouts"
            :key="layout.id"
            class="grid-card"
          >
            <router-link :to="`/grid/${layout.id}`" class="grid-link">
              <div class="grid-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </div>
              <span class="grid-name">{{ layout.name }}
                <svg class="grid-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>

              <div class="grid-actions">
              <button 
                @click.prevent="toggleDefaultGrid(layout.id)"
                :class="['action-button', 'default-grid-button', { 'is-default': layout.id === defaultGridId }]"
                :title="layout.id === defaultGridId ? 'Default grid - this is what shows at your public homepage' : 'Set as default grid'"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </button>
              <button 
                @click.prevent="openRenameModal(layout)"
                class="action-button rename-button"
                title="Rename grid"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button 
                @click.prevent="confirmDeleteGrid(layout)"
                class="action-button delete-button"
                title="Delete grid"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 6h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M10 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M14 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            </router-link>
          </li>
        </ul>
      </div>
    </div>

    <!-- Create Grid Modal -->
    <CreateGridModal 
      :show="showCreateModal" 
      @close="closeModal" 
      @create="handleCreateGrid" 
    />

    <!-- Rename Grid Modal -->
    <RenameGridModal 
      :show="showRenameModal" 
      :current-name="gridToRename?.name || ''"
      @close="closeRenameModal" 
      @rename="handleRenameGrid" 
    />
  </div>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLayoutStore } from '@/stores/layout';
import { usePageTitle } from '@/composables/usePageTitle';
import { getUserProfile, setDefaultGrid } from '@/services/UserProfileService';
import { getAuth } from 'firebase/auth';
import CreateGridModal from './CreateGridModal.vue';
import RenameGridModal from './RenameGridModal.vue';

const layoutStore = useLayoutStore();
const router = useRouter();

// Set page title
const pageTitle = ref('Dashboard');
usePageTitle(pageTitle);

const layouts = computed(() => layoutStore.layouts);
const isLoading = computed(() => layoutStore.isLoading);

const showCreateModal = ref(false);
const showRenameModal = ref(false);
const gridToRename = ref(null);
const defaultGridId = ref(null);

// Load user profile to get default grid
const loadUserProfile = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    try {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        defaultGridId.value = profile.defaultGridId || null;
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }
};

// Toggle default grid
const toggleDefaultGrid = async (gridId) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  try {
    // If clicking the current default, unset it; otherwise set the new one
    const newDefaultId = defaultGridId.value === gridId ? null : gridId;
    await setDefaultGrid(user.uid, newDefaultId);
    defaultGridId.value = newDefaultId;
  } catch (error) {
    console.error('Error setting default grid:', error);
  }
};

onMounted(() => {
  layoutStore.fetchLayouts();
  loadUserProfile();
});

const promptAndCreateLayout = () => {
  showCreateModal.value = true;
};

const closeModal = () => {
  showCreateModal.value = false;
};

const handleCreateGrid = async (name) => {
  try {
    const newLayoutId = await layoutStore.createLayout(name);
    if (newLayoutId) {
      if (!defaultGridId.value) {
        defaultGridId.value = newLayoutId;
      }
      closeModal();
      router.push(`/grid/${newLayoutId}`);
    }
  } catch (error) {
    console.error('Error creating layout:', error.message);
  }
};

// Open rename modal for a specific grid
const openRenameModal = (layout) => {
  gridToRename.value = layout;
  showRenameModal.value = true;
};

// Close rename modal
const closeRenameModal = () => {
  showRenameModal.value = false;
  gridToRename.value = null;
};

// Handle renaming a grid
const handleRenameGrid = async (newName) => {
  if (!gridToRename.value) return;
  
  try {
    await layoutStore.renameLayout(gridToRename.value.id, newName);
    closeRenameModal();
  } catch (error) {
    console.error('Error renaming grid:', error);
    alert('Failed to rename grid. Please try again.');
  }
};

// Confirm and delete a grid
const confirmDeleteGrid = async (layout) => {
  const confirmed = confirm(`Are you sure you want to delete "${layout.name}"? This action cannot be undone.`);
  if (!confirmed) return;

  try {
    await layoutStore.deleteLayout(layout.id);
    
    // If the deleted grid was the default, clear the default
    if (defaultGridId.value === layout.id) {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        await setDefaultGrid(user.uid, null);
        defaultGridId.value = null;
      }
    }
  } catch (error) {
    console.error('Error deleting grid:', error);
    alert('Failed to delete grid. Please try again.');
  }
};

</script>

<style scoped>
.dashboard {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  min-height: 100vh;
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
}

.dashboard-sections {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  width: 100%;
  max-width: 900px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

h1 {
  font-size: var(--font-size-3xl);
  margin: 0;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
}

.new-grid-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--color-tile-background);
  color: var(--color-text-primary);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
}

.new-grid-button:hover {
  background-color: var(--color-base-34);
  border-color: var(--color-content-default);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.new-grid-button svg {
  color: var(--color-text-primary);
}

.layout-list {
  background-color: transparent;
}

.loading,
.no-layouts {
  text-align: center;
  padding: var(--spacing-xl) 0;
  font-size: var(--font-size-lg);
  color: var(--color-content-default);
}

.grid-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  list-style: none;
  padding: 0;
  margin: 0;
}

.grid-card {
  list-style: none;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.grid-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background-color: var(--color-tile-background);
  /* border: var(--tile-border-width) solid var(--color-tile-stroke); */
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-primary);
  transition: all var(--duration-normal) var(--easing-smooth);
  cursor: pointer;
  flex: 1;
}

.grid-link:hover {
  background-color: var(--color-content-background);
  border-color: var(--color-content-default);
}

.grid-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  /* background-color: var(--color-content-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm); */
  color: var(--color-content-low);
  flex-shrink: 0;
  transition: all var(--duration-fast) var(--easing-smooth);
}

.grid-link:hover .grid-icon {
  background-color: var(--color-base-8);
  border-color: var(--color-content-default);
  color: var(--color-text-primary);
}

.grid-name {
  flex: 1;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.grid-arrow {
  margin-left: var(--spacing-sm);
  color: var(--color-content-default);
  opacity: 0;
  transform: translateX(-4px);
  transition: all var(--duration-fast) var(--easing-smooth);
  flex-shrink: 0;
}

.grid-link:hover .grid-arrow {
  opacity: 1;
}

.grid-actions {
  display: flex;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: transparent;
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
  padding: 0;
}

.default-grid-button {
  color: var(--color-content-default);
  border: none;
  opacity: 0.4;
}

.default-grid-button:hover {
  opacity: 0.7;
  color: var(--color-text-primary);
}

.default-grid-button.is-default {
  color: #22c55e;
  opacity: 1;
  /* background-color: rgba(34, 197, 94, 0.1); */
  /* border-color: rgba(34, 197, 94, 0.3);
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.4); */
}

/* .default-grid-button.is-default:hover {
  background-color: rgba(34, 197, 94, 0.15);
  box-shadow: 0 0 16px rgba(34, 197, 94, 0.5);
} */

/* Rename button styling */
.rename-button {
  color: var(--color-content-default);
  border: none;
  opacity: 0.4;
}

.rename-button:hover {
  opacity: 0.7;
  color: var(--color-text-primary);
}

/* Delete button styling */
.delete-button {
  color: var(--color-content-default);
  border: none;
  opacity: 0.4;
}

.delete-button:hover {
  opacity: 1;
  color: #ef4444;
}
</style>
