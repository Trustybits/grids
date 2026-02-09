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
              <span class="grid-name">{{ layout.name }}</span>
              <svg class="grid-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </router-link>
          </li>
        </ul>
      </div>

      <div class="settings-section">
        <h2>Profile Settings</h2>
        <SlugSettingsPanel />
      </div>
    </div>

    <!-- Create Grid Modal -->
    <CreateGridModal 
      :show="showCreateModal" 
      @close="closeModal" 
      @create="handleCreateGrid" 
    />
  </div>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLayoutStore } from '@/stores/layout';
import { usePageTitle } from '@/composables/usePageTitle';
import CreateGridModal from './CreateGridModal.vue';
import SlugSettingsPanel from './SlugSettingsPanel.vue';

const layoutStore = useLayoutStore();
const router = useRouter();

// Set page title
const pageTitle = ref('Dashboard');
usePageTitle(pageTitle);

const layouts = computed(() => layoutStore.layouts);
const isLoading = computed(() => layoutStore.isLoading);

const showCreateModal = ref(false);

onMounted(() => {
  layoutStore.fetchLayouts();
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
      closeModal();
      router.push(`/grid/${newLayoutId}`);
    }
  } catch (error) {
    console.error('Error creating layout:', error.message);
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
  background-color: var(--color-content-high);
  color: var(--color-text-primary);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
}

.new-grid-button:hover {
  background-color: var(--color-content-low);
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
  gap: var(--spacing-sm);
  list-style: none;
  padding: 0;
  margin: 0;
}

.grid-card {
  list-style: none;
}

.grid-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-primary);
  transition: all var(--duration-normal) var(--easing-smooth);
  cursor: pointer;
}

.grid-link:hover {
  background-color: var(--color-content-low);
  border-color: var(--color-content-default);
  transform: translateX(4px);
}

.grid-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: var(--color-content-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm);
  color: var(--color-content-default);
  flex-shrink: 0;
  transition: all var(--duration-fast) var(--easing-smooth);
}

.grid-link:hover .grid-icon {
  background-color: var(--color-content-high);
  color: var(--color-text-primary);
}

.grid-name {
  flex: 1;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.grid-arrow {
  color: var(--color-content-default);
  opacity: 0;
  transform: translateX(-4px);
  transition: all var(--duration-fast) var(--easing-smooth);
  flex-shrink: 0;
}

.grid-link:hover .grid-arrow {
  opacity: 1;
  transform: translateX(0);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.settings-section h2 {
  font-size: var(--font-size-xl);
  margin: 0;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}
</style>
