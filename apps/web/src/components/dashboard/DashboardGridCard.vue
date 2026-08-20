<template>
  <li
    class="grid-card"
    :class="{ 'is-drag-over': isDragOver }"
    :draggable="draggable"
    @dragstart="$emit('dragstart', $event, grid.id)"
    @dragover="$emit('dragover', $event, grid.id)"
    @drop="$emit('drop', $event, grid.id)"
    @dragend="$emit('dragend', $event, grid.id)"
  >
    <router-link :to="`/grid/${grid.id}`" class="grid-link">
      <DashboardGridStarButton
        :grid-id="grid.id"
        :is-starred="isStarred"
        @toggle-star="$emit('toggle-star', $event)"
      />
      <span class="grid-name"
        >{{ grid.name }}
        <ChevronRightIcon class="grid-arrow" :size="16" />
      </span>

      <span
        v-if="showStatus"
        class="grid-status"
        :class="isPublished ? 'grid-status--published' : 'grid-status--draft'"
      >
        <span class="grid-status__dot" aria-hidden="true" />
        {{ isPublished ? "Published" : "Draft" }}
      </span>

      <DashboardGridUpdatedLabel :grid="grid" />

      <DashboardGridCardActions
        :grid="grid"
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

<script setup lang="ts">
import { computed } from "vue";
import DashboardGridStarButton from "./DashboardGridStarButton.vue";
import ChevronRightIcon from "@/components/icons/ChevronRightIcon.vue";
import DashboardGridUpdatedLabel from "./DashboardGridUpdatedLabel.vue";
import DashboardGridCardActions from "./DashboardGridCardActions.vue";
import { useFeatureFlags } from "@/composables/useFeatureFlags";
import type { Grid } from "@grids/contracts/types";

const props = defineProps<{
  grid: Grid,
  isDefaultGrid?: boolean,
  isStarred?: boolean,
  splitMenuOpen?: boolean,
  draggable?: boolean,
  isDragOver?: boolean,
}>();

defineEmits([
  "toggle-star",
  "toggle-default",
  "duplicate",
  "toggle-split-menu",
  "rename",
  "delete",
  "dragstart",
  "dragover",
  "drop",
  "dragend",
]);

const { isEnabled, FEATURE_FLAGS } = useFeatureFlags();

// The published/draft badge is only meaningful once the draft/publish feature
// is on — without it every grid is public, so the badge would be noise.
const showStatus = computed(() =>
  isEnabled(FEATURE_FLAGS.EDITOR_DRAFT_PUBLISH),
);

// Absent/legacy status is treated as published (public), matching persistence.
const isPublished = computed(() => props.grid.status !== "draft");
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grid-arrow {
  margin-left: var(--spacing-sm);
  color: var(--color-content-default);
  opacity: 0;
  transform: translateX(-4px);
  transition: all var(--duration-fast) var(--easing-smooth);
  flex-shrink: 0;
}

/* Published / Draft badge */
.grid-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
  white-space: nowrap;
}

.grid-status__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: currentColor;
}

.grid-status--published {
  background: color-mix(in srgb, var(--color-success, #22c55e) 16%, transparent);
  color: var(--color-success, #16a34a);
}

.grid-status--draft {
  background: var(--color-base-8);
  color: var(--color-content-default);
}

.grid-link:hover .grid-arrow {
  opacity: 1;
  transform: translateX(0);
}

.grid-card.is-drag-over .grid-link {
  outline: 1px dashed var(--color-content-default);
  outline-offset: 2px;
}

/*
  On phones the single row (star + name + timestamp + four action buttons) has
  no room for the name, so it wrapped mid-word. Reflow into two rows: star +
  name on top, timestamp + actions beneath, giving the name a full line.
*/
@media (max-width: 600px) {
  .grid-link {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "star name name"
      "status meta actions";
    column-gap: var(--spacing-sm);
    row-gap: var(--spacing-xs);
    align-items: center;
  }

  .grid-link > :first-child {
    grid-area: star;
  }

  .grid-name {
    grid-area: name;
    font-size: var(--font-size-base);
  }

  /* Hover-only affordance; irrelevant on touch and it breaks the ellipsis. */
  .grid-arrow {
    display: none;
  }

  /* Class-based placement so the layout is robust to the optional status badge
     (the "status" cell is simply empty when the flag is off). */
  .grid-status {
    grid-area: status;
    justify-self: start;
  }

  .grid-link :deep(.grid-updated) {
    grid-area: meta;
  }

  .grid-link :deep(.grid-actions) {
    grid-area: actions;
    justify-self: end;
  }
}
</style>
