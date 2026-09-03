<template>
  <div class="grid-actions">
    <!-- The default-grid toggle stays visible on every viewport: it reflects
         state (green when default) and is a one-tap toggle, so it doesn't belong
         behind an overflow menu. -->
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

    <!-- Desktop: the remaining actions sit inline. `display: contents` keeps
         them as direct flex children of .grid-actions, so the row is unchanged. -->
    <div class="actions-inline">
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

    <!-- Mobile: the same actions collapse into one overflow menu. The four 40px
         buttons don't fit beside the status badge and timestamp, so on phones we
         show only the default toggle plus this "⋯" menu. It reuses the parent's
         splitMenuOpen state (one open menu at a time, closed on outside click). -->
    <div class="actions-overflow" @click.prevent>
      <button
        @click.prevent.stop="$emit('toggle-split-menu', grid.id)"
        class="action-button more-button"
        data-tooltip="More actions"
        aria-haspopup="menu"
        :aria-expanded="splitMenuOpen ? 'true' : 'false'"
        aria-label="More actions"
      >
        <MoreVerticalIcon :size="20" />
      </button>
      <div v-if="splitMenuOpen" class="overflow-dropdown" role="menu">
        <button
          @click.prevent.stop="$emit('duplicate', grid, 'full')"
          class="overflow-item"
          role="menuitem"
        >
          Duplicate
        </button>
        <button
          @click.prevent.stop="$emit('duplicate', grid, 'structure')"
          class="overflow-item"
          role="menuitem"
        >
          Duplicate structure only
        </button>
        <button
          @click.prevent.stop="$emit('rename', grid)"
          class="overflow-item"
          role="menuitem"
        >
          Rename
        </button>
        <button
          @click.prevent.stop="$emit('delete', grid)"
          class="overflow-item overflow-item--danger"
          role="menuitem"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Grid } from "@grids/contracts/types";
import Chevron from "@/components/icons/Chevron.vue";
import GlobeIcon from "@/components/icons/GlobeIcon.vue";
import DuplicateIcon from "@/components/icons/DuplicateIcon.vue";
import EditIcon from "@/components/icons/EditIcon.vue";
import TrashIcon from "@/components/icons/toolbar/TrashIcon.vue";
import MoreVerticalIcon from "@/components/icons/MoreVerticalIcon.vue";

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

/* Desktop shows the actions inline; `contents` keeps them as direct flex
   children of .grid-actions so the existing row layout is untouched. The mobile
   overflow menu is hidden here and swapped in under the media query below. */
.actions-inline {
  display: contents;
}

.actions-overflow {
  display: none;
  position: relative;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: transparent;
  border: var(--border-width) solid var(--color-stroke);
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
  border: var(--border-width) solid var(--color-stroke);
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

/* ── Mobile overflow (⋯) menu ─────────────────────────────────────────────── */

.more-button {
  color: var(--color-content-default);
  border: none;
  opacity: 0.55;
}

.more-button:hover {
  opacity: 0.9;
  color: var(--color-text-primary);
}

.overflow-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--color-tile-background);
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 20;
  min-width: 200px;
  padding: 6px;
}

.overflow-item {
  display: block;
  width: 100%;
  padding: 11px 12px;
  text-align: left;
  background: none;
  border: none;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-family: var(--font-family-base);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.overflow-item:hover,
.overflow-item:active {
  background: var(--color-base-34);
}

.overflow-item--danger {
  color: #ef4444;
}

@media (max-width: 600px) {
  /* Swap the inline buttons for the single overflow menu. The default-grid
     toggle remains visible (it's outside .actions-inline). */
  .actions-inline {
    display: none;
  }

  .actions-overflow {
    display: block;
  }

  /* Touch ergonomics: on phones the two on-card controls (default toggle + ⋯)
     grow to a 44px thumb target, and the gap between them widens so a thumb
     aiming for one doesn't hit the other (or the card link behind them). */
  .grid-actions {
    gap: var(--spacing-sm);
  }

  .default-grid-button,
  .more-button {
    width: 44px;
    height: 44px;
  }

  /* Roomier menu rows for comfortable tapping. */
  .overflow-item {
    padding: 14px 14px;
  }
}
</style>
