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
  drift. Scope: GRID ID + copy, GRID THEME (light/dark preview cards), GRID
  BACKGROUND (image / default / color), Gravity, Default Grid, Publish Template,
  Duplicate, Transfer, Delete, Debug. The theme cards replace the old Dark Mode
  toggle — selecting a card drives the shared `isDarkMode` state.
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

    <Divider class="mgs-separator" />

    <div class="mgs-body">
      <template v-if="isOwner">
        <!-- GRID THEME — light/dark preview cards drive the per-grid theme
             (replaces the old Dark Mode toggle). Each card is a mini grid mock
             (profile / document / chat / image tiles); the active one gets the
             2px purple ring sitting 2px off the thumbnail. -->
        <!-- GRID THEME — segmented Dark / Light control driving the per-grid
             theme (replaces the old preview cards). -->
        <section v-if="isVisible('theme')" class="mgs-section">
          <span class="mgs-section__label">GRID THEME</span>
          <div class="mgs-segment" role="group" aria-label="Grid theme">
            <button
              type="button"
              class="mgs-segment__btn"
              :class="{ 'is-active': isThemeSelected('dark') }"
              :aria-pressed="isThemeSelected('dark')"
              @click="selectTheme('dark')"
            >
              Dark
            </button>
            <button
              type="button"
              class="mgs-segment__btn"
              :class="{ 'is-active': isThemeSelected('light') }"
              :aria-pressed="isThemeSelected('light')"
              @click="selectTheme('light')"
            >
              Light
            </button>
          </div>
        </section>

        <!-- GRID BACKGROUND — segmented Image / Default / Color control. Selecting
             a segment activates that source (the others keep their stored value so
             the user can toggle back); the active segment is highlighted. The
             Color segment shows the current colour as a live dot. -->
        <section v-if="isVisible('background')" class="mgs-section">
          <span class="mgs-section__label">GRID BACKGROUND</span>
          <div class="mgs-segment" role="group" aria-label="Grid background">
            <button
              type="button"
              class="mgs-segment__btn"
              :class="{ 'is-active': isImageBackgroundActive }"
              :aria-pressed="isImageBackgroundActive"
              :aria-label="imageTileLabel"
              @click="onImageTile"
            >
              Image
            </button>
            <button
              type="button"
              class="mgs-segment__btn"
              :class="{ 'is-active': isDefaultBackgroundActive }"
              :aria-pressed="isDefaultBackgroundActive"
              aria-label="Use default background"
              @click="activateDefaultBackground"
            >
              Default
            </button>
            <button
              type="button"
              class="mgs-segment__btn"
              :class="{ 'is-active': isColorBackgroundActive }"
              :aria-pressed="isColorBackgroundActive"
              :aria-label="colorTileLabel"
              @click="onColorTile"
            >
              <span
                class="mgs-segment__dot"
                :style="hasBackgroundColor ? { background: backgroundColor } : undefined"
              />
              Color
            </button>
          </div>
        </section>

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

      <!-- Debug is developer-only metadata tooling, gated to Trustybits staff.
           (Pixel Racers is desktop-only — it's a keyboard easter egg — so it is
           intentionally absent here.) -->
      <template v-if="isStaff && isVisible('debug')">
        <Divider />
        <button
          type="button"
          class="mgs-row mgs-row--action"
          :aria-expanded="debugExpanded"
          @click="debugOpen = !debugOpen"
        >
          <span class="mgs-row__label">Debug</span>
          <span
            class="mgs-row__icon mgs-row__icon--chevron"
            :class="{ 'is-open': debugExpanded }"
          >
            <ChevronRightIcon :size="18" />
          </span>
        </button>

        <template v-if="debugExpanded">
          <div class="mgs-row mgs-row--toggle">
            <Toggle label="Metadata" v-model="showMetaData" />
          </div>
          <div class="mgs-row mgs-row--toggle">
            <Toggle label="Verbose Metadata" v-model="showMetaDataVerbose" />
          </div>
        </template>
      </template>

      <p v-if="!anyVisible" class="mgs-empty">No settings match “{{ query }}”.</p>
    </div>

    <input
      ref="bgImageInput"
      type="file"
      class="mgs-file-input"
      accept="image/*,image/svg+xml"
      @change.stop="onImageChange"
    />
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
import { computed, onMounted, ref } from "vue";
import { useGridSettings } from "@/composables/useGridSettings";
import Divider from "@/components/ui-elements/Divider.vue";
import Toggle from "@/components/ui-controls/Toggle.vue";
import PromptModal from "@/components/modal/PromptModal.vue";
import TransferGridModal from "@/components/modal/TransferGridModal.vue";
import ClipboardIcon from "@/components/icons/ClipboardIcon.vue";
import ChevronRightIcon from "@/components/icons/ChevronRightIcon.vue";
import SpinnerIcon from "@/components/icons/SpinnerIcon.vue";

