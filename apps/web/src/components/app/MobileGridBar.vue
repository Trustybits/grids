<!--
  MobileGridBar.vue

  Mobile 2.0 bottom command pill for grid owners. Three modes that morph into
  one another (Figma "New Tile Carousel" 1497-9533, "Grid Settings" 1497-9949):

    default  : the four commands — Add Tile · Grid Settings · Preview | Share.
    add      : tapping Add Tile grows the pill (the shell never fades — it
               transforms via a FLIP width animation); the commands are replaced
               by the `/TILE` command input, and a tile-type carousel slides up
               from behind the pill.
    settings : tapping Grid Settings morphs the pill the same way into the
               `/GRID` command input (top corners squared), while the
               MobileGridSettingsSheet rises from behind and rests flush on top
               of the bar as one connected surface.

  Preview hands off to MobilePreviewToolbar: tapping it slides this bar down out
  of view and the app bar up, leaving the preview toolbar as the only chrome.

  STILL INTERIM: Share copies the link (→ Phase 9). The Add-a-Tile subtype list
  with per-grid "N times used" counts is Phase 5.2.
-->
<template>
  <div
    ref="rootRef"
    class="mobile-grid-bar"
    :class="{
      'mgb--connected': isConnected,
      'mgb--preview': isPreviewActive,
    }"
    :style="barStyle"
  >
    <!-- Grid settings sheet — slides up from behind the pill and rests flush on
         top of the morphed `/GRID` command input. -->
    <transition name="mgb-rise">
      <div v-if="mode === 'settings'" class="mgb-settings-panel">
        <MobileGridSettingsSheet
          :query="query"
          @close="closeSettings"
          @open-color="openColor"
          @open-image="openImage"
        />
      </div>
    </transition>

    <!-- Color picker sheet — same rise/flush pattern; the pill below is the
         `/HEX` command input. -->
    <transition name="mgb-rise">
      <div v-if="mode === 'color'" class="mgb-settings-panel">
        <MobileColorPicker
          v-model="colorHex"
          :swatches="swatches"
          @preview="onColorPreview"
          @commit="onColorCommit"
        />
      </div>
    </transition>

    <!-- Background image swap sheet — same rise/flush pattern; the pill below is
         the `/background` command input (paste an image URL to link). -->
    <transition name="mgb-rise">
      <div v-if="mode === 'image'" class="mgb-settings-panel">
        <MobileImageSwapSheet />
      </div>
    </transition>

    <!-- Add-a-Tile carousel — peeks out from behind the pill while adding. -->
    <transition name="mgb-rise">
      <div
        v-if="mode === 'add' && viewMode === 'carousel'"
        class="mobile-grid-bar__panel"
      >
        <MobileTileCarousel
          :types="filteredTypes"
          :selected-id="activeType"
          @select="onSelectType"
          @focus-type="onFocusType"
        />
      </div>
    </transition>

    <!-- Add-a-Tile list — same rise/flush pattern as the other sheets: rises
         from behind the `/TILE` command input and rests flush on top of it. -->
    <transition name="mgb-rise">
      <div
        v-if="mode === 'add' && viewMode === 'list'"
        class="mgb-settings-panel"
      >
        <MobileTileListSheet
          :types="filteredTypes"
          :selected-id="activeType"
          @select="onSelectType"
        />
      </div>
    </transition>

    <MobileCommandBar
      ref="pillRef"
      class="mgb-pill"
      :class="{
        'mgb-pill--add': mode === 'add',
        'mgb-pill--settings': mode === 'settings',
        'mgb-pill--color': mode === 'color',
        'mgb-pill--image': mode === 'image',
        'mgb-pill--flush': isConnected,
      }"
      :aria-label="pillAriaLabel"
    >
      <template v-if="mode === 'default'">
        <button
          type="button"
          class="mgb-btn"
          aria-label="Add a tile"
          @click.stop="openAdd"
        >
          <AddTileIcon :size="24" />
        </button>

        <button
          type="button"
          class="mgb-btn"
          aria-label="Grid settings"
          @click.stop="toggleSettings"
        >
          <GridSettingsIcon :size="24" />
        </button>

        <button
          type="button"
          class="mgb-btn"
          aria-label="Preview"
          @click.stop="enterPreview"
        >
          <PreviewIcon :size="24" />
        </button>

        <span class="mgb-divider" aria-hidden="true" />

        <button
          type="button"
          class="mgb-btn"
          aria-label="Share"
          @click.stop="shareLink"
        >
          <component :is="shareIcon" :size="24" />
        </button>
      </template>

      <MobileCommandInput
        v-else-if="mode === 'add'"
        ref="cmdRef"
        v-model="query"
        :filter-label="chipLabel"
        :placeholders="PLACEHOLDERS"
        :static-placeholder="activePrompt"
        :view-mode="viewMode"
        close-label="Close add a tile"
        @submit="onSubmit"
        @toggle-view="toggleView"
        @close="closeAdd"
        @unpin="onUnpin"
      />

      <MobileCommandInput
        v-else-if="mode === 'settings'"
        v-model="query"
        filter-label="/GRID"
        :placeholders="GRID_PLACEHOLDERS"
        :show-view-toggle="false"
        aria-label="Filter grid settings"
        close-label="Close grid settings"
        @close="closeSettings"
      />

      <!-- Color (`/HEX`) mode: static `/HEX` chip, the hex value input, then the
           right-anchored Add-color and Close actions. (Eyedropper is a deferred
           follow-up.) -->
      <div
        v-else-if="mode === 'color'"
        class="mgb-hex"
        role="group"
        aria-label="Pick a color"
      >
        <span class="mgb-hex__chip">/HEX</span>
        <input
          ref="hexInputRef"
          v-model="hexInput"
          class="mgb-hex__input"
          type="text"
          inputmode="text"
          autocapitalize="characters"
          autocomplete="off"
          spellcheck="false"
          maxlength="7"
          aria-label="Hex color value"
          @keydown="onHexKeydown"
          @blur="commitHexInput"
        />
        <div class="mgb-hex__actions">
          <button
            type="button"
            class="mgb-btn mgb-btn--sm"
            aria-label="Save color"
            @click.stop="saveColor"
          >
            <PlusIcon :size="20" />
          </button>
          <button
            type="button"
            class="mgb-btn mgb-btn--sm"
            aria-label="Close color picker"
            @click.stop="closeColor"
          >
            <CloseIcon :size="20" />
          </button>
        </div>
      </div>

      <!-- Background image (`/background`) mode: static chip + a URL field to
           link an external image (paste-a-URL), then the right-anchored Close
           action. Uploading / swapping happens in the sheet above. -->
      <div
        v-else-if="mode === 'image'"
        class="mgb-hex mgb-url"
        role="group"
        aria-label="Background image"
      >
        <span class="mgb-hex__chip">/BACKGROUND</span>
        <input
          ref="urlInputRef"
          v-model="urlInput"
          class="mgb-hex__input"
          type="url"
          inputmode="url"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          placeholder="Paste an image URL to link"
          aria-label="Background image URL"
          @keydown="onUrlKeydown"
        />
        <div class="mgb-hex__actions">
          <button
            type="button"
            class="mgb-btn mgb-btn--sm"
            aria-label="Close background image"
            @click.stop="closeImage"
          >
            <CloseIcon :size="20" />
          </button>
        </div>
      </div>
    </MobileCommandBar>

    <input
      ref="imageInput"
      type="file"
      class="mgb-file"
      accept="image/*,video/*"
      @change.stop="onImageFile"
    />
    <input
      ref="documentInput"
      type="file"
      class="mgb-file"
      accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
      multiple
      @change.stop="onDocumentFiles"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import MobileCommandBar from "@/components/ui-collections/MobileCommandBar.vue";
