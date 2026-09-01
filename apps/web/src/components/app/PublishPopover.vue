<!--
  PublishPopover.vue

  Draft/Publish surface (Framer-style). A trigger button whose label reflects
  publish state (Publish / Update / Published) with a dot when the open draft
  has unpublished changes, plus a popover panel showing the public URL, publish
  state, and the publish actions.

  Fully gated behind the EDITOR_DRAFT_PUBLISH flag via usePublish — renders
  nothing unless the feature is enabled and the viewer owns the grid.
-->
<template>
  <div v-if="visible" ref="rootRef" class="publish-popover">
    <button
      type="button"
      class="pp-trigger"
      :class="{ 'pp-trigger--open': open, 'pp-trigger--primary': triggerIsPrimary }"
      :aria-expanded="open"
      @click="toggle"
    >
      <span v-if="hasUnpublishedChanges" class="pp-dot" aria-hidden="true" />
      <UploadIcon :size="16" />
      <span class="pp-trigger__label">{{ triggerLabel }}</span>
    </button>

    <transition name="pp-fade">
      <div v-if="open" class="pp-panel" role="dialog" aria-label="Publish">
        <div class="pp-header">
          <span class="pp-status" :class="`pp-status--${status}`">
            {{ isPublished ? "Published" : "Draft" }}
          </span>
          <span class="pp-timestamp">{{ timestampLabel }}</span>
        </div>

        <div class="pp-url-row">
          <GlobeIcon :size="16" class="pp-url-icon" />
          <span class="pp-url" :title="publicUrl">{{ prettyUrl }}</span>
          <button
            type="button"
            class="pp-icon-btn"
            aria-label="Copy public link"
            @click="copyPublicUrl"
          >
            <LinkIcon :size="16" />
          </button>
          <button
            type="button"
            class="pp-icon-btn"
            aria-label="Open public page"
            @click="openPublicUrl"
          >
            <EyeIcon :size="16" />
          </button>
        </div>

        <div class="pp-actions">
          <AppButton
            variant="brand"
            block
            :loading="isPublishing"
            :disabled="!canPublish"
            @click="onPublish"
          >
            {{ primaryLabel }}
          </AppButton>
          <AppButton
            variant="secondary"
            block
            :disabled="isPublishing || !isDraftEditing"
            @click="onPublishAsCopy"
          >
            Publish as a copy
          </AppButton>
        </div>

        <div class="pp-divider" />

        <div class="pp-footer">
          <button
            v-if="!isDefaultGrid"
            type="button"
            class="pp-link"
            @click="onSetDefault"
          >
            Set as your grids.so page
          </button>
          <button
            v-if="isPublished"
            type="button"
            class="pp-link pp-link--danger"
            :disabled="isUnpublishing"
            @click="onUnpublish"
          >
            Unpublish
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AppButton from "@/components/ui-elements/Button.vue";
import UploadIcon from "@/components/icons/UploadIcon.vue";
import GlobeIcon from "@/components/icons/GlobeIcon.vue";
import LinkIcon from "@/components/icons/LinkIcon.vue";
import EyeIcon from "@/components/icons/EyeIcon.vue";
import { usePublish } from "@/composables/usePublish";

const {
  isFeatureEnabled,
  isOwner,
  isDraftEditing,
  status,
  isPublished,
  publishedAt,
  hasUnpublishedChanges,
  isPublishing,
  isUnpublishing,
  publicUrl,
  isDefaultGrid,
  refreshPublicIdentity,
  publish,
  publishAsCopy,
  unpublish,
  copyPublicUrl,
  openPublicUrl,
  setAsDefaultGrid,
} = usePublish();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

// Only surface the control to the owner of a grid while the feature is on.
const visible = computed(() => isFeatureEnabled.value && isOwner.value);

// The trigger stands out (brand fill) whenever there's something to publish.
const triggerIsPrimary = computed(
  () => !isPublished.value || hasUnpublishedChanges.value,
);

const triggerLabel = computed(() => {
  if (!isPublished.value) return "Publish";
  return hasUnpublishedChanges.value ? "Update" : "Published";
});

const primaryLabel = computed(() => {
  if (!isPublished.value) return "Publish";
  return hasUnpublishedChanges.value ? "Update" : "Published";
});

