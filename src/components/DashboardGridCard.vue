<template>
  <li class="grid-card">
    <router-link :to="`/grid/${layout.id}`" class="grid-link">
      <button
        type="button"
        @click.stop.prevent="$emit('toggle-star', layout.id)"
        data-tooltip="Favorite grid"
        class="star-lead"
        :class="{ 'is-starred': isStarred }"
        :title="isStarred ? 'Remove from favorites' : 'Add to favorites'"
      >
        <svg v-if="isStarred" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
        <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <span class="grid-name">{{ layout.name }}
        <svg class="grid-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>

      <div class="grid-actions">
        <button
          @click.prevent="$emit('toggle-default', layout.id)"
          data-tooltip="Set as default grid"
          :class="['action-button', 'default-grid-button', { 'is-default': isDefaultGrid }]"
          :title="isDefaultGrid ? 'Default grid - this is what shows at your public homepage' : 'Set as default grid'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>
        <div class="split-button" @click.prevent>
          <button
            @click.prevent="$emit('duplicate', layout, 'full')"
            data-tooltip="Duplicate grid"
            class="action-button duplicate-button split-main"
            title="Duplicate grid (full copy)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            @click.prevent.stop="$emit('toggle-split-menu', layout.id)"
            class="action-button duplicate-button split-chevron"
            title="More duplicate options"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div v-if="splitMenuOpen" class="split-dropdown">
            <button
              @click.prevent.stop="$emit('duplicate', layout, 'structure')"
              class="split-dropdown-item"
            >
              Duplicate Structure Only
            </button>
          </div>
        </div>
        <button
          @click.prevent="$emit('rename', layout)"
          class="action-button rename-button"
          data-tooltip="Rename grid"
          title="Rename grid"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          @click.prevent="$emit('delete', layout)"
          data-tooltip="Delete grid"
          class="action-button delete-button"
          title="Delete grid"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M10 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M14 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </router-link>
  </li>
</template>

<script setup>
defineProps({
  layout: { type: Object, required: true },
  isDefaultGrid: { type: Boolean, default: false },
  isStarred: { type: Boolean, default: false },
  splitMenuOpen: { type: Boolean, default: false },
});

defineEmits([
  'toggle-star',
  'toggle-default',
  'duplicate',
  'toggle-split-menu',
  'rename',
  'delete',
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
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-primary);
  transition: all var(--duration-normal) var(--easing-smooth);
  cursor: pointer;
  flex: 1;
}

.grid-link:hover {
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
}

.star-lead {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-content-low);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
}

.star-lead.is-starred {
  color: #eab308;
}

.grid-link:hover .star-lead:not(.is-starred) {
  background-color: var(--color-base-8);
  color: var(--color-text-primary);
}

.star-lead:not(.is-starred):hover {
  color: #ca8a04;
}

.star-lead.is-starred:hover {
  color: #facc15;
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
  transform: translateX(0);
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
