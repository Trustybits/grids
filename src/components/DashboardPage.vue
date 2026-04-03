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

          <DashboardGridCard
            v-for="layout in starredLayouts"
            :key="layout.id"
            :layout="layout"
            :is-default-grid="layout.id === defaultGridId"
            :is-starred="true"
            :split-menu-open="splitMenuOpenFor === layout.id"
            :draggable="true"
            :is-drag-over="dragOverStarId === layout.id"
            @toggle-star="toggleStarGrid"
            @toggle-default="toggleDefaultGrid"
            @duplicate="duplicateGrid"
            @toggle-split-menu="toggleSplitMenu"
            @rename="openRenameModal"
            @delete="confirmDeleteGrid"
            @dragstart="onStarDragStart"
            @dragover="onStarDragOver"
            @drop="onStarDrop"
            @dragend="onStarDragEnd"
          />
          <li
            v-if="starredLayouts.length && unstarredLayouts.length"
            class="grid-list-divider"
            aria-hidden="true"
          />
          <DashboardGridCard
            v-for="layout in unstarredLayouts"
            :key="layout.id"
            :layout="layout"
            :is-default-grid="layout.id === defaultGridId"
            :is-starred="false"
            :split-menu-open="splitMenuOpenFor === layout.id"
            @toggle-star="toggleStarGrid"
            @toggle-default="toggleDefaultGrid"
            @duplicate="duplicateGrid"
            @toggle-split-menu="toggleSplitMenu"
            @rename="openRenameModal"
            @delete="confirmDeleteGrid"
          />
        </ul>
      </div>
    </div>

    <CreateGridModal
      :show="showCreateModal"
      @close="closeModal"
      @create="handleCreateGrid"
    />

    <RenameGridModal
      :show="showRenameModal"
      :current-name="gridToRename?.name || ''"
      @close="closeRenameModal"
      @rename="handleRenameGrid"
    />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLayoutStore } from '@/stores/layout';
import { usePageTitle } from '@/composables/usePageTitle';
import { getUserProfile, setDefaultGrid, updateUserProfile } from '@/services/UserProfileService';
import { getAuth } from 'firebase/auth';
import { firestoreValueToMillis } from '@/utils/firestoreTime';
import CreateGridModal from './CreateGridModal.vue';
import RenameGridModal from './RenameGridModal.vue';
import DashboardGridCard from './dashboard/DashboardGridCard.vue';

const layoutStore = useLayoutStore();
const router = useRouter();

const pageTitle = ref('Dashboard');
usePageTitle(pageTitle);

const layouts = computed(() => layoutStore.layouts);
const isLoading = computed(() => layoutStore.isLoading);

const showCreateModal = ref(false);
const showRenameModal = ref(false);
const gridToRename = ref(null);
const defaultGridId = ref(null);
const starredLayoutIds = ref([]);
const draggedStarId = ref(null);
const dragOverStarId = ref(null);
const draggedStarInitialOrder = ref(null);
const starDragCommitted = ref(false);

const starredSet = computed(() => new Set(starredLayoutIds.value));

const layoutById = computed(() => {
  const m = new Map();
  for (const l of layouts.value) {
    m.set(l.id, l);
  }
  return m;
});

const starredLayouts = computed(() => {
  const map = layoutById.value;
  return starredLayoutIds.value.map((id) => map.get(id)).filter(Boolean);
});

const unstarredLayouts = computed(() =>
  [...layouts.value]
    .filter((l) => !starredSet.value.has(l.id))
    .sort((a, b) => {
      const aScore =
        firestoreValueToMillis(a.updatedAt) ||
        firestoreValueToMillis(a.createdAt) ||
        0;
      const bScore =
        firestoreValueToMillis(b.updatedAt) ||
        firestoreValueToMillis(b.createdAt) ||
        0;
      return bScore - aScore;
    }),
);

const loadUserProfile = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    try {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        defaultGridId.value = profile.defaultGridId || null;
        const raw = profile.starredLayoutIds;
        starredLayoutIds.value = Array.isArray(raw)
          ? raw.filter((id) => typeof id === 'string')
          : [];
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }
};

const toggleDefaultGrid = async (gridId) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  try {
    const newDefaultId = defaultGridId.value === gridId ? null : gridId;
    await setDefaultGrid(user.uid, newDefaultId);
    defaultGridId.value = newDefaultId;
  } catch (error) {
    console.error('Error setting default grid:', error);
  }
};

