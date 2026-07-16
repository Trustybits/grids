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

    <div class="mgs-separator" aria-hidden="true" />

    <div class="mgs-body">
      <template v-if="isOwner">
        <!-- GRID THEME — light/dark preview cards drive the per-grid theme
             (replaces the old Dark Mode toggle). Each card is a mini grid mock
             (profile / document / chat / image tiles); the active one gets the
             2px purple ring sitting 2px off the thumbnail. -->
        <section v-if="isVisible('theme')" class="mgs-section">
          <span class="mgs-section__label">GRID THEME</span>
          <div class="mgs-theme">
            <button
              v-for="card in THEME_CARDS"
              :key="card.id"
              type="button"
              class="mgs-theme-card"
              :class="[
                `mgs-theme-card--${card.id}`,
                { 'is-selected': isThemeSelected(card.id) },
              ]"
              :aria-pressed="isThemeSelected(card.id)"
              :aria-label="card.label"
              @click="selectTheme(card.id)"
            >
              <span class="mgs-mock" aria-hidden="true">
                <span class="mgs-mock__tile mgs-mock__tile--profile">
                  <span class="mgs-mock__avatar" />
                  <span class="mgs-mock__bar mgs-mock__bar--name" />
                  <span class="mgs-mock__bar mgs-mock__bar--title" />
                  <span class="mgs-mock__bar mgs-mock__bar--desc" />
                </span>
                <span class="mgs-mock__tile mgs-mock__tile--doc">
                  <span class="mgs-mock__doc-tab" />
                  <span class="mgs-mock__bar" />
                  <span class="mgs-mock__bar" />
                  <span class="mgs-mock__bar mgs-mock__bar--short" />
                </span>
                <span class="mgs-mock__tile mgs-mock__tile--chat">
                  <span class="mgs-mock__bubble mgs-mock__bubble--in" />
                  <span class="mgs-mock__bubble mgs-mock__bubble--out" />
                  <span class="mgs-mock__bubble mgs-mock__bubble--in" />
                  <span
                    class="mgs-mock__bubble mgs-mock__bubble--out mgs-mock__bubble--sm"
                  />
                  <span class="mgs-mock__chatbar" />
                </span>
                <span class="mgs-mock__tile mgs-mock__tile--image">
                  <svg
                    class="mgs-mock__scene"
                    viewBox="0 0 48 22"
                    preserveAspectRatio="xMidYMax meet"
                    aria-hidden="true"
                  >
                    <circle class="mgs-mock__sun" cx="34" cy="6" r="3" />
                    <path
                      class="mgs-mock__hill mgs-mock__hill--back"
                      d="M-2 22 L12 8 L26 22 Z"
                    />
                    <path
                      class="mgs-mock__hill mgs-mock__hill--front"
                      d="M16 22 L31 6 L50 22 Z"
                    />
                  </svg>
                </span>
              </span>
            </button>
          </div>
        </section>

        <!-- GRID BACKGROUND — retained image / default / solid color. Selecting
             a tile activates that source (the others keep their stored value so
             the user can toggle back). Active tile gets the 2px purple ring. -->
        <section v-if="isVisible('background')" class="mgs-section">
          <span class="mgs-section__label">GRID BACKGROUND</span>
          <div class="mgs-bg">
            <button
              type="button"
              class="mgs-bg-tile mgs-bg-tile--image"
              :class="{ 'is-selected': isImageBackgroundActive }"
              :aria-pressed="isImageBackgroundActive"
              :aria-label="imageTileLabel"
              @click="onImageTile"
            >
              <span
                v-if="imageThumb"
                class="mgs-bg-tile__thumb"
                :style="{ backgroundImage: `url(${imageThumb})` }"
              />
              <svg
                v-else
                class="mgs-bg-tile__illustration"
                viewBox="0 0 48 30"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                <circle class="mgs-bg-tile__sun" cx="34" cy="9" r="3.5" />
                <path
                  class="mgs-bg-tile__hill mgs-bg-tile__hill--back"
                  d="M-2 30 L13 13 L28 30 Z"
                />
                <path
                  class="mgs-bg-tile__hill mgs-bg-tile__hill--front"
                  d="M15 30 L31 10 L50 30 Z"
                />
              </svg>
            </button>
            <button
              type="button"
              class="mgs-bg-tile mgs-bg-tile--default"
              :class="{ 'is-selected': isDefaultBackgroundActive }"
              :aria-pressed="isDefaultBackgroundActive"
              aria-label="Use default background"
              @click="activateDefaultBackground"
            >
              <span class="mgs-bg-tile__text">Default</span>
            </button>
            <button
              type="button"
              class="mgs-bg-tile mgs-bg-tile--color"
              :class="{ 'is-selected': isColorBackgroundActive }"
              :aria-pressed="isColorBackgroundActive"
              :aria-label="colorTileLabel"
              @click="onColorTile"
            >
              <span
                class="mgs-bg-tile__swatch"
                :style="
                  hasBackgroundColor ? { background: backgroundColor } : undefined
                "
              />
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
        <div class="mgs-divider" aria-hidden="true" />
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
  backgroundImageSrc,
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
const THEME_CARDS = [
  { id: "dark", label: "Dark theme" },
  { id: "light", label: "Light theme" },
] as const;

const isThemeSelected = (id: "dark" | "light"): boolean =>
  (id === "dark") === isDarkMode.value;

const selectTheme = (id: "dark" | "light") => {
  isDarkMode.value = id === "dark";
};

// ── GRID BACKGROUND ──────────────────────────────────────────────────────────
const bgImageInput = ref<HTMLInputElement | null>(null);

// Local object-URL preview shown the instant a file is chosen, before the
// upload resolves and the real `backgroundImageSrc` takes over.
const uploadingThumb = ref<string | null>(null);

