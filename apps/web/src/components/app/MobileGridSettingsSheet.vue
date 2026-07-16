<!--
  MobileGridSettingsSheet.vue

  Mobile 2.0 Grid Settings panel (Figma "Grid Settings Menu", 1497-9949). It is
  the sheet that rises from behind the bottom command pill once that pill has
  morphed into the `/GRID` command input — the exact mirror of the Add-a-Tile
  carousel/`/TILE` pattern. The panel rests directly on top of the bar: its
  bottom corners are squared so they line up with the (top-squared) command
  input, and the whole surface reads as one.

  This component owns only the panel contents: a fixed GRID ID header, a
  separator, and a scrollable, live-filterable list of settings (filtered by the
  `query` the parent feeds down from the `/GRID` input). All behavior comes from
  the shared `useGridSettings` composable so this and the desktop menu never
  drift. Scope (Phase 6.1): GRID ID + copy, Dark Mode, Gravity, Default Grid,
  Publish Template, Duplicate, Transfer, Delete, Debug. Grid Background
  (image/color) + the theme-card visuals are Phase 6.2.
-->
<template>
  <div class="mgs-panel" role="dialog" aria-label="Grid settings">
    <div class="mgs-header">
      <span class="mgs-header__label">GRID ID:</span>
      <span class="mgs-header__value">{{ gridPageId }}</span>
      <button
        type="button"
        class="mgs-copy"
        aria-label="Copy grid link"
        @click="onCopy"
      >
        <ClipboardIcon :size="18" />
      </button>
    </div>

    <div class="mgs-separator" aria-hidden="true" />

    <div class="mgs-body">
      <template v-if="isOwner">
        <div v-if="isVisible('darkMode')" class="mgs-row mgs-row--toggle">
          <Toggle label="Dark Mode" v-model="isDarkMode" />
        </div>
        <div v-if="isVisible('gravity')" class="mgs-row mgs-row--toggle">
          <Toggle label="Gravity" v-model="verticalCompact" />
        </div>
        <div v-if="isVisible('default')" class="mgs-row mgs-row--toggle">
          <Toggle
            label="Default Grid"
            :model-value="isDefaultGrid"
            @update:model-value="toggleDefaultGrid"
          />
        </div>
        <div v-if="isVisible('publish')" class="mgs-row mgs-row--toggle">
          <Toggle label="Publish Template" v-model="duplicatable" />
        </div>

        <button
          v-if="isVisible('duplicate')"
          type="button"
          class="mgs-row mgs-row--action"
          @click="onDuplicate"
        >
          <span class="mgs-row__label">Duplicate Grid</span>
          <span class="mgs-row__icon"><ChevronRightIcon :size="18" /></span>
        </button>

        <button
          v-if="pendingTransfer && isVisible('transfer')"
          type="button"
          class="mgs-row mgs-row--action mgs-row--danger"
          :disabled="isCancellingTransfer"
          @click="cancelPendingTransfer"
        >
          <SpinnerIcon v-if="isCancellingTransfer" :size="16" />
          <span class="mgs-row__label">
            {{ isCancellingTransfer ? "Cancelling…" : "Cancel Transfer" }}
          </span>
        </button>
        <button
          v-else-if="isVisible('transfer')"
          type="button"
          class="mgs-row mgs-row--action"
          @click="onTransfer"
        >
          <span class="mgs-row__label">Transfer Grid</span>
          <span class="mgs-row__icon"><ChevronRightIcon :size="18" /></span>
        </button>

        <button
          v-if="isVisible('delete')"
          type="button"
          class="mgs-row mgs-row--action mgs-row--danger"
          @click="requestDelete"
        >
          <span class="mgs-row__label">Delete Grid</span>
        </button>
      </template>

      <template v-if="isVisible('debug')">
        <div class="mgs-divider" aria-hidden="true" />
        <div class="mgs-row mgs-row--toggle">
          <Toggle label="Metadata" v-model="showMetaData" />
        </div>
        <div class="mgs-row mgs-row--toggle">
          <Toggle label="Verbose Metadata" v-model="showMetaDataVerbose" />
        </div>
        <button
          type="button"
          class="mgs-row mgs-row--action"
          @click="onPixelRacers"
        >
          <span class="mgs-row__label">🏍️ Pixel Racers</span>
        </button>
      </template>

      <p v-if="!anyVisible" class="mgs-empty">No settings match “{{ query }}”.</p>
    </div>
  </div>

  <PromptModal
    :show="showDeleteModal"
    :title="`Delete ${currentGridName}`"
    :description="`Enter &quot;${currentGridName}&quot; exactly to confirm deletion.`"
    :placeholder="currentGridName"
    :require-match="currentGridName"
    confirm-label="Delete"
    variant="danger"
    @close="showDeleteModal = false"
    @confirm="performDelete"
  />

  <TransferGridModal
    :show="showTransferModal"
    :grid-id="gridPageId"
    :grid-name="currentGridName"
    @close="showTransferModal = false"
  />
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useGridSettings } from "@/composables/useGridSettings";
import Toggle from "@/components/ui-controls/Toggle.vue";
import PromptModal from "@/components/modal/PromptModal.vue";
import TransferGridModal from "@/components/modal/TransferGridModal.vue";
import ClipboardIcon from "@/components/icons/ClipboardIcon.vue";
import ChevronRightIcon from "@/components/icons/ChevronRightIcon.vue";
import SpinnerIcon from "@/components/icons/SpinnerIcon.vue";