const toggleStarGrid = async (gridId) => {
  const user = getAuth().currentUser;
  if (!user) return;

  const prev = [...starredLayoutIds.value];
  const idx = prev.indexOf(gridId);
  const next =
    idx !== -1
      ? prev.filter((id) => id !== gridId)
      : [...prev, gridId];

  starredLayoutIds.value = next;
  try {
    await updateUserProfile(user.uid, { starredLayoutIds: next });
  } catch (error) {
    console.error('Error updating starred grids:', error);
    starredLayoutIds.value = prev;
  }
};

const saveStarredOrder = async (next, previous) => {
  const user = getAuth().currentUser;
  if (!user) {
    starredLayoutIds.value = previous;
    return;
  }
  starredLayoutIds.value = next;
  try {
    await updateUserProfile(user.uid, { starredLayoutIds: next });
  } catch (error) {
    console.error('Error updating starred grid order:', error);
    starredLayoutIds.value = previous;
  }
};

const areSameOrder = (a, b) =>
  a.length === b.length && a.every((id, idx) => id === b[idx]);

const onStarDragStart = (event, layoutId) => {
  draggedStarId.value = layoutId;
  draggedStarInitialOrder.value = [...starredLayoutIds.value];
  starDragCommitted.value = false;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', layoutId);
  }
};

const onStarDragOver = (event, layoutId) => {
  if (!draggedStarId.value || draggedStarId.value === layoutId) return;
  event.preventDefault();
  dragOverStarId.value = layoutId;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }

  const current = [...starredLayoutIds.value];
  const fromIndex = current.indexOf(draggedStarId.value);
  const toIndex = current.indexOf(layoutId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

  current.splice(fromIndex, 1);
  current.splice(toIndex, 0, draggedStarId.value);
  starredLayoutIds.value = current;
};

const onStarDrop = async (event) => {
  event.preventDefault();
  dragOverStarId.value = null;
  starDragCommitted.value = true;

  const previous = draggedStarInitialOrder.value || [...starredLayoutIds.value];
  const next = [...starredLayoutIds.value];
  if (!areSameOrder(next, previous)) {
    await saveStarredOrder(next, previous);
  }
};

const onStarDragEnd = async () => {
  if (!starDragCommitted.value && draggedStarInitialOrder.value) {
    starredLayoutIds.value = [...draggedStarInitialOrder.value];
  }
  draggedStarId.value = null;
  dragOverStarId.value = null;
  draggedStarInitialOrder.value = null;
  starDragCommitted.value = false;
};

const splitMenuOpenFor = ref(null);

const toggleSplitMenu = (layoutId) => {
  splitMenuOpenFor.value = splitMenuOpenFor.value === layoutId ? null : layoutId;
};

const closeSplitMenu = () => {
  splitMenuOpenFor.value = null;
};

onMounted(() => {
  layoutStore.fetchLayouts();
  loadUserProfile();
  document.addEventListener('click', closeSplitMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeSplitMenu);
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

const openRenameModal = (layout) => {
  gridToRename.value = layout;
  showRenameModal.value = true;
};

const closeRenameModal = () => {
  showRenameModal.value = false;
  gridToRename.value = null;
};

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

const duplicateGrid = async (layout, copyDepth = 'full') => {
  splitMenuOpenFor.value = null;
  try {
    const newId = await layoutStore.duplicateLayout(layout, copyDepth);
    if (newId) {
      router.push(`/grid/${newId}`);
    }
  } catch (error) {
    console.error('Error duplicating grid:', error);
    alert('Failed to duplicate grid. Please try again.');
  }
};

const persistStarredAfterDelete = async (deletedId) => {
  const user = getAuth().currentUser;
  if (!user) return;
  const next = starredLayoutIds.value.filter((id) => id !== deletedId);
  if (next.length === starredLayoutIds.value.length) return;
  starredLayoutIds.value = next;
  try {
    await updateUserProfile(user.uid, { starredLayoutIds: next });
  } catch (error) {
    console.error('Error updating starred grids after delete:', error);
  }
};

const confirmDeleteGrid = async (layout) => {
  const confirmed = confirm(`Are you sure you want to delete "${layout.name}"? This action cannot be undone.`);
  if (!confirmed) return;

  try {
    await layoutStore.deleteLayout(layout.id);
    await persistStarredAfterDelete(layout.id);

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

.grid-section-intro {
  list-style: none;
  margin: var(--spacing-md) 0 var(--spacing-xs);
  padding: 0;
}

.grid-section-intro:first-child {
  margin-top: 0;
}

.grid-section-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-content-default);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

.grid-list-divider {
  list-style: none;
  margin: var(--spacing-lg) 0;
  padding: 0;
  min-height: 1px;
  background: var(--color-tile-stroke);
  border: none;
}
</style>
