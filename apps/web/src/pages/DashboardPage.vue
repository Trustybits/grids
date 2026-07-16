<template>
  <div class="dashboard" :class="{ 'dashboard--mobile2': isMobile2 }">
    <div class="dashboard-sections">
      <PendingGridTransfers @accepted="onTransferAccepted" />
      <!--
        On mobile 2.0 the "Your Grids" title and "New Grid" action live in the
        global MobileAppBar, so the in-page header is hidden to avoid duplication.
      -->
      <div v-if="!isMobile2" class="dashboard-header">
        <h2>Your Grids</h2>
        <Button variant="secondary" @click="promptAndCreateGrid" class="new-grid-button">
          New Grid
        </Button>
      </div>
      <div class="grid-list">
        <div v-if="isLoading" class="loading">Loading grids...</div>
        <div v-else-if="grids.length === 0" class="no-grids">
          You have no grids. Create one to get started!
        </div>
        <ul v-else class="grid-list">
          <DashboardGridCard
            v-for="grid in starredGrids"
            :key="grid.id"
            :grid="grid"
            :is-default-grid="grid.id === defaultGridId"
            :is-starred="true"
            :split-menu-open="splitMenuOpenFor === grid.id"
            :draggable="true"
            :is-drag-over="dragOverStarId === grid.id"
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
            v-if="starredGrids.length && unstarredGrids.length"
            class="grid-list-divider"
            aria-hidden="true"
          />
          <DashboardGridCard
            v-for="grid in unstarredGrids"
            :key="grid.id"
            :grid="grid"
            :is-default-grid="grid.id === defaultGridId"
            :is-starred="false"
            :split-menu-open="splitMenuOpenFor === grid.id"
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

    <PromptModal
      :show="showCreateModal"
      title="Create New Grid"
      placeholder="Enter grid name..."
      confirm-label="Create Grid"
      variant="primary"
      @close="closeModal"
      @confirm="handleCreateGrid"
    />

    <PromptModal
      :show="showRenameModal"
      title="Rename Grid"
      placeholder="Enter new grid name..."
      :initial-value="gridToRename?.name || ''"
      :select-on-open="true"
      confirm-label="Rename"
      variant="primary"
      @close="closeRenameModal"
      @confirm="handleRenameGrid"
    />

    <PromptModal
      :show="showDeleteModal"
      :title="`Delete ${gridToDelete?.name || ''}`"
      :description='`Enter "${gridToDelete?.name || ""}" exactly to confirm deletion.`'
      :placeholder="gridToDelete?.name || ''"
      :require-match="gridToDelete?.name || ''"
      confirm-label="Delete"
      variant="danger"
      @close="closeDeleteModal"
      @confirm="handleDeleteGrid"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useGridCollectionStore } from "@/stores/grid/gridCollection";
import { useGridController } from "@/controllers/useGridController";
import { useMobileExperience } from "@/composables/useMobileExperience";
import { usePageTitle } from "@/composables/usePageTitle";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { useGridDuplicateStorage } from "@/composables/useGridDuplicateStorage";

const userService = getServiceFactory().getUserService();
import { valueToMillis } from "@/utils/TimeConversion";
import type { Grid } from "@grids/contracts/types";
import type { CopyDepth } from "@grids/contracts/types";
import PromptModal from "@/components/modal/PromptModal.vue";
import DashboardGridCard from "@/components/dashboard/DashboardGridCard.vue";
import PendingGridTransfers from "@/components/dashboard/PendingGridTransfers.vue";
import Button from "@/components/ui-elements/Button.vue";

const collectionStore = useGridCollectionStore();
const controller = useGridController();
const router = useRouter();
const { resolveStoragePlan } = useGridDuplicateStorage();
const { isMobile2 } = useMobileExperience();

const pageTitle = ref("Dashboard");
usePageTitle(pageTitle);

const { grids, isLoading } = storeToRefs(collectionStore);

const showCreateModal = ref(false);
const showRenameModal = ref(false);
const showDeleteModal = ref(false);
const gridToRename = ref<Grid | null>(null);
const gridToDelete = ref<Grid | null>(null);
const defaultGridId = ref<string | null>(null);
const starredGridIds = ref<string[]>([]);
const draggedStarId = ref<string | null>(null);
const dragOverStarId = ref<string | null>(null);
const draggedStarInitialOrder = ref<string[] | null>(null);
const starDragCommitted = ref(false);