import MobileCommandInput from "@/components/app/MobileCommandInput.vue";
import MobileTileCarousel from "@/components/app/MobileTileCarousel.vue";
import MobileTileListSheet from "@/components/app/MobileTileListSheet.vue";
import MobileGridSettingsSheet from "@/components/app/MobileGridSettingsSheet.vue";
import MobileColorPicker from "@/components/app/MobileColorPicker.vue";
import MobileImageSwapSheet from "@/components/app/MobileImageSwapSheet.vue";
import AddTileIcon from "@/components/icons/AddTileIcon.vue";
import GridSettingsIcon from "@/components/icons/GridSettingsIcon.vue";
import PreviewIcon from "@/components/icons/PreviewIcon.vue";
import ShareAppleIcon from "@/components/icons/ShareAppleIcon.vue";
import ShareDefaultIcon from "@/components/icons/ShareDefaultIcon.vue";
// Not part of the command-bar icon set — the `/HEX` save-color affordance.
import PlusIcon from "@/components/icons/PlusIcon.vue";
import CloseIcon from "@/components/icons/CloseIcon.vue";
import { isApplePlatform } from "@/utils/Platform";
import { useToastStore } from "@/stores/toast";
import { useTileCreation } from "@/composables/useTileCreation";
import { useFileUpload } from "@/composables/useFileUpload";
import { useGridSettings } from "@/composables/useGridSettings";
import { useGridPreview } from "@/composables/useGridPreview";
import { useSavedColors } from "@/composables/useSavedColors";
import { normalizeHex } from "@/utils/color";

