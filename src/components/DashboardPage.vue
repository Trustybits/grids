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
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  font-family: 'Inter';
}

.dashboard-sections {
  display: flex;
  align-items: left;
  flex-direction: column;
  gap: 32px;
  margin-bottom: 1.5rem;

  button {
    border-radius: 20px;
    width: fit-content;
  }
}

h1 {
  font-size: 2rem;
  margin: 0;
}

.layout-list {
  border-top: 1px solid #ccc;
  padding: 16px;
  padding-top: 2rem;
  background-color: var(--tile-color);
  backdrop-filter: blur(20px);
}

.loading,
.no-layouts {
  text-align: center;
  margin-top: 1rem;
  font-size: 1.2rem;
}

ul {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: left;
  align-items: left;
  gap: 8px;

  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 20px;
  border: #cccccc0e solid 1px;
  background-color: var(--tile-color);
  border-radius: 16px;
  transition: background-color 0.5s ease-out;
}

li:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.display-link {
  color: white;
}

.new-display-inline-button {
  display: flex;
  justify-content: center;
  align-items: center;
  color: rgba(255, 255, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.001);
  border: #cccccc21 solid 1px;
  cursor: pointer;
}

a {
  text-decoration: none;
  font-size: 1.1rem;
  font-weight: bold;
  border-bottom: 1px solid transparent;
}

a:hover {
  border-bottom: 1px solid #000;
}
</style>