const props = withDefaults(defineProps<{ query?: string }>(), { query: "" });
const emit = defineEmits<{
  (e: "close"): void;
  (e: "open-color"): void;
  (e: "open-image"): void;
}>();

const {
  isOwner,
  isStaff,
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
  hasBackgroundImage,
  hasBackgroundColor,
  backgroundColor,
  isImageBackgroundActive,
  isColorBackgroundActive,
  isDefaultBackgroundActive,
  activateImageBackground,
  activateColorBackground,
  activateDefaultBackground,
  uploadBackgroundImage,
  showDeleteModal,
  showTransferModal,
  copyGridLink,
  duplicateGrid,
  requestDelete,
  performDelete,
  openTransferModal,
  cancelPendingTransfer,
} = useGridSettings();

// ── GRID THEME ───────────────────────────────────────────────────────────────
const isThemeSelected = (id: "dark" | "light"): boolean =>
  (id === "dark") === isDarkMode.value;

const selectTheme = (id: "dark" | "light") => {
  isDarkMode.value = id === "dark";
};

// ── GRID BACKGROUND ──────────────────────────────────────────────────────────
const bgImageInput = ref<HTMLInputElement | null>(null);

// Local object-URL preview held during an upload so it can be revoked once the
// upload resolves.
const uploadingThumb = ref<string | null>(null);

const imageTileLabel = computed(() => {
  if (!hasBackgroundImage.value) return "Add background image";
  return isImageBackgroundActive.value
    ? "Change background image"
    : "Use image background";
});

const colorTileLabel = computed(() => {
  if (!hasBackgroundColor.value) return "Set background color";
  return isColorBackgroundActive.value
    ? "Edit background color"
    : "Use color background";
});

const onPickImage = () => {
  bgImageInput.value?.click();
};

const onImageChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploadingThumb.value = URL.createObjectURL(file);
  try {
    // Sets the image src, hash, and marks image the active source.
    await uploadBackgroundImage(file);
  } finally {
    if (uploadingThumb.value) {
      URL.revokeObjectURL(uploadingThumb.value);
      uploadingThumb.value = null;
    }
    if (bgImageInput.value) bgImageInput.value.value = "";
  }
};

// Image tile: upload the first image → re-activate a retained image → (when
// already active) open the `/background` image-swap sheet (preview + archive
// carousel + paste-a-URL) so the user can change it.
const onImageTile = () => {
  if (!hasBackgroundImage.value) {
    onPickImage();
    return;
  }
  if (!isImageBackgroundActive.value) {
    activateImageBackground();
    return;
  }
  emit("open-image");
};

// Color tile: pick the first color (opens the `/HEX` picker) → re-activate a
// retained color → (when already active) open the picker to edit it.
const onColorTile = () => {
  if (!hasBackgroundColor.value || isColorBackgroundActive.value) {
    emit("open-color");
    return;
  }
  activateColorBackground();
};

