<template>
  <teleport to="body">
    <div class="og-studio" role="dialog" aria-modal="true" aria-label="OG Image Studio">
      <header class="og-studio__header">
        <h3 class="og-studio__title">OG Image Studio</h3>
        <div class="og-studio__actions">
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
            @update:config="onUpdateConfig"
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
import TilePicker from "./TilePicker.vue";
import OGCanvas from "./OGCanvas.vue";
import OGInspector from "./OGInspector.vue";
import { useOGConfig } from "@/composables/useOGConfig";
import { useOGExport } from "@/composables/useOGExport";
import { useToastStore } from "@/stores/toast";
import { getBackgroundPreset } from "@/lib/animate";
import { OG_SAFE_ZONE_START, OG_SAFE_ZONE_END, type OGConfig } from "@/types/og";

const props = defineProps<{
  gridId: string;
  gridTiles: Array<{ id: string; label: string; color: string }>;
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

const hasAnimation = computed(() => {
  const preset = getBackgroundPreset(config.value.background.presetId);
  if (!preset) return false;
  if (preset.category === "animated") return true;
  if (preset.category === "gradient" || preset.category === "pattern") {
    return !!config.value.background.animated;
  }
  return false;
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
    toastStore.addToast("OG image layout saved", "success");
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

.og-studio__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
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
  width: 300px;
  flex-shrink: 0;
  border-left: var(--border-width) solid var(--color-stroke);
  overflow-y: auto;
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
