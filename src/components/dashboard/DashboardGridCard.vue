<template>
  <li
    class="grid-card"
    :class="{ 'is-drag-over': isDragOver }"
    :draggable="draggable"
    @dragstart="$emit('dragstart', $event, layout.id)"
    @dragover="$emit('dragover', $event, layout.id)"
    @drop="$emit('drop', $event, layout.id)"
    @dragend="$emit('dragend', $event, layout.id)"
  >
    <router-link :to="`/grid/${layout.id}`" class="grid-link">
      <DashboardGridStarButton
        :grid-id="layout.id"
        :is-starred="isStarred"
        @toggle-star="$emit('toggle-star', $event)"
      />
      <span class="grid-name">{{ layout.name }}
        <svg class="grid-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>

      <DashboardGridUpdatedLabel :layout="layout" />

      <DashboardGridCardActions
        :layout="layout"
        :is-default-grid="isDefaultGrid"
        :split-menu-open="splitMenuOpen"
        @toggle-default="$emit('toggle-default', $event)"
        @duplicate="(l, depth) => $emit('duplicate', l, depth)"
        @toggle-split-menu="$emit('toggle-split-menu', $event)"
        @rename="$emit('rename', $event)"
        @delete="$emit('delete', $event)"
      />
    </router-link>
  </li>
</template>

<script setup>
import DashboardGridStarButton from './DashboardGridStarButton.vue';
import DashboardGridUpdatedLabel from './DashboardGridUpdatedLabel.vue';
import DashboardGridCardActions from './DashboardGridCardActions.vue';

defineProps({
  layout: { type: Object, required: true },
  isDefaultGrid: { type: Boolean, default: false },
  isStarred: { type: Boolean, default: false },
  splitMenuOpen: { type: Boolean, default: false },
  draggable: { type: Boolean, default: false },
  isDragOver: { type: Boolean, default: false },
});

defineEmits([
  'toggle-star',
  'toggle-default',
  'duplicate',
  'toggle-split-menu',
  'rename',
  'delete',
  'dragstart',
  'dragover',
  'drop',
  'dragend',
]);
</script>

<style scoped>
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
  background-color: var(--color-content-background);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-primary);
  transition: all var(--duration-normal) var(--easing-smooth);
  cursor: pointer;
  flex: 1;
}

.grid-link:hover {
  background-color: var(--color-tile-background);
}

.grid-link:hover :deep(.star-lead:not(.is-starred)) {
  background-color: var(--color-base-8);
  color: var(--color-text-primary);
}

.grid-name {
  flex: 1;
  min-width: 0;
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
  transform: translateX(0);
}

.grid-card.is-drag-over .grid-link {
  outline: 1px dashed var(--color-content-default);
  outline-offset: 2px;
}
</style>