// Rotating typewriter hints for the `/TILE` input (product-specified order).
const PLACEHOLDERS = [
  "paste a URL",
  "paste embed code",
  "type to filter/search",
  "paste text or md",
  "paste files",
  "paste videos/images",
  "paste color values",
  "type map [location]",
];
const TILE_FILTER = "/TILE";

// Rotating hints for the `/GRID` settings filter input.
const GRID_PLACEHOLDERS = [
  "search settings",
  "type to filter",
  "gravity",
  "duplicate",
  "transfer",
];

// Once a tile type is active, the placeholder asks for exactly what that type
// needs (and stops rotating). Types that need typed content before they can be
// built get a bespoke prompt; the rest fall back to a kind-derived one.
const TYPE_PROMPTS: Record<string, string> = {
  link: "type or paste in a URL",
  embed: "Paste a URL or embed code (Youtube, Spotify)",
  map: "Type a location (leave blank for current)",
};

const toastStore = useToastStore();
const { tileTypes, filterTileTypes, matchCommandPrefix, createTile, submitCommand } =
  useTileCreation();
const { uploadFileOptimistic, uploadDocumentsOptimistic } = useFileUpload();
const {
  backgroundColor,
  setBackgroundColor,
  previewBackgroundColor,
  linkBackgroundImage,
} = useGridSettings();
const { savedColors, load: loadSavedColors, addColor: addSavedColor } =
  useSavedColors();
const { isPreviewActive, enterPreview } = useGridPreview();

// Built-in preset swatches (the brand palette), shown before the user's saved
// customs in the picker's swatch row.
const PRESET_SWATCHES = [
  "#FFAFA3",
  "#FFD3A8",
  "#FFE299",
  "#B3EFBD",
  "#B3F4EF",
  "#A8DAFF",
  "#D3BDFF",
  "#FFA8DB",
  "#FFFFFF",
  "#33312C",
];
const DEFAULT_COLOR = "#FF0000";

const rootRef = ref<HTMLElement | null>(null);
const pillRef = ref<InstanceType<typeof MobileCommandBar> | null>(null);
const cmdRef = ref<InstanceType<typeof MobileCommandInput> | null>(null);
const hexInputRef = ref<HTMLInputElement | null>(null);
const urlInputRef = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const documentInput = ref<HTMLInputElement | null>(null);

const mode = ref<"default" | "add" | "settings" | "color" | "image">("default");
const query = ref("");

// Share uses each platform's own glyph, so the button reads as the share sheet
// the user expects: the tray-and-arrow on Apple platforms, the three-node graph
// everywhere else. Resolved once — the user agent cannot change mid-session.
const shareIcon = isApplePlatform() ? ShareAppleIcon : ShareDefaultIcon;

// On-screen keyboard height (0 when closed). The bar normally floats 8px above
// the viewport bottom, but when a soft keyboard opens it rests flush on top of
// it so the `/TILE` · `/GRID` input is never hidden.
const keyboardInset = ref(0);
const barStyle = computed(() => ({
  bottom:
    keyboardInset.value > 0
      ? `${keyboardInset.value}px`
      : "var(--spacing-sm)",
}));
const viewMode = ref<"carousel" | "list">("carousel");

// Modes where a sheet rests flush on top of the morphed command input as one
// connected surface: the `/GRID` settings sheet and its `/HEX` · `/background`
// sub-sheets, plus the Add-a-Tile *list* view (the carousel floats with a gap).
const isConnected = computed(
  () =>
    mode.value === "settings" ||
    mode.value === "color" ||
    mode.value === "image" ||
    (mode.value === "add" && viewMode.value === "list"),
);

