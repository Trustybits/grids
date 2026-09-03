<template>
  <teleport to="body">
    <div
      class="og-studio modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="OpenGraph Editor"
      @click.stop
      @pointerdown.stop
      @mousedown.stop
      @touchstart.stop
    >
      <!-- ── TOPBAR HEADER (Strict 56px height, stays on top of sidebars) ── -->
      <header class="og-studio__header">
        <div class="og-studio__brand">
          <h3 class="og-studio__title">OpenGraph Studio</h3>
          <span class="og-studio__badge">Early Access</span>

          <!-- Tour Help Button -->
          <button
            type="button"
            class="og-help-icon-btn"
            title="What is OpenGraph? Take a quick tour"
            @click="showTourModal = true"
          >
            <InfoCircleIcon :size="16" />
          </button>
        </div>

        <div class="og-studio__actions">
          <!-- Templates Picker Button -->
          <Button
            variant="secondary"
            size="sm"
            class="og-action-btn--desktop"
            title="Browse layout design templates"
            @click="showTemplateModal = true"
          >
            <template #icon-left>
              <GridSquaresIcon :size="15" />
            </template>
            Templates
          </Button>

          <!-- Motion Live Play Toggle -->
          <Button
            variant="secondary"
            size="sm"
            class="og-action-btn--desktop"
            :title="isLivePlay ? 'Pause motion preview' : 'Play motion preview'"
            @click="toggleLivePlay"
          >
            <span class="og-studio__action-content">
              <span class="og-play-indicator" :class="{ 'is-playing': isLivePlay }"></span>
              {{ isLivePlay ? "Pause" : "Play" }}
            </span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            class="og-action-btn--desktop"
            :loading="saving"
            @click="handleSave"
          >
            Save
          </Button>

          <Button
            variant="secondary"
            size="sm"
            class="og-action-btn--desktop"
            :loading="exportingPng"
            @click="handleExportPng"
          >
            Export PNG
          </Button>

          <Button
            variant="secondary"
            size="sm"
            class="og-action-btn--desktop"
            :disabled="!hasAnimation"
            :loading="exportingGif"
            @click="handleExportGif"
          >
            Export GIF
          </Button>

          <!-- Social Share Preview Button -->
          <Button
            variant="secondary"
            size="sm"
            class="og-preview-topbar-btn"
            title="Preview how this looks when shared on Twitter, WhatsApp, Discord, etc."
            @click="openPreview"
          >
            <template #icon-left>
              <EyeIcon :size="15" />
            </template>
            <span>Preview</span>
          </Button>

          <!-- Primary Apply Button -->
          <Button
            variant="primary"
            size="sm"
            class="og-apply-hero-btn"
            :loading="applyingToGrid"
            @click="handleApplyAsShareImage"
          >
            <template #icon-left>
              <CheckIcon :size="16" />
            </template>
            <span>Apply to Grid</span>
          </Button>

          <Button variant="ghost" size="sm" icon-only @click="$emit('close')">
            <template #icon-left><CloseXIcon :size="18" /></template>
          </Button>
        </div>
      </header>

      <!-- ── STUDIO BODY (Starts strictly below topbar) ──────────────── -->
      <div class="og-studio__body">
        <!-- Left Sidebar: Tile Picker -->
        <aside
          class="og-studio__picker"
          :class="{ 'is-mobile-open': activeMobileTab === 'tiles' }"
        >
          <div class="og-drawer-mobile-header">
            <h4>Cards & Tiles</h4>
            <button type="button" class="og-drawer-close-btn" @click="activeMobileTab = 'canvas'">
              <CloseXIcon :size="16" />
            </button>
          </div>
          <TilePicker
            :grid-tiles="gridTiles"
            :custom-tiles="config.customTiles"
            :active-tile-ids="activeTileIds"
            @add-tile="addTile"
            @create-custom-tile="handleCreateCustomTile"
            @delete-custom-tile="handleDeleteCustomTile"
          />
        </aside>

        <!-- Center: Interactive Canvas -->
        <main class="og-studio__canvas" @click="handleCanvasBackdropClick">
          <OGCanvas
            ref="canvasRef"
            :config="config"
            :grid-tiles="gridTiles"
            :selected-tile-id="selectedTileId"
            @update:config="onUpdateConfig"
            @select-tile="selectedTileId = $event"
          />
        </main>

        <!-- Right Sidebar: Inspector (Starts below header, strictly 320px) -->
        <aside
          class="og-studio__inspector"
          :class="{ 'is-mobile-open': activeMobileTab === 'inspector' }"
        >
          <div class="og-drawer-mobile-header">
            <h4>Settings & Theme</h4>
            <button type="button" class="og-drawer-close-btn" @click="activeMobileTab = 'canvas'">
              <CloseXIcon :size="16" />
            </button>
          </div>
          <OGInspector
            :config="config"
            :grid-tiles="gridTiles"
            :selected-tile-id="selectedTileId"
            :is-applying="applyingToGrid"
            @update:config="onUpdateConfig"
            @select-tile="selectedTileId = $event"
            @apply="handleApplyAsShareImage"
            @preview="openPreview"
            @open-templates="showTemplateModal = true"
          />
        </aside>

        <!-- Mobile Drawer Backdrop Overlay -->
        <div
          v-if="activeMobileTab !== 'canvas'"
          class="og-mobile-backdrop"
          @click="activeMobileTab = 'canvas'"
        />
      </div>

      <!-- ── MOBILE VIEW SWITCHER / BOTTOM NAVIGATION (≤ 1024px) ──────── -->
      <nav class="og-studio__mobile-tabs">
        <button
          type="button"
          class="og-mobile-tab"
          :class="{ 'is-active': activeMobileTab === 'canvas' }"
          @click="activeMobileTab = 'canvas'"
        >
          <span class="og-mobile-tab__icon">🎨</span>
          <span>Canvas</span>
        </button>

        <button
          type="button"
          class="og-mobile-tab"
          :class="{ 'is-active': activeMobileTab === 'tiles' }"
          @click="activeMobileTab = 'tiles'"
        >
          <span class="og-mobile-tab__icon">📦</span>
          <span>Cards ({{ totalCardsCount }})</span>
        </button>

        <button
          type="button"
          class="og-mobile-tab"
          :class="{ 'is-active': activeMobileTab === 'inspector' }"
          @click="activeMobileTab = 'inspector'"
        >
          <span class="og-mobile-tab__icon">⚙️</span>
          <span>Settings</span>
        </button>

        <button
          type="button"
          class="og-mobile-tab"
          @click="showTemplateModal = true"
        >
          <span class="og-mobile-tab__icon">📐</span>
          <span>Templates</span>
        </button>
      </nav>

      <!-- ── MODALS: Tour, Social Preview, Template Presets ──────────── -->
      <OGTourModal
        v-if="showTourModal"
        @close="showTourModal = false"
      />

      <OGSocialPreviewModal
        v-if="showPreviewModal"
        :preview-image-src="previewImageSrc"
        :title="effectiveTitle"
        :subtitle="effectiveSubtitle"
        :author-name="authorName"
        :author-handle="authorHandle"
        :author-initials="effectiveInitials"
        :is-applying="applyingToGrid"
        @close="showPreviewModal = false"
        @apply="handleApplyAsShareImage"
      />

      <OGTemplateModal
        v-if="showTemplateModal"
        :current-template="config.layoutTemplate"
        @select-template="handleSelectTemplate"
        @close="showTemplateModal = false"
      />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, toRef } from "vue";
