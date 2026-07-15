<!--
  MobileGridBar.vue

  Mobile 2.0 bottom command pill for grid owners. Two modes that morph into one
  another (Figma "New Tile Carousel", 1497-9533):

    default : the four commands — Add Tile · Grid Settings · Preview | Share.
    add     : tapping Add Tile grows the pill (the shell never fades — it
              transforms via a FLIP width animation); the commands are replaced
              by the `/TILE` command input, and a tile-type carousel slides up
              from behind the pill. (MobileCommandInput is reused for the
              `/GRID` settings input in Phase 6.)

  STILL INTERIM: Grid Settings reuses the desktop GridSettings menu (→ Phase 6),
  Preview reuses BreakpointSwitcher (→ Phase 7), Share copies the link (→ Phase 9).
  The Add-a-Tile subtype list with per-grid "N times used" counts is Phase 5.2.
-->
<template>
  <div ref="rootRef" class="mobile-grid-bar">
    <!-- Tile carousel / list — slides up from behind the pill while adding. -->
    <transition name="mgb-rise">
      <div v-if="mode === 'add'" class="mobile-grid-bar__panel">
        <MobileTileCarousel
          :types="filteredTypes"
          :layout="viewMode"
          :selected-id="activeType"
          @select="onSelectType"
        />
      </div>
    </transition>

    <!-- Interim Preview popover (default mode only). -->
    <transition name="mgb-pop">
      <div v-if="mode === 'default' && showPreview" class="mobile-grid-bar__popover">
        <BreakpointSwitcher variant="toolbar-row" />
      </div>
    </transition>

    <MobileCommandBar
      ref="pillRef"
      class="mgb-pill"
      :class="{ 'mgb-pill--add': mode === 'add' }"
      :aria-label="mode === 'add' ? 'Add a tile' : 'Grid commands'"
    >
      <template v-if="mode === 'default'">
        <button
          type="button"
          class="mgb-btn"
          aria-label="Add a tile"
          @click.stop="openAdd"
        >
          <PlusIcon :size="24" />
        </button>

        <span class="mgb-settings">
          <GridSettings />
        </span>

        <button
          type="button"
          class="mgb-btn"
          :class="{ 'is-active': showPreview }"
          aria-label="Preview"
          @click.stop="togglePreview"
        >
          <EyeIcon :size="24" />
        </button>

        <span class="mgb-divider" aria-hidden="true" />

        <button
          type="button"
          class="mgb-btn"
          aria-label="Share"
          @click.stop="shareLink"
        >
          <ShareIcon :size="24" />
        </button>
      </template>

        <MobileCommandInput
        v-else
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
import GridSettings from "@/components/grid/GridSettings.vue";
import BreakpointSwitcher from "@/components/grid/ViewControls.vue";
import PlusIcon from "@/components/icons/PlusIcon.vue";
import EyeIcon from "@/components/icons/EyeIcon.vue";
import ShareIcon from "@/components/icons/ShareIcon.vue";
import { useToastStore } from "@/stores/toast";
import { useTileCreation } from "@/composables/useTileCreation";
import { useFileUpload } from "@/composables/useFileUpload";

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

// Once a command-type card is tapped, the placeholder asks for exactly what that
// tile type needs (and stops rotating).
const TYPE_PROMPTS: Record<string, string> = {
  link: "type or paste in a URL",
  embed: "Paste a URL or embed code (Youtube, Spotify)",
  map: "Type a location (leave blank for current)",
};

const toastStore = useToastStore();
const { tileTypes, filterTileTypes, matchCommandPrefix, createTile, submitCommand } =
  useTileCreation();
const { uploadFileOptimistic, uploadDocumentsOptimistic } = useFileUpload();

const rootRef = ref<HTMLElement | null>(null);
const pillRef = ref<InstanceType<typeof MobileCommandBar> | null>(null);
const cmdRef = ref<InstanceType<typeof MobileCommandInput> | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const documentInput = ref<HTMLInputElement | null>(null);

const mode = ref<"default" | "add">("default");
const showPreview = ref(false);
const query = ref("");
const viewMode = ref<"carousel" | "list">("carousel");
// The command-type card the user tapped (link / embed / map), so ENTER knows
// what to build from the typed text. null → generic smart-paste / keyword.
const activeType = ref<string | null>(null);