// Publishing pushes the draft live; only meaningful while editing a draft and
// there is a divergence (or the grid isn't public yet).
const canPublish = computed(
  () =>
    isDraftEditing.value &&
    (!isPublished.value || hasUnpublishedChanges.value),
);

const prettyUrl = computed(() =>
  publicUrl.value.replace(/^https?:\/\//, ""),
);

const timestampLabel = computed(() => {
  if (!isPublished.value) return "Not published yet";
  const at = publishedAt.value;
  const date = toDate(at);
  if (!date) return "Published";
  return `Published ${formatRelative(date)}`;
});

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate(): Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function formatRelative(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

const toggle = () => {
  open.value = !open.value;
  if (open.value) void refreshPublicIdentity();
};

const close = () => {
  open.value = false;
};

const onPublish = async () => {
  await publish();
  close();
};
const onPublishAsCopy = async () => {
  await publishAsCopy();
  close();
};
const onUnpublish = async () => {
  await unpublish();
};
const onSetDefault = async () => {
  await setAsDefaultGrid();
};

// Close on outside click / Escape.
const onDocumentPointer = (event: MouseEvent) => {
  if (!open.value) return;
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    close();
  }
};
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") close();
};

onMounted(() => {
  document.addEventListener("mousedown", onDocumentPointer);
  document.addEventListener("keydown", onKeydown);
  if (visible.value) void refreshPublicIdentity();
});
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocumentPointer);
  document.removeEventListener("keydown", onKeydown);
});

// Refresh the public identity (slug / default-grid) whenever ownership resolves.
watch(visible, (now) => {
  if (now) void refreshPublicIdentity();
});
</script>

<style lang="scss" scoped>
.publish-popover {
  position: relative;
  flex: 0 0 auto;
}

.pp-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  height: 32px;
  padding: 0 var(--spacing-sm);
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-full);
  background: var(--color-base-8);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    border-color var(--duration-fast) var(--easing-smooth),
    transform var(--duration-fast) var(--easing-smooth);

  &:hover {
    transform: translateY(-1px);
  }

  &.pp-trigger--primary {
    background: var(--primary-color, var(--color-brand, #6c5ce7));
    border-color: transparent;
    color: #fff;
  }

  &.pp-trigger--open {
    box-shadow: var(--shadow-sm);
  }
}

.pp-trigger__label {
  white-space: nowrap;
}

// Pulsing dot marking unpublished changes.
.pp-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: currentColor;
  box-shadow: 0 0 0 0 currentColor;
  animation: pp-pulse 2s infinite;
}

@keyframes pp-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 60%, transparent);
  }
  70% {
    box-shadow: 0 0 0 6px transparent;
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

.pp-panel {
  position: absolute;
  top: calc(100% + var(--spacing-sm));
  right: 0;
  z-index: var(--z-dropdown);
  width: min(320px, calc(100vw - 2 * var(--spacing-md)));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-toolbar-background, var(--color-content-background));
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg, var(--shadow-md));
  backdrop-filter: blur(20px);
}

.pp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.pp-status {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;

  &.pp-status--published {
    background: color-mix(in srgb, var(--color-success, #22c55e) 18%, transparent);
    color: var(--color-success, #16a34a);
  }

  &.pp-status--draft {
    background: var(--color-base-8);
    color: var(--color-content-default);
  }
}

.pp-timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-content-low);
}

.pp-url-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-base-8);
  border-radius: var(--radius-sm);
}

.pp-url-icon {
  flex: 0 0 auto;
  color: var(--color-content-low);
}

.pp-url {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pp-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-content-default);
  cursor: pointer;
  line-height: 0;
  transition: background-color var(--duration-fast) var(--easing-smooth);

  &:hover {
    background: var(--color-stroke);
    color: var(--color-text-primary);
  }
}

.pp-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.pp-divider {
  height: var(--border-width);
  background: var(--color-stroke);
  margin: var(--spacing-xs) 0;
}

.pp-footer {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.pp-link {
  padding: var(--spacing-xs) 0;
  border: none;
  background: transparent;
  color: var(--color-content-default);
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: var(--color-text-primary);
    text-decoration: underline;
  }

  &.pp-link--danger {
    color: var(--color-danger, #ef4444);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.pp-fade-enter-active,
.pp-fade-leave-active {
  transition:
    opacity var(--duration-fast) var(--easing-ease-out),
    transform var(--duration-fast) var(--easing-ease-out);
}

.pp-fade-enter-from,
.pp-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
