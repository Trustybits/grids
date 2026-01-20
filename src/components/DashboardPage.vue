<template>
  <div class="dashboard">
    <div class="dashboard-sections">
      <button @click="promptAndCreateLayout">NEW DISPLAY ➕</button>
      <h1>Recent Displays</h1>
      <div class="layout-list">
        <div v-if="isLoading" class="loading">Loading displays...</div>
        <div v-else-if="layouts.length === 0" class="no-layouts">
          You have no displays. Create one to get started!
        </div>

        <ul class="grid-list">
          <li
            v-for="layout in layouts"
            :key="layout.id"
            class="display-card layout-item"
            @click="goToLayout(layout.id)"
            style="cursor: pointer;"
          >
            <span class="display-link">{{ layout.name }}</span>
          </li>
          <li @click="promptAndCreateLayout" class="new-display-inline-button">
            NEW DISPLAY
          </li>
        </ul>
      </div>

      <h1>All Displays</h1>
      <div class="layout-list">
        <div v-if="isLoading" class="loading">Loading displays...</div>
        <div v-else-if="layouts.length === 0" class="no-layouts">
          You have no displays. Create one to get started!
        </div>
        <ul class="grid-list">
          <li
            v-for="layout in layouts"
            :key="layout.id"
            class="display-card layout-item"
          >
            <router-link :to="`/grid/${layout.id}`" class="display-link">
              {{ layout.name }}
            </router-link>
          </li>
          <li @click="promptAndCreateLayout" class="new-display-inline-button">
            NEW DISPLAY
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useLayoutStore } from '@/stores/layout';

const layoutStore = useLayoutStore();
const router = useRouter();

const layouts = computed(() => layoutStore.layouts);
const isLoading = computed(() => layoutStore.isLoading);

onMounted(() => {
  layoutStore.fetchLayouts();
});

const goToLayout = (id) => {
  router.push(`/grid/${id}`);
};

const promptAndCreateLayout = async () => {
  const name = prompt("Enter a name for your new layout:");

  if (name === null) return;

  try {
    const newLayoutId = await layoutStore.createLayout(name);
    if (newLayoutId) {
      router.push(`/grid/${newLayoutId}`);
    }
  } catch (error) {
    console.error('Error creating layout:', error.message);
  }
};

</script>

<style scoped>
.dashboard {
  padding: var(--spacing-xl);
  max-width: 800px;
  margin: 0 auto;
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
}

.dashboard-sections {
  display: flex;
  align-items: left;
  flex-direction: column;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-lg);

  button {
    border-radius: var(--radius-full);
    width: fit-content;
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--primary-color);
    color: var(--color-text-primary);
    border: none;
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--easing-smooth);
  }

  button:hover {
    background-color: var(--color-content-high);
  }
}

h1 {
  font-size: var(--font-size-2xl);
  margin: 0;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

.layout-list {
  border-top: var(--tile-border-width) solid var(--color-tile-stroke);
  padding: var(--spacing-md);
  padding-top: var(--spacing-xl);
  background-color: var(--color-tile-background);
  backdrop-filter: blur(20px);
  border-radius: var(--radius-lg);
}

.loading,
.no-layouts {
  text-align: center;
  margin-top: var(--spacing-md);
  font-size: var(--font-size-lg);
  color: var(--color-content-default);
}

ul {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: left;
  align-items: left;
  gap: var(--spacing-sm);

  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: var(--spacing-lg);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  background-color: var(--color-tile-background);
  border-radius: var(--radius-md);
  transition: background-color var(--duration-normal) var(--easing-smooth);
}

li:hover {
  background-color: var(--color-content-low);
}

.display-link {
  color: var(--color-text-primary);
  text-decoration: none;
}

.new-display-inline-button {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-content-default);
  background-color: var(--color-content-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  cursor: pointer;
}

a {
  text-decoration: none;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  border-bottom: 1px solid transparent;
  color: var(--color-text-primary);
  transition: border-color var(--duration-fast) var(--easing-smooth);
}

a:hover {
  border-bottom: 1px solid var(--color-content-high);
}
</style>