// Once a command-type card is selected (link / embed / map), the typed text
// populates that tile's content — it must NOT filter the carousel. Keep the
// full list visible with the active type highlighted. Only the generic `/TILE`
// search (no active type) filters as you type.
const filteredTypes = computed(() =>
  activeType.value ? tileTypes.value : filterTileTypes(query.value),
);
const activePrompt = computed(() =>
  activeType.value ? (TYPE_PROMPTS[activeType.value] ?? null) : null,
);
// The chip prefix reflects the pinned command type (`/MAP`, `/LINK`, `/EMBED`)
// so the user always sees which context ENTER will act on; it falls back to
// the generic `/TILE` when nothing is selected.
const chipLabel = computed(() =>
  activeType.value ? `/${activeType.value.toUpperCase()}` : TILE_FILTER,
);

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
  el.style.transition = "width var(--duration-normal) var(--easing-spring)";
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

// ── Default-mode commands ────────────────────────────────────────────────────
const togglePreview = () => {
  showPreview.value = !showPreview.value;
};

const shareLink = async () => {
  showPreview.value = false;
  try {
    await navigator.clipboard.writeText(window.location.href);
    toastStore.addToast("Link to Grid copied to the clipboard", "success");
  } catch {
    toastStore.addToast("Failed to copy link", "error");
  }
};

// ── Add-a-tile mode ──────────────────────────────────────────────────────────
const openAdd = () => {
  showPreview.value = false;
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

const onSelectType = (id: string) => {
  const descriptor = tileTypes.value.find((type) => type.id === id);
  if (!descriptor) return;

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

  // "command" types (Link / Embed / Map): tapping pins the type (chip → `/MAP`
  // etc.) and focuses the input so the mobile keyboard opens inside the tap
  // gesture. Tapping the already-pinned card again toggles it off (chip → the
  // generic `/TILE`). The typed text is left intact either way.
  activeType.value = activeType.value === descriptor.id ? null : descriptor.id;
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
  if (!rootRef.value || rootRef.value.contains(event.target as Node)) return;
  showPreview.value = false;
  if (mode.value === "add") closeAdd();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  if (mode.value === "add") closeAdd();
  showPreview.value = false;
};

onMounted(() => {
  document.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("keydown", handleKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePointerDown);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<style lang="scss" scoped>
.mobile-grid-bar {
  position: fixed;
  bottom: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-fixed);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  max-width: 100vw;
}

// The pill sits above the carousel so the carousel appears to emerge from
// behind it as it slides up.
.mgb-pill {
  position: relative;
  z-index: 1;
}

.mgb-pill--add {
  width: min(360px, calc(100vw - var(--spacing-lg) * 2));

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

.mobile-grid-bar__panel,
.mobile-grid-bar__popover {
  display: flex;
  justify-content: center;
  max-width: calc(100vw - var(--spacing-lg) * 2);
}

.mobile-grid-bar__panel {
  z-index: 0;
  border-radius: var(--radius-2xl, var(--radius-lg));
  background-color: var(--color-toolbar-background);
  border: var(--border-width) solid var(--color-stroke);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(20px);
  overflow: hidden;
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

/*
  Reposition the reused GridSettings dropdown (pinned to the bottom-left corner
  in its own styles) so it opens above and centered on the pill. Scoped :deep
  override keeps GridSettings itself untouched until the Phase 6 sheet.
*/
.mgb-settings {
  display: inline-flex;

  :deep(.grid-menu-button) {
    border-radius: var(--radius-full);
    background: transparent;

    &:hover {
      background: var(--color-base-8);
    }
  }

  :deep(.grid-menu-dropdown) {
    bottom: calc(100% + var(--spacing-sm));
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    max-width: calc(100vw - var(--spacing-lg) * 2);
  }
}

// Carousel/list rising up from behind the pill.
.mgb-rise-enter-active,
.mgb-rise-leave-active {
  transition:
    opacity var(--duration-normal) var(--easing-smooth),
    transform var(--duration-normal) var(--easing-spring);
}

.mgb-rise-enter-from,
.mgb-rise-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.mgb-pop-enter-active,
.mgb-pop-leave-active {
  transition:
    opacity var(--duration-fast) var(--easing-smooth),
    transform var(--duration-fast) var(--easing-smooth);
}

.mgb-pop-enter-from,
.mgb-pop-leave-to {
  opacity: 0;
  transform: translateY(var(--spacing-sm));
}
</style>