const props = withDefaults(defineProps<{ query?: string }>(), { query: "" });
const emit = defineEmits<{ (e: "close"): void }>();

const {
  isOwner,
  gridPageId,
  currentGridName,
  pendingTransfer,
  isCancellingTransfer,
  verticalCompact,
  isDarkMode,
  duplicatable,
  showMetaData,
  showMetaDataVerbose,
  isDefaultGrid,
  refreshDefaultGrid,
  toggleDefaultGrid,
  showDeleteModal,
  showTransferModal,
  copyGridLink,
  duplicateGrid,
  requestDelete,
  performDelete,
  openTransferModal,
  cancelPendingTransfer,
  launchPixelRacers,
} = useGridSettings();

// Each settings row's search terms. The parent's `/GRID` input narrows the list
// to rows whose id/label/keywords contain the query. The GRID ID header is not
// filterable — it is a fixed header, always visible.
const SETTINGS_INDEX: Record<string, string> = {
  darkMode: "dark mode light theme appearance",
  gravity: "gravity compact pack fill layout",
  default: "default grid home landing",
  publish: "publish template public duplicatable share",
  duplicate: "duplicate copy clone",
  transfer: "transfer move ownership give",
  delete: "delete remove trash",
  debug: "debug metadata developer pixel racers",
};

const matchingIds = computed(() => {
  const q = props.query.trim().toLowerCase();
  const ids = Object.keys(SETTINGS_INDEX);
  if (!q) return new Set(ids);
  return new Set(ids.filter((id) => SETTINGS_INDEX[id].includes(q)));
});

const isVisible = (id: string): boolean => matchingIds.value.has(id);

const anyVisible = computed(() => matchingIds.value.size > 0);

// The panel is mounted fresh each time settings opens, so refresh the (async)
// default-grid flag on mount rather than watching an `open` prop.
onMounted(refreshDefaultGrid);

const onCopy = async () => {
  await copyGridLink();
  emit("close");
};

const onDuplicate = async () => {
  const newId = await duplicateGrid("full");
  if (newId) emit("close");
};

const onTransfer = () => {
  openTransferModal();
};

const onPixelRacers = () => {
  launchPixelRacers();
  emit("close");
};
</script>

<style lang="scss" scoped>
.mgs-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 320px;
  max-height: 70vh;
  padding: var(--spacing-sm) var(--spacing-xs) var(--spacing-xs);
  background-color: var(--color-toolbar-background);
  border: var(--border-width) solid var(--color-stroke);
  /* Square bottom corners so the panel lines up flush with the (top-squared)
     `/GRID` command input resting directly beneath it. */
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  box-shadow: var(--shadow-xl);
}

.mgs-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 0 0 auto;
  padding: var(--spacing-sm);
}

.mgs-header__label {
  flex: 0 0 auto;
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.mgs-header__value {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-content-low);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-sm);
}

.mgs-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-content-low);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-smooth);

  &:hover {
    background: var(--color-base-8);
    color: var(--color-text-primary);
  }
}

.mgs-separator {
  flex: 0 0 auto;
  height: var(--border-width);
  margin: 0 var(--spacing-sm) var(--spacing-xs);
  background: var(--color-stroke);
}

.mgs-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--spacing-xs);
}

.mgs-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  min-height: 40px;
  padding: var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  text-align: left;
}

.mgs-row--action {
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-smooth);

  &:hover {
    background: var(--color-base-8);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.mgs-row--danger {
  color: var(--color-red);
}

.mgs-row--toggle {
  padding: var(--spacing-xs) var(--spacing-sm);

  :deep(.toggle) {
    width: 100%;
    justify-content: space-between;
  }
}

.mgs-row__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mgs-row__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--color-content-low);
}

.mgs-divider {
  height: var(--border-width);
  margin: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-stroke);
}

.mgs-empty {
  padding: var(--spacing-md) var(--spacing-sm);
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  text-align: center;
}
</style>