// ── Color (`/HEX`) mode state ────────────────────────────────────────────────
// `colorHex` is the canonical working color (#RRGGBB) shared with the picker;
// `hexInput` is the raw text field (digits, may be mid-edit). The swatch row is
// the preset palette followed by the user's saved customs, de-duped.
const colorHex = ref(DEFAULT_COLOR);
const hexInput = ref(DEFAULT_COLOR.slice(1));
// Saved customs first (newest-first) so a freshly added color lands at the far
// left, then the built-in presets. De-duped case-insensitively.
const swatches = computed(() => {
  const seen = new Set<string>();
  return [...savedColors.value, ...PRESET_SWATCHES].filter((color) => {
    const hex = normalizeHex(color);
    if (!hex || seen.has(hex)) return false;
    seen.add(hex);
    return true;
  });
});
// The committed background color at the start of a pad/hue drag — restored just
// before the single commit so that commit's undo snapshot captures the pre-drag
// state (live previews in between are history-free). null when not dragging.
const colorDragBase = ref<string | null>(null);
// Consecutive Backspace presses while the hex field is empty — two in a row
// step up one level (`/HEX` → `/GRID`), mirroring the `/TILE` sub-command
// un-pin. Any edit resets it (see onHexKeydown).
const emptyHexBackspaces = ref(0);
// The command-type card the user tapped (link / embed / map), so ENTER knows
// what to build from the typed text. null → generic smart-paste / keyword.
const activeType = ref<string | null>(null);

// ── Background image (`/background`) mode state ───────────────────────────────
// The URL field for linking an external image; two Backspaces on an empty field
// step up one level (`/background` → `/GRID`), mirroring the `/HEX` un-pin.
const urlInput = ref("");
const emptyUrlBackspaces = ref(0);

// Once a tile type is active, the typed text populates that tile's content — it
// must NOT filter the carousel. Keep the full list visible with the active type
// highlighted. Only the generic `/TILE` search (no active type) filters as you
// type.
const filteredTypes = computed(() =>
  activeType.value ? tileTypes.value : filterTileTypes(query.value),
);

const activeDescriptor = computed(() =>
  activeType.value
    ? (tileTypes.value.find((type) => type.id === activeType.value) ?? null)
    : null,
);

const activePrompt = computed(() => {
  const descriptor = activeDescriptor.value;
  if (!descriptor) return null;
  const prompt = TYPE_PROMPTS[descriptor.id];
  if (prompt) return prompt;
  // Centering a card that needs no typed content still pins its prefix, so say
  // what the two remaining paths do rather than leaving the hints rotating.
  return descriptor.kind === "file"
    ? `Tap the ${descriptor.label} tile to choose a file`
    : `Press enter to add a ${descriptor.label} tile`;
});
// The chip prefix reflects the active tile type (`/MAP`, `/TEXT`, `/EMBED`) so
// the user always sees which context ENTER will act on; it falls back to the
// generic `/TILE` when nothing is active.
const chipLabel = computed(() =>
  activeType.value
    ? `/${activeType.value.replace(/_/g, " ").toUpperCase()}`
    : TILE_FILTER,
);

const pillAriaLabel = computed(() => {
  switch (mode.value) {
    case "add":
      return "Add a tile";
    case "settings":
      return "Grid settings";
    case "color":
      return "Color picker";
    case "image":
      return "Background image";
    default:
      return "Grid commands";
  }
});

// ── Grow the pill (FLIP) instead of fading it out/in ─────────────────────────
// The shell stays mounted; only its width animates between the measured
// default width and the (wider) add-mode width so it reads as "growing".
const animatePillWidth = async () => {
  const el = pillRef.value?.$el as HTMLElement | undefined;
  if (!el) return;

  const start = el.getBoundingClientRect().width;
  await nextTick(); // the swapped-in content is now laid out
  el.style.width = ""; // let CSS / content decide the target width
  const end = el.getBoundingClientRect().width;
  if (Math.abs(start - end) < 1) return;

  el.style.width = `${start}px`;
  void el.offsetWidth; // force reflow so the next change transitions
  el.style.transition = "width var(--duration-slow) var(--easing-gentle)";
  el.style.width = `${end}px`;

  const cleanup = (event: TransitionEvent) => {
    if (event.propertyName !== "width") return;
    el.style.transition = "";
    el.style.width = "";
    el.removeEventListener("transitionend", cleanup);
  };
  el.addEventListener("transitionend", cleanup);
};