const starredSet = computed(() => new Set(starredGridIds.value));

const gridById = computed(() => {
  const m = new Map<string, Grid>();
  for (const grid of grids.value) {
    m.set(grid.id, grid);
  }
  return m;
});

const starredGrids = computed(() => {
  const map = gridById.value;
  return starredGridIds.value
    .map((id) => map.get(id))
    .filter((grid): grid is Grid => !!grid);
});

const unstarredGrids = computed(() =>
  [...grids.value]
    .filter((grid) => !starredSet.value.has(grid.id))
    .sort((a, b) => {
      const aScore =
        valueToMillis(a.updatedAt) || valueToMillis(a.createdAt) || 0;
      const bScore =
        valueToMillis(b.updatedAt) || valueToMillis(b.createdAt) || 0;
      return bScore - aScore;
    }),
);

const loadUserProfile = async () => {
  const userId = getAuthProvider().getCurrentUserId();
  if (userId) {
    try {
      const profile = await userService.getUserProfile(userId);
      if (profile) {
        defaultGridId.value = profile.defaultGridId || null;
        const raw = profile.starredGridIds;
        starredGridIds.value = Array.isArray(raw)
          ? raw.filter((id) => typeof id === "string")
          : [];
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  }
};

const toggleDefaultGrid = async (gridId: string) => {
  const userId = getAuthProvider().getCurrentUserId();
  if (!userId) return;

  try {
    const newDefaultId = defaultGridId.value === gridId ? null : gridId;
    await userService.setDefaultGrid(userId, newDefaultId);
    defaultGridId.value = newDefaultId;
  } catch (error) {
    console.error("Error setting default grid:", error);
  }
};

const toggleStarGrid = async (gridId: string) => {
  const userId = getAuthProvider().getCurrentUserId();
  if (!userId) return;

  const prev = [...starredGridIds.value];
  const idx = prev.indexOf(gridId);
  const next =
    idx !== -1 ? prev.filter((id) => id !== gridId) : [...prev, gridId];

  starredGridIds.value = next;
  try {
    await userService.updateUserProfile(userId, { starredGridIds: next });
  } catch (error) {
    console.error("Error updating starred grids:", error);
    starredGridIds.value = prev;
  }
};

const saveStarredOrder = async (next: string[], previous: string[]) => {
  const userId = getAuthProvider().getCurrentUserId();
  if (!userId) {
    starredGridIds.value = previous;
    return;
  }
  starredGridIds.value = next;
  try {
    await userService.updateUserProfile(userId, { starredGridIds: next });
  } catch (error) {
    console.error("Error updating starred grid order:", error);
    starredGridIds.value = previous;
  }
};

const areSameOrder = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, idx) => id === b[idx]);

const onStarDragStart = (event: DragEvent, gridId: string) => {
  draggedStarId.value = gridId;
  draggedStarInitialOrder.value = [...starredGridIds.value];
  starDragCommitted.value = false;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", gridId);
  }
};

const onStarDragOver = (event: DragEvent, gridId: string) => {
  if (!draggedStarId.value || draggedStarId.value === gridId) return;
  event.preventDefault();
  dragOverStarId.value = gridId;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }

  const current = [...starredGridIds.value];
  const fromIndex = current.indexOf(draggedStarId.value);
  const toIndex = current.indexOf(gridId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

  current.splice(fromIndex, 1);
  current.splice(toIndex, 0, draggedStarId.value);
  starredGridIds.value = current;
};

const onStarDrop = async (event: DragEvent) => {
  event.preventDefault();
  dragOverStarId.value = null;
  starDragCommitted.value = true;

  const previous = draggedStarInitialOrder.value || [...starredGridIds.value];
  const next = [...starredGridIds.value];
  if (!areSameOrder(next, previous)) {
    await saveStarredOrder(next, previous);
  }
};

const onStarDragEnd = async () => {
  if (!starDragCommitted.value && draggedStarInitialOrder.value) {
    starredGridIds.value = [...draggedStarInitialOrder.value];
  }
  draggedStarId.value = null;
  dragOverStarId.value = null;
  draggedStarInitialOrder.value = null;
  starDragCommitted.value = false;
};