import Button from "@/components/ui-elements/Button.vue";
import CloseXIcon from "@/components/icons/CloseXIcon.vue";
import CheckIcon from "@/components/icons/CheckIcon.vue";
import EyeIcon from "@/components/icons/EyeIcon.vue";
import GridSquaresIcon from "@/components/icons/GridSquaresIcon.vue";
import InfoCircleIcon from "@/components/icons/InfoCircleIcon.vue";
import TilePicker from "./TilePicker.vue";
import OGCanvas from "./OGCanvas.vue";
import OGInspector from "./OGInspector.vue";
import OGTourModal from "./OGTourModal.vue";
import OGSocialPreviewModal from "./OGSocialPreviewModal.vue";
import OGTemplateModal from "./OGTemplateModal.vue";
import { useOGConfig } from "@/composables/useOGConfig";
import { useOGExport } from "@/composables/useOGExport";
import { useToastStore } from "@/stores/toast";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { getBackgroundPreset } from "@/lib/animate";
import { OG_SAFE_ZONE_START, OG_SAFE_ZONE_END, type OGConfig } from "@/types/og";
import { applyLayoutTemplate } from "@/utils/ogTemplates";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { useGridController } from "@/controllers/useGridController";
import { customOgImagePath, withVersionParam } from "@/utils/OgImageUtils";