// The image tile shows a thumbnail once an image exists (or is uploading);
// otherwise it shows the framed-photo illustration.
const imageThumb = computed(
  () => uploadingThumb.value ?? (backgroundImageSrc.value || null),
);

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
// already active) re-open the picker to change it. The richer image-swap sheet
// (`/background`: preview + archive carousel + paste URL) is the next phase; for
// now the active-tile tap falls back to the file picker.
const onImageTile = () => {
  if (!hasBackgroundImage.value) {
    onPickImage();
    return;
  }
  if (!isImageBackgroundActive.value) {
    activateImageBackground();
    return;
  }
  onPickImage();
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

.mgs-theme {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

/* The active choice gets a 2px purple ring sitting 2px off the illustration —
   an outline with a matching offset (no layout shift, follows the radius). */
.mgs-theme-card,
.mgs-bg-tile {
  padding: 0;
  background: transparent;
  cursor: pointer;
  transition: outline-color var(--duration-fast) var(--easing-smooth);

  &.is-selected {
    outline: var(--border-width-lg) solid var(--color-purple);
    outline-offset: var(--border-width-lg);
  }
}

.mgs-theme-card {
  border: none;
  border-radius: var(--radius-md);
}

/* Neutral light/dark preview surfaces that stay light/dark regardless of the
   active app theme, so both cards always read as their respective theme. */
.mgs-theme-card--dark {
  --mock-bg: var(--color-dark-0);
  --mock-tile: color-mix(in srgb, var(--color-light-100) 7%, var(--color-dark-0));
  --mock-line: color-mix(in srgb, var(--color-light-100) 22%, transparent);
  --mock-line-weak: color-mix(in srgb, var(--color-light-100) 10%, transparent);
  --mock-accent: color-mix(in srgb, var(--color-light-100) 34%, transparent);
}

.mgs-theme-card--light {
  --mock-bg: color-mix(in srgb, var(--color-dark-0) 7%, var(--color-light-100));
  --mock-tile: var(--color-light-100);
  --mock-line: color-mix(in srgb, var(--color-dark-0) 24%, transparent);
  --mock-line-weak: color-mix(in srgb, var(--color-dark-0) 11%, transparent);
  --mock-accent: color-mix(in srgb, var(--color-dark-0) 34%, transparent);
}

.mgs-mock {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 4px;
  width: 100%;
  height: 76px;
  padding: 5px;
  border-radius: var(--radius-md);
  background: var(--mock-bg);
}

.mgs-mock__tile {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background: var(--mock-tile);
}

.mgs-mock__tile--profile {
  grid-area: 1 / 1 / 2 / 2;
}
.mgs-mock__tile--doc {
  grid-area: 1 / 2 / 2 / 3;
}
.mgs-mock__tile--chat {
  grid-area: 1 / 3 / 3 / 4;
}
.mgs-mock__tile--image {
  grid-area: 2 / 1 / 3 / 3;
  padding: 0;
}

.mgs-mock__tile--profile,
.mgs-mock__tile--doc,
.mgs-mock__tile--chat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
}

.mgs-mock__avatar {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--mock-line);
}

.mgs-mock__bar {
  height: 2px;
  border-radius: 1px;
  background: var(--mock-line-weak);
}
.mgs-mock__bar--name {
  width: 72%;
  background: var(--mock-line);
}
.mgs-mock__bar--title {
  width: 44%;
}
.mgs-mock__bar--desc {
  width: 86%;
}
.mgs-mock__bar--short {
  width: 52%;
}
.mgs-mock__tile--doc .mgs-mock__bar {
  width: 86%;
}

.mgs-mock__doc-tab {
  width: 58%;
  height: 8px;
  border-radius: 2px;
  background: var(--mock-line-weak);
}

/* Chat bubbles alternate sides; a text-box bar pins to the bottom. */
.mgs-mock__tile--chat {
  gap: 3px;
}
.mgs-mock__bubble {
  height: 6px;
  border-radius: 3px;
}
.mgs-mock__bubble--in {
  width: 68%;
  align-self: flex-start;
  border-bottom-left-radius: 1px;
  background: var(--mock-line-weak);
}
.mgs-mock__bubble--out {
  width: 80%;
  align-self: flex-end;
  border-bottom-right-radius: 1px;
  background: var(--mock-accent);
}
.mgs-mock__bubble--sm {
  width: 54%;
}
.mgs-mock__chatbar {
  margin-top: auto;
  height: 7px;
  border-radius: 3px;
  border: 0.5px solid var(--mock-line-weak);
}

.mgs-mock__scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.mgs-mock__sun {
  fill: var(--mock-accent);
}
.mgs-mock__hill--back {
  fill: var(--mock-line-weak);
}
.mgs-mock__hill--front {
  fill: var(--mock-line);
}

.mgs-bg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.mgs-bg-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-md);
  background: var(--color-base-8);
  color: var(--color-content-low);
  overflow: hidden;
}

.mgs-bg-tile--default {
  border-style: dashed;
  background: transparent;
}

.mgs-bg-tile__text {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.mgs-bg-tile__thumb {
  width: 100%;
  height: 100%;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
}

.mgs-bg-tile__illustration {
  width: 62%;
  height: 62%;
  color: var(--color-content-low);
}
.mgs-bg-tile__sun {
  fill: currentColor;
  opacity: 0.85;
}
.mgs-bg-tile__hill {
  fill: currentColor;
}
.mgs-bg-tile__hill--back {
  opacity: 0.5;
}

.mgs-bg-tile__swatch {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    var(--color-red),
    var(--color-yellow),
    var(--color-green),
    var(--color-cyan),
    var(--color-blue),
    var(--color-purple),
    var(--color-pink)
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
  color: var(--color-red);
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