watch(mode, async () => {
  await animatePillWidth();
  if (mode.value === "add") cmdRef.value?.focus();
});

// Entering preview collapses the pill back to its resting state. The bar slides
// out of view either way, but an open sheet would otherwise still be open when
// the user closes preview and the bar slides back up.
watch(isPreviewActive, (previewing) => {
  if (previewing) mode.value = "default";
});

// Quick command: while nothing is pinned, typing a command-type name followed
// by a space (e.g. "map japan") pins that type — the same as tapping its card —
// and strips the prefix so only the content ("japan") remains in the field.
watch(query, (value) => {
  if (activeType.value) return;
  const parsed = matchCommandPrefix(value);
  if (!parsed) return;
  activeType.value = parsed.type;
  query.value = parsed.rest;
});

// Grid Settings mirrors Add-a-tile: the pill morphs into the `/GRID` command
// input and the settings sheet rises from behind it.
const openSettings = () => {
  query.value = "";
  mode.value = "settings";
};

const closeSettings = () => {
  mode.value = "default";
  query.value = "";
};

const toggleSettings = () => {
  if (mode.value === "settings") closeSettings();
  else openSettings();
};

// ── Color (`/HEX`) mode ──────────────────────────────────────────────────────
// Opened from the Grid Settings background selector's color tile. Seeds the
// working color from the grid's current background (or a sensible default) and
// loads the user's saved swatches.
const openColor = () => {
  const base = normalizeHex(backgroundColor.value) || DEFAULT_COLOR;
  colorHex.value = base;
  hexInput.value = base.slice(1);
  emptyHexBackspaces.value = 0;
  void loadSavedColors();
  mode.value = "color";
};

// Close returns to the Grid Settings sheet (one level up), not all the way out.
const closeColor = () => {
  mode.value = "settings";
  query.value = "";
};

// ── Background image (`/background`) mode ─────────────────────────────────────
// Opened from the Grid Settings background selector's (active) image tile. The
// image-swap sheet rises behind the morphed `/background` input; the input links
// an external image URL, the sheet swaps/uploads archive images.
const openImage = () => {
  urlInput.value = "";
  emptyUrlBackspaces.value = 0;
  mode.value = "image";
};

// Close returns to the Grid Settings sheet (one level up), not all the way out.
const closeImage = () => {
  mode.value = "settings";
  query.value = "";
};

// Link the pasted URL as the grid background, then clear the field (the sheet
// preview above reflects the change). Enter commits; two Backspaces on an empty
// field step up one level (`/background` → `/GRID`).
const linkImage = () => {
  const url = urlInput.value.trim();
  if (!url) return;
  linkBackgroundImage(url);
  urlInput.value = "";
  emptyUrlBackspaces.value = 0;
};

const onUrlKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    linkImage();
    return;
  }
  if (event.key === "Backspace" && !urlInput.value) {
    emptyUrlBackspaces.value += 1;
    if (emptyUrlBackspaces.value >= 2) {
      emptyUrlBackspaces.value = 0;
      closeImage();
    }
    return;
  }
  emptyUrlBackspaces.value = 0;
};

// Live feedback while dragging the pad/hue: apply the color to the grid
// immediately, history-free. The first preview of a gesture records the
// pre-drag color so the eventual commit can snapshot it.
const onColorPreview = (hex: string) => {
  const norm = normalizeHex(hex);
  if (!norm) return;
  if (colorDragBase.value === null) colorDragBase.value = backgroundColor.value;
  previewBackgroundColor(norm);
};

// Commit a chosen color to the grid background. Fired once per picker gesture
// (pad/hue pointer-up, swatch tap) and on hex submit — so a drag is a single
// undo entry, matching the desktop picker. When ending a drag, restore the
// pre-drag color first so the commit's undo snapshot captures the right base.
const onColorCommit = (hex: string) => {
  const norm = normalizeHex(hex);
  if (!norm) return;
  if (colorDragBase.value !== null) {
    previewBackgroundColor(colorDragBase.value);
    colorDragBase.value = null;
  }
  setBackgroundColor(norm);
};