const props = defineProps<{
  gridId: string;
  gridTiles: Array<any>;
}>();

const emit = defineEmits<{
  close: [];
}>();

const toastStore = useToastStore();
const sessionStore = useGridSessionStore();

const gridIdRef = toRef(props, "gridId");
const { config, save } = useOGConfig(gridIdRef);

const selectedTileId = ref<string | null>(null);
const canvasRef = ref<InstanceType<typeof OGCanvas> | null>(null);

// Responsive Tablet/Mobile Active View ('canvas' | 'tiles' | 'inspector')
const activeMobileTab = ref<"canvas" | "tiles" | "inspector">("canvas");

// Modals State
const showTourModal = ref(false);
const showPreviewModal = ref(false);
const showTemplateModal = ref(false);
const previewImageSrc = ref<string | undefined>(undefined);

onMounted(() => {
  try {
    const seen = localStorage.getItem("grids_og_tour_seen");
    if (!seen) {
      showTourModal.value = true;
    }
  } catch {
    // ignore
  }
});

const totalCardsCount = computed(
  () => props.gridTiles.length + (config.value.customTiles?.length || 0),
);

const activeTileIds = computed(() => config.value.tiles.map((t) => t.tileId));

const authorName = computed(() => sessionStore.currentGrid?.name || "My Grid");
const authorHandle = computed(
  () => (sessionStore.currentGrid as any)?.slug || sessionStore.publicGridId || "grids.so",
);
const effectiveTitle = computed(() => config.value.customTitle?.trim() || authorName.value);
const effectiveSubtitle = computed(
  () => config.value.customSubtitle?.trim() || "Curated links, stories & media",
);
const effectiveInitials = computed(() => {
  if (config.value.customAvatarInitials?.trim()) {
    return config.value.customAvatarInitials.trim().slice(0, 3).toUpperCase();
  }
  return (authorName.value.slice(0, 2) || "G").toUpperCase();
});

const onUpdateConfig = (next: OGConfig) => {
  config.value = next;
};

const handleCanvasBackdropClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    selectedTileId.value = null;
  }
};

const addTile = (tileId: string) => {
  const leftCount = config.value.tiles.filter((t) => t.x <= 50).length;
  const rightCount = config.value.tiles.length - leftCount;
  const useLeft = leftCount <= rightCount;
  const wingCenter = useLeft
    ? OG_SAFE_ZONE_START / 2
    : OG_SAFE_ZONE_END + (100 - OG_SAFE_ZONE_END) / 2;
  const stackIndex = useLeft ? leftCount : rightCount;
  const y = 20 + (stackIndex % 3) * 30;

  config.value = {
    ...config.value,
    tiles: [
      ...config.value.tiles,
      {
        tileId,
        x: wingCenter,
        y: Math.min(y, 90),
        rotation: 0,
        scale: 1,
        opacity: 1,
      },
    ],
  };
  selectedTileId.value = tileId;
  // If on mobile/tablet, switch back to canvas so user sees the newly placed card!
  activeMobileTab.value = "canvas";
};

