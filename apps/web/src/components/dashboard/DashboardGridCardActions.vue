<template>
  <div class="grid-actions">
    <button
      @click.prevent="$emit('toggle-default', grid.id)"
      :data-tooltip="isDefaultGrid ? 'Default grid' : 'Set as default grid'"
      :class="[
        'action-button',
        'default-grid-button',
        { 'is-default': isDefaultGrid },
      ]"
    >
      <GlobeIcon :size="18" />
    </button>
    <div class="split-button" @click.prevent>
      <button
        @click.prevent="$emit('duplicate', grid, 'full')"
        data-tooltip="Duplicate grid"
        class="action-button duplicate-button split-main"
      >
        <DuplicateIcon :size="18" />
      </button>
      <button
        @click.prevent.stop="$emit('toggle-split-menu', grid.id)"
        class="action-button duplicate-button split-chevron"
        data-tooltip="More duplicate options"
      >
        <Chevron :size="10" />
      </button>
      <div v-if="splitMenuOpen" class="split-dropdown">
        <button
          @click.prevent.stop="$emit('duplicate', grid, 'structure')"
          class="split-dropdown-item"
        >
          Duplicate Structure Only
        </button>
      </div>
    </div>
    <button
      @click.prevent="$emit('rename', grid)"
      class="action-button rename-button"
      data-tooltip="Rename grid"
    >
      <EditIcon :size="18" />
    </button>
    <button
      @click.prevent="$emit('delete', grid)"
      data-tooltip="Delete grid"
      class="action-button delete-button"
    >
      <TrashIcon :size="18" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Grid } from "@grids/contracts/types";
import Chevron from "@/components/icons/Chevron.vue";
import GlobeIcon from "@/components/icons/GlobeIcon.vue";
import DuplicateIcon from "@/components/icons/DuplicateIcon.vue";
import EditIcon from "@/components/icons/EditIcon.vue";
import TrashIcon from "@/components/icons/toolbar/TrashIcon.vue";

defineProps<{
  grid: Grid;
  isDefaultGrid?: boolean;
  splitMenuOpen?: boolean;
}>();

defineEmits([
  "toggle-default",
  "duplicate",
  "toggle-split-menu",
  "rename",
  "delete",
]);
</script>

<style scoped>
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
}

.split-button {
  position: relative;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
}

.duplicate-button {
  color: var(--color-content-default);
  border: none;
  opacity: 0.4;
}

.duplicate-button:hover {
  opacity: 0.7;
  color: var(--color-text-primary);
}

.split-main {
  padding-right: 2px;
}

.split-chevron {
  padding: 0 2px;
  margin-left: -8px;
  width: 14px !important;
  min-width: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.split-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  z-index: 10;
  min-width: 140px;
  padding: 4px;
}

.split-dropdown-item {
  display: block;
  width: 100%;
  padding: 6px 10px;
  text-align: left;
  background: none;
  border: none;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-base);
  border-radius: var(--radius-xs);
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--color-base-34);
  }
}

.rename-button {
  color: var(--color-content-default);
  border: none;
  opacity: 0.4;
}

.rename-button:hover {
  opacity: 0.7;
  color: var(--color-text-primary);
}

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