const saveColor = async () => {
  await addSavedColor(colorHex.value);
  toastStore.addToast("Color saved", "success");
};

const commitHexInput = () => {
  const norm = normalizeHex(hexInput.value);
  if (!norm) {
    // Revert an invalid entry to the last valid color.
    hexInput.value = colorHex.value.slice(1);
    return;
  }
  colorHex.value = norm;
  onColorCommit(norm);
  hexInputRef.value?.blur();
};

// Enter commits; two Backspaces on an already-empty field step up one level
// (`/HEX` → `/GRID`), matching the `/TILE` sub-command un-pin. Any other key —
// or a Backspace that actually deletes a character — resets the counter.
const onHexKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitHexInput();
    return;
  }
  if (event.key === "Backspace" && !hexInput.value) {
    emptyHexBackspaces.value += 1;
    if (emptyHexBackspaces.value >= 2) {
      emptyHexBackspaces.value = 0;
      closeColor();
    }
    return;
  }
  emptyHexBackspaces.value = 0;
};

// Typing a full 6-digit hex live-updates the pad + hue (UI only — the grid
// commits on Enter/blur so partial 3-digit shorthand can't apply prematurely).
watch(hexInput, (value) => {
  const digits = value.replace(/[^0-9a-fA-F]/g, "");
  if (digits.length !== 6) return;
  const norm = normalizeHex(digits);
  if (norm && norm !== colorHex.value) colorHex.value = norm;
});

// Reflect external color changes (pad/hue drag, swatch tap) back into the field
// without clobbering what the user is actively typing.
watch(colorHex, (hex) => {
  const digits = hex.slice(1);
  if (hexInput.value.replace(/[^0-9a-fA-F]/g, "").toUpperCase() !== digits) {
    hexInput.value = digits;
  }
});

const shareLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toastStore.addToast("Link to Grid copied to the clipboard", "success");
  } catch {
    toastStore.addToast("Failed to copy link", "error");
  }
};

// ── Add-a-tile mode ──────────────────────────────────────────────────────────
const openAdd = () => {
  query.value = "";
  activeType.value = null;
  viewMode.value = "carousel";
  mode.value = "add";
};

const closeAdd = () => {
  mode.value = "default";
  query.value = "";
  activeType.value = null;
};

const toggleView = () => {
  viewMode.value = viewMode.value === "carousel" ? "list" : "carousel";
};

// Bringing a card to the center of the carousel makes it the active type: the
// chip, the placeholder and what ENTER builds all follow it. The carousel only
// emits this for user-driven movement, so typing still filters until the user
// actually touches the fan.
const onFocusType = (id: string) => {
  activeType.value = id;
};

// Committing the centered card. Types that need typed content first (Link /
// Embed / Map) hand off to the input; the rest act immediately.
const onSelectType = (id: string) => {
  const descriptor = tileTypes.value.find((type) => type.id === id);
  if (!descriptor) return;

  activeType.value = descriptor.id;

  if (descriptor.kind === "create" && descriptor.contentType) {
    createTile(descriptor.contentType);
    closeAdd();
    return;
  }

  if (descriptor.kind === "file") {
    if (descriptor.id === "document") documentInput.value?.click();
    else imageInput.value?.click();
    return;
  }

  // Focus inside the tap gesture so the mobile keyboard opens; the typed text
  // is left intact. Releasing the type is Backspace-Backspace on an empty
  // field — a re-tap can't toggle it off now that the chip tracks the center.
  cmdRef.value?.focus();
};

const onSubmit = async (value: string) => {
  const tileId = await submitCommand(value, activeType.value);
  if (tileId) closeAdd();
};

// Two backspaces on an empty field un-pin the active command type (chip reverts
// to `/TILE`) rather than closing the whole surface.
const onUnpin = () => {
  if (activeType.value) activeType.value = null;
};

const onImageFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  closeAdd();
  try {
    await uploadFileOptimistic(file);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    toastStore.addToast(`Failed to upload file: ${message}`, "error");
  }
};