const handleCreateCustomTile = (tile: any) => {
  const currentCustom = config.value.customTiles ?? [];
  config.value = {
    ...config.value,
    customTiles: [...currentCustom, tile],
  };
  addTile(tile.i);
  toastStore.addToast("Custom card added to canvas!", "success");
};

const handleDeleteCustomTile = (tileId: string) => {
  const customTiles = (config.value.customTiles ?? []).filter((t: any) => t.i !== tileId);
  const tiles = config.value.tiles.filter((t) => t.tileId !== tileId);
  config.value = {
    ...config.value,
    customTiles,
    tiles,
  };
  if (selectedTileId.value === tileId) {
    selectedTileId.value = null;
  }
  toastStore.addToast("Custom card removed", "info");
};

const handleSelectTemplate = (templateId: string) => {
  config.value = applyLayoutTemplate(config.value, templateId);
  toastStore.addToast(`Applied ${templateId} layout template`, "info");
};

const storageService = getServiceFactory().getStorageService();
const authProvider = getAuthProvider();
const controller = useGridController();

const applyingToGrid = ref(false);

const isLivePlay = computed(() => config.value.animation?.livePlay !== false);

const toggleLivePlay = () => {
  config.value = {
    ...config.value,
    animation: {
      ...(config.value.animation ?? {
        tileAnimation: "none",
        tileSpeed: 3,
        livePlay: true,
      }),
      livePlay: !isLivePlay.value,
    },
  };
};

const hasAnimation = computed(() => {
  const preset = getBackgroundPreset(config.value.background.presetId);
  const bgAnim =
    preset?.category === "animated" ||
    ((preset?.category === "gradient" || preset?.category === "pattern") &&
      !!config.value.background.animated);
  const tileAnim =
    (config.value.animation?.tileAnimation ?? "none") !== "none" ||
    config.value.tiles.some((t) => t.animation && t.animation !== "none");
  return bgAnim || tileAnim;
});

const stageEl = computed(() => canvasRef.value?.getStageEl() ?? null);
const { exportPNG, exportGIF } = useOGExport(stageEl);

const saving = ref(false);
const exportingPng = ref(false);
const exportingGif = ref(false);

const handleSave = async () => {
  saving.value = true;
  try {
    await save();
    toastStore.addToast("OpenGraph layout saved", "success");
  } catch (error) {
    toastStore.addToast(
      error instanceof Error ? error.message : "Failed to save layout",
      "error",
    );
  } finally {
    saving.value = false;
  }
};

const handleExportPng = async () => {
  exportingPng.value = true;
  try {
    await exportPNG();
  } finally {
    exportingPng.value = false;
  }
};

const handleExportGif = async () => {
  exportingGif.value = true;
  try {
    await exportGIF();
  } finally {
    exportingGif.value = false;
  }
};

const openPreview = async () => {
  const el = stageEl.value;
  if (!el) {
    showPreviewModal.value = true;
    return;
  }
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, { backgroundColor: null, useCORS: true });
    previewImageSrc.value = canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Failed to rasterize preview canvas", err);
  }
  showPreviewModal.value = true;
};