// Each settings row's search terms. The parent's `/GRID` input narrows the list
// to rows whose id/label/keywords contain the query. The GRID ID header is not
// filterable — it is a fixed header, always visible.
const SETTINGS_INDEX: Record<string, string> = {
  theme: "theme dark mode light appearance color scheme",
  background: "background image color wallpaper backdrop",
  gravity: "gravity compact pack fill layout",
  default: "default grid home landing",
  publish: "publish template public duplicatable share",
  duplicate: "duplicate copy clone",
  transfer: "transfer move ownership give",
  delete: "delete remove trash",
  debug: "debug metadata verbose developer",
};

const matchingIds = computed(() => {
  const q = props.query.trim().toLowerCase();
  const ids = Object.keys(SETTINGS_INDEX);
  if (!q) return new Set(ids);
  return new Set(ids.filter((id) => SETTINGS_INDEX[id].includes(q)));
});

const isVisible = (id: string): boolean => matchingIds.value.has(id);

const anyVisible = computed(() => matchingIds.value.size > 0);

// Debug tools are collapsed by default (mirrors the desktop "Debug" accordion),
// but auto-expand while a filter query is active so matches aren't hidden.
const debugOpen = ref(false);
const debugExpanded = computed(
  () => debugOpen.value || props.query.trim().length > 0,
);

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
</script>

<style lang="scss" scoped>
.mgs-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  // Sheet body (excludes the `/GRID` command bar beneath it). Caps at ~190px on
  // an iPhone SE (568px tall) and scales up with taller screens; the row list
  // scrolls if it overflows. Never taller than the space above the bar.
  height: 33.5vh;
  max-height: 33.5vh;
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

// Flush under the fixed header rather than taking the divider's default top
// rhythm: the sheet's height budget is tight on a 320x568 phone. Selector is
// deliberately specific enough to beat the shorthand `margin` it overrides.
.mgs-panel > .mgs-separator {
  margin-top: 0;
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

.mgs-file-input {
  display: none;
}

/* ── GRID THEME / GRID BACKGROUND sections ─────────────────────────────────── */
.mgs-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-md);
}

.mgs-section__label {
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.04em;
}

/* Inset-pill segmented control: a subtle track with a floating raised pill
   marking the active option. A hairline border would vanish on the near-black
   sheet, so the track and pill are set with translucent-white washes instead. */
.mgs-segment {
  display: flex;
  gap: 3px;
  padding: 3px;
  background: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
  border-radius: var(--radius-md);
}

.mgs-segment__btn {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: 34px;
  padding: 0 var(--spacing-sm);
  border: none;
  border-radius: calc(var(--radius-md) - 3px);
  background: transparent;
  color: var(--color-content-default);
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth);
}

.mgs-segment__btn:hover:not(.is-active) {
  color: var(--color-text-primary);
}

.mgs-segment__btn.is-active {
  background: color-mix(in srgb, var(--color-text-primary) 13%, transparent);
  color: var(--color-text-primary);
}

/* Live preview of the chosen background colour; falls back to a spectrum dot
   that reads as "pick a colour" when none is set yet. */
.mgs-segment__dot {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  background: conic-gradient(
    from 90deg,
    var(--color-red),
    var(--color-yellow),
    var(--color-green),
    var(--color-cyan),
    var(--color-blue),
    var(--color-purple),
    var(--color-red)
  );
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
  color: var(--grids-brand-error-default);
}

.mgs-row--toggle {
  // The nested Toggle supplies its own --spacing-sm padding, so zero the row's
  // padding — otherwise toggle labels sit 8px further right than action rows.
  padding: 0;

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

.mgs-row__icon--chevron {
  transition: transform var(--duration-fast) var(--easing-smooth);

  &.is-open {
    transform: rotate(90deg);
  }
}

.mgs-empty {
  padding: var(--spacing-md) var(--spacing-sm);
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  text-align: center;
}
</style>