const onDocumentFiles = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = "";
  if (!files.length) return;
  closeAdd();
  try {
    await uploadDocumentsOptimistic(files);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    toastStore.addToast(`Failed to upload documents: ${message}`, "error");
  }
};

// ── Dismissal ────────────────────────────────────────────────────────────────
const handlePointerDown = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  // Clicks inside a teleported modal (delete / transfer confirmation) must not
  // dismiss the bar — that would unmount the settings sheet and the modal with
  // it, aborting the action.
  if (target?.closest(".modal-overlay")) return;
  if (!rootRef.value || rootRef.value.contains(target)) return;
  if (mode.value === "add") closeAdd();
  else if (mode.value === "settings") closeSettings();
  // Tapping outside dismisses the whole surface (not just back to settings).
  else if (mode.value === "color" || mode.value === "image")
    mode.value = "default";
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  if (mode.value === "add") closeAdd();
  else if (mode.value === "settings") closeSettings();
  else if (mode.value === "color") closeColor();
  else if (mode.value === "image") closeImage();
};

/**
 * Smallest visual-viewport gap taken to be a keyboard. The gap is a difference
 * of fractional CSS pixel values, so it sits slightly off zero even with
 * nothing open — a fraction of a pixel on a device, a couple of whole pixels
 * under a scaled device emulator. Treating any gap at all as a keyboard let
 * that noise pull the bar down to rest "flush" on a keyboard that wasn't there.
 * No real keyboard — or even a bare keyboard accessory bar — is this short.
 */
const MIN_KEYBOARD_INSET = 40;

// Track the soft-keyboard height via the visual viewport: the gap between the
// layout viewport bottom and the (shrunken) visual viewport bottom is the
// keyboard's height. 0 when the keyboard is closed or on desktop.
const updateKeyboardInset = () => {
  const vv = window.visualViewport;
  if (!vv) {
    keyboardInset.value = 0;
    return;
  }
  const gap = window.innerHeight - vv.height - vv.offsetTop;
  // Rounded so a fractional gap cannot end up as a `bottom: 2.99988px`.
  keyboardInset.value = gap >= MIN_KEYBOARD_INSET ? Math.round(gap) : 0;
};

onMounted(() => {
  document.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("keydown", handleKeydown);
  window.visualViewport?.addEventListener("resize", updateKeyboardInset);
  window.visualViewport?.addEventListener("scroll", updateKeyboardInset);
  updateKeyboardInset();
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePointerDown);
  document.removeEventListener("keydown", handleKeydown);
  window.visualViewport?.removeEventListener("resize", updateKeyboardInset);
  window.visualViewport?.removeEventListener("scroll", updateKeyboardInset);
});
</script>

<style lang="scss" scoped>
.mobile-grid-bar {
  // Single source of truth for the expanded command-bar width. Every morphed
  // state — `/TILE` (add), `/GRID` (settings) and its `/HEX` · `/BACKGROUND`
  // sub-sheets — uses this so they always match. Fills the bar leaving
  // --spacing-sm (8px) either side, capped at 520px on larger screens. The
  // default resting pill (the four command buttons) stays content-sized so the
  // pill still visibly grows as it morphs open.
  //
  // Deliberately a percentage of the bar rather than `100vw`: `vw` ignores a
  // classic scrollbar and does not necessarily match the box a fixed element is
  // actually laid out in, so anything sized off it drifts out of step with the
  // rest of the mobile chrome. MobileAppBar spans edge to edge for the same
  // reason — it stretches between left:0 and right:0 and never names a width.
  --mgb-width: min(520px, calc(100% - var(--spacing-md)));
  // How far the Add-a-Tile fan sits behind the pill. The cards are bottom
  // -aligned, so this is the same slice hidden off the bottom of each of them.
  --mgb-tuck: var(--spacing-md);

  position: fixed;
  // Default resting gap; overridden inline to hug the keyboard when it opens.
  bottom: var(--spacing-md);
  // Stretched rather than centered on `left: 50%`. Anchored at one edge the bar
  // is shrink-to-fit, and a shrink-to-fit flex column is only as wide as its
  // items can be squeezed — so the pill was shrinking below --mgb-width, by a
  // margin that changed with the chip text. Stretching makes the width definite.
  left: 0;
  right: 0;
  z-index: var(--z-fixed);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  // The bar now spans the screen, but only its surfaces should catch taps —
  // everything either side of the pill has to fall through to the grid.
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  transition: transform var(--duration-slow) var(--easing-gentle);
}