const handleApplyAsShareImage = async () => {
  const el = stageEl.value;
  if (!el || !props.gridId) return;
  const userId = authProvider.getCurrentUserId();
  if (!userId) {
    toastStore.addToast("You must be logged in to apply the share image", "error");
    return;
  }
  applyingToGrid.value = true;
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, { backgroundColor: null, useCORS: true });
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("Could not create image blob");
    const file = new File([blob], "og-image.png", { type: "image/png" });
    const url = await storageService.uploadToPath(
      customOgImagePath(userId, props.gridId),
      file,
      { contentType: "image/png" },
    );
    controller.setCustomOgImage(withVersionParam(url, Date.now()));
    await save();
    toastStore.addToast("Applied as grid social share image!", "success");
    showPreviewModal.value = false;
  } catch (error) {
    console.error("Failed to apply share image:", error);
    toastStore.addToast(
      error instanceof Error ? error.message : "Failed to apply share image",
      "error",
    );
  } finally {
    applyingToGrid.value = false;
  }
};
</script>

<style lang="scss" scoped>
.og-studio {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal, 1050) + 10);
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background: #08080a;
}

/* ── Topbar: Fixed 56px height strictly atop the studio ─────────────────── */
.og-studio__header {
  height: 56px;
  min-height: 56px;
  max-height: 56px;
  flex: 0 0 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: #0e0e11;
  z-index: 30;
  box-sizing: border-box;
}

.og-studio__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.og-studio__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
}

.og-studio__badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--color-figma-purple, #a855f7);
  color: #ffffff;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.og-help-icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #a1a1aa;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.3);
  }
}

.og-studio__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.og-studio__action-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.og-play-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #71717a;
  transition: background 0.2s ease, box-shadow 0.2s ease;

  &.is-playing {
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.7);
  }
}

.og-preview-topbar-btn {
  font-weight: 600;
}

.og-apply-hero-btn {
  font-weight: 700;
}

/* ── Body: Desktop 3-Column Layout ──────────────────────────────────────── */
.og-studio__body {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  display: flex;
  position: relative;
  overflow: hidden;
}

.og-studio__picker {
  width: 250px;
  flex: 0 0 250px;
  height: 100%;
  max-height: 100%;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: #0c0c0e;
  overflow-y: auto;
  z-index: 10;
}

.og-studio__canvas {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
  background: #08080a;
}

.og-studio__canvas > * {
  width: 100%;
  max-width: 1000px;
}

.og-studio__inspector {
  width: 320px;
  flex: 0 0 320px;
  height: 100%;
  max-height: 100%;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  background: #000000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.og-drawer-mobile-header {
  display: none;
}

/* ── Mobile Navigation Switcher (Hidden on Desktop) ─────────────────────── */
.og-studio__mobile-tabs {
  display: none;
  height: 52px;
  min-height: 52px;
  flex: 0 0 52px;
  background: #0e0e11;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0 8px;
  align-items: center;
  justify-content: space-around;
  z-index: 30;
}

.og-mobile-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: transparent;
  border: none;
  color: #71717a;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 0;
  cursor: pointer;
  transition: color 0.15s ease;

  &__icon {
    font-size: 16px;
  }

  &.is-active {
    color: var(--color-figma-purple, #a855f7);
  }
}

.og-mobile-backdrop {
  display: none;
}

/* ── Small Viewports (Tablets & Mobile: ≤ 1024px) ────────────────────────── */
@media (max-width: 1024px) {
  .og-action-btn--desktop {
    display: none !important;
  }

  .og-studio__mobile-tabs {
    display: flex;
  }

  .og-studio__canvas {
    padding: 12px;
  }

  /* Sidebars slide up / slide over on mobile when active */
  .og-studio__picker,
  .og-studio__inspector {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 320px;
    max-width: 85vw;
    z-index: 40;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 0 32px rgba(0, 0, 0, 0.8);
  }

  .og-studio__picker {
    left: 0;
    transform: translateX(-100%);

    &.is-mobile-open {
      transform: translateX(0);
    }
  }

  .og-studio__inspector {
    right: 0;
    transform: translateX(100%);

    &.is-mobile-open {
      transform: translateX(0);
    }
  }

  .og-drawer-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: #141417;

    h4 {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
    }
  }

  .og-drawer-close-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #a1a1aa;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }
  }

  .og-mobile-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 35;
  }
}
</style>