const splitMenuOpenFor = ref<string | null>(null);

const toggleSplitMenu = (gridId: string) => {
  splitMenuOpenFor.value =
    splitMenuOpenFor.value === gridId ? null : gridId;
};

const closeSplitMenu = () => {
  splitMenuOpenFor.value = null;
};

onMounted(() => {
  controller.fetchGrids();
  loadUserProfile();
  document.addEventListener("click", closeSplitMenu);
});

onUnmounted(() => {
  document.removeEventListener("click", closeSplitMenu);
});

// A newly accepted transfer makes the grid ours; pull the updated list so it
// appears on the dashboard (and refresh the profile for any default changes).
const onTransferAccepted = async () => {
  await controller.fetchGrids();
  await loadUserProfile();
};

const promptAndCreateGrid = () => {
  showCreateModal.value = true;
};

const closeModal = () => {
  showCreateModal.value = false;
};

const handleCreateGrid = async (name: string) => {
  try {
    const newGridId = await controller.createGrid(name);
    if (newGridId) {
      if (!defaultGridId.value) {
        // Optimistic local update for immediate dashboard UI. Server-side
        // persistence is handled by the assignDefaultGridOnCreate trigger,
        // which sets the default only when the user has none and skips
        // duplicates.
        defaultGridId.value = newGridId;
      }
      closeModal();
      router.push(`/grid/${newGridId}`);
    }
  } catch (error) {
    console.error("Error creating grid:", error);
  }
};

const openRenameModal = (grid: Grid) => {
  gridToRename.value = grid;
  showRenameModal.value = true;
};

const closeRenameModal = () => {
  showRenameModal.value = false;
  gridToRename.value = null;
};

const handleRenameGrid = async (newName: string) => {
  if (!gridToRename.value) return;

  try {
    await controller.renameGrid(gridToRename.value.id, newName);
    closeRenameModal();
  } catch (error) {
    console.error("Error renaming grid:", error);
    alert("Failed to rename grid. Please try again.");
  }
};

const duplicateGrid = async (grid: Grid, copyDepth: CopyDepth = "full") => {
  splitMenuOpenFor.value = null;
  try {
    const storagePlan = await resolveStoragePlan(grid, copyDepth);
    if (storagePlan === null) return;
    const newId = await controller.duplicateGrid(
      grid,
      copyDepth,
      storagePlan,
    );
    if (newId) {
      router.push(`/grid/${newId}`);
    }
  } catch (error) {
    console.error("Error duplicating grid:", error);
    alert(
      error instanceof Error
        ? error.message
        : "Failed to duplicate grid. Please try again.",
    );
  }
};

const persistStarredAfterDelete = async (deletedId: string) => {
  const userId = getAuthProvider().getCurrentUserId();
  if (!userId) return;
  const next = starredGridIds.value.filter((id) => id !== deletedId);
  if (next.length === starredGridIds.value.length) return;
  starredGridIds.value = next;
  try {
    await userService.updateUserProfile(userId, { starredGridIds: next });
  } catch (error) {
    console.error("Error updating starred grids after delete:", error);
  }
};

const confirmDeleteGrid = (grid: Grid) => {
  splitMenuOpenFor.value = null;
  gridToDelete.value = grid;
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  gridToDelete.value = null;
};

const handleDeleteGrid = async () => {
  if (!gridToDelete.value) return;
  const grid = gridToDelete.value;

  try {
    await controller.deleteGrid(grid.id);
    await persistStarredAfterDelete(grid.id);

    if (defaultGridId.value === grid.id) {
      const userId = getAuthProvider().getCurrentUserId();
      if (userId) {
        await userService.setDefaultGrid(userId, null);
        defaultGridId.value = null;
      }
    }
    closeDeleteModal();
  } catch (error) {
    console.error("Error deleting grid:", error);
    alert("Failed to delete grid. Please try again.");
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

/* Clear the fixed MobileAppBar (which hosts the dashboard title + New Grid). */
.dashboard--mobile2 {
  align-items: flex-start;
  padding-top: calc(
    var(--app-status-banners-height, 0px) + var(--spacing-3xl)
  );
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
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.grid-list {
  background-color: transparent;
}

.loading,
.no-grids {
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