// Preview slides the whole bar down past the bottom edge, in step with the app
// bar sliding up, leaving the preview toolbar as the only chrome on screen. The
// resting gap is added on so the pill clears the edge rather than half-showing.
.mgb--preview {
  transform: translateY(calc(100% + var(--spacing-md)));
  pointer-events: none;
}

// The pill sits above the carousel so the carousel appears to emerge from
// behind it as it slides up.
.mgb-pill {
  position: relative;
  z-index: 1;
}

.mgb-pill--add {
  width: var(--mgb-width);

  // Stretch the command bar's inner group (inline-flex by default) so the input
  // fills the pill and the toggle/close icons sit flush at the right edge —
  // otherwise the group stays content-sized and leaves a gap on the right.
  :deep(.mobile-command-bar__group) {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }

  :deep(.mci) {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }
}

// ── Connected settings surface ───────────────────────────────────────────────
// In settings mode the sheet + morphed `/GRID` bar read as one connected
// surface, so drop the gap; both use the shared --mgb-width so the pill and the
// sheet resting on it line up flush.
.mgb--connected {
  gap: 0;
}

.mgb-settings-panel {
  // Anchored flush above the pill and taken OUT of the flex column (absolute) so
  // that while one sub-sheet is leaving and the next is entering, the two
  // momentarily-mounted panels don't stack and grow the bottom-anchored column —
  // otherwise the surviving sheet would render high up, then visibly drop as the
  // column collapses. Takes --mgb-width directly (the bar itself is now full
  // width) so it still matches the connected surface below it, centered by auto
  // margins rather than a transform — mgb-rise animates `transform`.
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  z-index: 0;
  width: var(--mgb-width);
  margin: 0 auto;
}

.mgb-pill.mgb-pill--settings,
.mgb-pill.mgb-pill--color,
.mgb-pill.mgb-pill--image {
  width: var(--mgb-width);

  :deep(.mobile-command-bar__group) {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }

  :deep(.mci) {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }
}

// Square the top corners whenever a sheet rests flush above the pill (settings,
// color, image and the Add-a-Tile list) so the two surfaces line up seamlessly;
// the bottom corners keep --radius-md.
.mgb-pill.mgb-pill--flush {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

// ── `/HEX` color command input ───────────────────────────────────────────────
.mgb-hex {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  min-width: 0;
}

.mgb-hex__chip {
  flex: 0 0 auto;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  background: var(--color-base-8);
  color: var(--color-content-default);
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold, 600);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.mgb-hex__input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 var(--spacing-xs);
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-base);
  text-transform: uppercase;
  outline: none;

  &::placeholder {
    color: var(--color-content-low);
  }
}

.mgb-hex__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}

.mgb-btn--sm {
  width: 32px;
  height: 32px;
}

// The coverflow has no surface of its own, so the fan reads as sitting on the
// grid. Taken out of the flex column and pushed down past the top of the pill
// so the bottom of every card is tucked behind the bar (z-index: 0, under the
// pill's 1) — the fan peeks out from behind it rather than floating above it.
.mobile-grid-bar__panel {
  display: flex;
  justify-content: center;
  position: absolute;
  bottom: calc(100% - var(--mgb-tuck));
  // Unlike the pill this takes the bar's full width rather than --mgb-width, so
  // the fan spreads edge to edge and its outer cards are cut off by the screen
  // rather than stopping short of it.
  left: 0;
  right: 0;
  z-index: 0;
}

.mgb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-content-default);
  cursor: pointer;
  line-height: 0;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth);

  &:hover,
  &.is-active {
    background: var(--color-base-8);
    color: var(--color-text-primary);
  }
}

.mgb-divider {
  width: var(--border-width);
  align-self: stretch;
  margin: var(--spacing-xs) 2px;
  background: var(--color-stroke);
}

.mgb-file {
  display: none;
}

// Carousel/list rising up from behind the pill.
.mgb-rise-enter-active,
.mgb-rise-leave-active {
  transition:
    opacity var(--duration-slow) var(--easing-gentle),
    transform var(--duration-slow) var(--easing-gentle);
}

.mgb-rise-enter-from,
.mgb-rise-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

</style>
