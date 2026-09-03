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
      <header class="og-studio__header">
        <div class="og-studio__brand">
          <h3 class="og-studio__title">OpenGraph Editor</h3>
          <span class="og-studio__badge">Early Access</span>
        </div>
        <div class="og-studio__actions">
          <Button
            variant="secondary"
            size="sm"
            :title="isLivePlay ? 'Pause motion preview' : 'Play motion preview'"
            @click="toggleLivePlay"
          >
            <span class="og-studio__action-content">
              <span class="og-play-indicator" :class="{ 'is-playing': isLivePlay }"></span>
              {{ isLivePlay ? "Pause Motion" : "Play Motion" }}
            </span>
          </Button>
          <Button variant="secondary" size="sm" :loading="saving" @click="handleSave">
            Save
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :loading="exportingPng"
            @click="handleExportPng"
          >
            Export PNG
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :disabled="!hasAnimation"
            :loading="exportingGif"
            @click="handleExportGif"
          >
            Export GIF
          </Button>
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
            Apply to Grid
          </Button>
          <Button variant="ghost" size="sm" icon-only @click="$emit('close')">
            <template #icon-left><CloseXIcon :size="18" /></template>
          </Button>
        </div>
      </header>

      <div class="og-studio__body">
        <aside class="og-studio__picker">
          <TilePicker
            :grid-tiles="gridTiles"
            :active-tile-ids="activeTileIds"
            @add-tile="addTile"
          />
        </aside>

        <main class="og-studio__canvas">
          <OGCanvas
            ref="canvasRef"
            :config="config"
            :grid-tiles="gridTiles"
            :selected-tile-id="selectedTileId"
            @update:config="onUpdateConfig"
            @select-tile="selectedTileId = $event"
          />
        </main>

        <aside class="og-studio__inspector">
          <OGInspector
            :config="config"
            :selected-tile-id="selectedTileId"
            :is-applying="applyingToGrid"
            @update:config="onUpdateConfig"
            @apply="handleApplyAsShareImage"
          />
        </aside>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef } from "vue";
import Button from "@/components/ui-elements/Button.vue";
import CloseXIcon from "@/components/icons/CloseXIcon.vue";
import CheckIcon from "@/components/icons/CheckIcon.vue";
import TilePicker from "./TilePicker.vue";
import OGCanvas from "./OGCanvas.vue";
import OGInspector from "./OGInspector.vue";
import { useOGConfig } from "@/composables/useOGConfig";
import { useOGExport } from "@/composables/useOGExport";
import { useToastStore } from "@/stores/toast";
import { getBackgroundPreset } from "@/lib/animate";
import { OG_SAFE_ZONE_START, OG_SAFE_ZONE_END, type OGConfig } from "@/types/og";
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

const gridIdRef = toRef(props, "gridId");
const { config, save } = useOGConfig(gridIdRef);

const selectedTileId = ref<string | null>(null);
const canvasRef = ref<InstanceType<typeof OGCanvas> | null>(null);

const activeTileIds = computed(() => config.value.tiles.map((t) => t.tileId));

const onUpdateConfig = (next: OGConfig) => {
  config.value = next;
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

const handleExportPng = async () => {
  exportingPng.value = true;
  try {
    await exportPNG();
  } catch (error) {
    toastStore.addToast(
      error instanceof Error ? error.message : "Failed to export PNG",
      "error",
    );
  } finally {
    exportingPng.value = false;
  }
};

const handleExportGif = async () => {
  exportingGif.value = true;
  try {
    await exportGIF();
  } catch (error) {
    toastStore.addToast(
      error instanceof Error ? error.message : "Failed to export GIF",
      "error",
    );
  } finally {
    exportingGif.value = false;
  }
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") emit("close");
};

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<style lang="scss" scoped>
.og-studio {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal, 1050) + 10);
  display: flex;
  flex-direction: column;
  background: var(--color-page-background, var(--color-content-background));
}

.og-studio__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-bottom: var(--border-width) solid var(--color-stroke);
  flex-shrink: 0;
}

.og-studio__brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.og-studio__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.og-studio__badge {
  font-size: var(--font-size-xs, 11px);
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-figma-purple, #7b61ff);
  color: #fff;
  letter-spacing: 0.02em;
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
  background: var(--color-content-low, #888);
  transition: background 0.2s ease, box-shadow 0.2s ease;

  &.is-playing {
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.7);
  }
}

.og-studio__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.og-studio__body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.og-studio__picker {
  width: 240px;
  flex-shrink: 0;
  border-right: var(--border-width) solid var(--color-stroke);
  overflow-y: auto;
}

.og-studio__canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  min-width: 0;
  overflow: auto;
}

.og-studio__canvas > * {
  width: 100%;
  max-width: 1000px;
}

.og-studio__inspector {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  background: #000000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@media (max-width: 900px) {
  .og-studio__body {
    flex-direction: column;
    overflow-y: auto;
  }

  .og-studio__picker,
  .og-studio__inspector {
    width: 100%;
    border: none;
    border-bottom: var(--border-width) solid var(--color-stroke);
  }

  .og-studio__canvas {
    padding: var(--spacing-md);
  }
}
</style>
