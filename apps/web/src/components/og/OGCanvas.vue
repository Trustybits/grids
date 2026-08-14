<template>
  <div ref="viewportRef" class="og-canvas-viewport">
    <div
      ref="stageRef"
      class="og-canvas-stage"
      :style="stageStyle"
      @pointerdown.self="selectTile(null)"
    >
      <BackgroundLayer :config="config.background" />

      <div class="og-canvas__wing og-canvas__wing--left" :style="leftWingStyle" />
      <div class="og-canvas__wing og-canvas__wing--right" :style="rightWingStyle" />

      <div class="og-canvas__safezone" :style="safeZoneStyle">
        <div v-if="config.visibility.avatar" class="og-placeholder og-placeholder--avatar" />
        <div class="og-placeholder-group">
          <div v-if="config.visibility.name" class="og-placeholder og-placeholder--name" />
          <div v-if="config.visibility.subtitle" class="og-placeholder og-placeholder--subtitle" />
          <div v-if="config.visibility.handle" class="og-placeholder og-placeholder--handle" />
        </div>
      </div>

      <div
        v-for="placement in config.tiles"
        :key="placement.tileId"
        class="og-canvas__tile"
        :class="{
          'is-selected': placement.tileId === selectedTileId,
          'is-dragging': placement.tileId === draggingId,
        }"
        :style="tileStyle(placement)"
        @pointerdown="onTilePointerDown($event, placement)"
      >
        <span class="og-canvas__tile-label">{{ tileLabel(placement.tileId) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { BackgroundLayer } from "@/lib/animate";
import {
  OG_CANVAS_WIDTH,
  OG_CANVAS_HEIGHT,
  OG_SAFE_ZONE_START,
  OG_SAFE_ZONE_END,
  type OGConfig,
  type OGTilePlacement,
} from "@/types/og";

const props = defineProps<{
  config: OGConfig;
  gridTiles: Array<{ id: string; color: string; label?: string }>;
  selectedTileId?: string | null;
}>();

const emit = defineEmits<{
  "update:config": [config: OGConfig];
  "select-tile": [tileId: string | null];
}>();

const viewportRef = ref<HTMLElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);

const stageStyle = computed(() => ({
  width: `${OG_CANVAS_WIDTH}px`,
  height: `${OG_CANVAS_HEIGHT}px`,
  transform: `scale(${scale.value})`,
}));

const scale = ref(1);
let resizeObserver: ResizeObserver | null = null;

const updateScale = () => {
  const width = viewportRef.value?.clientWidth ?? OG_CANVAS_WIDTH;
  scale.value = width / OG_CANVAS_WIDTH;
};

onMounted(() => {
  updateScale();
  if (typeof ResizeObserver !== "undefined" && viewportRef.value) {
    resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(viewportRef.value);
  } else {
    window.addEventListener("resize", updateScale);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("resize", updateScale);
});

const leftWingStyle = computed(() => ({
  left: "0%",
  width: `${OG_SAFE_ZONE_START}%`,
}));

const rightWingStyle = computed(() => ({
  left: `${OG_SAFE_ZONE_END}%`,
  width: `${100 - OG_SAFE_ZONE_END}%`,
}));

const safeZoneStyle = computed(() => ({
  left: `${OG_SAFE_ZONE_START}%`,
  width: `${OG_SAFE_ZONE_END - OG_SAFE_ZONE_START}%`,
}));

const TILE_BASE_PX = 96;

const tileWidthPercent = (scaleFactor: number) =>
  ((TILE_BASE_PX * scaleFactor) / OG_CANVAS_WIDTH) * 100;
const tileHeightPercent = (scaleFactor: number) =>
  ((TILE_BASE_PX * scaleFactor) / OG_CANVAS_HEIGHT) * 100;

const colorForTile = (tileId: string): string =>
  props.gridTiles.find((t) => t.id === tileId)?.color ?? "#6366f1";

const tileLabel = (tileId: string): string => {
  const match = props.gridTiles.find((t) => t.id === tileId);
  const label = match?.label ?? tileId;
  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
};

const tileStyle = (placement: OGTilePlacement) => ({
  left: `${placement.x}%`,
  top: `${placement.y}%`,
  width: `${tileWidthPercent(placement.scale)}%`,
  height: `${tileHeightPercent(placement.scale)}%`,
  opacity: placement.opacity,
  transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
  background: colorForTile(placement.tileId),
});

const selectTile = (tileId: string | null) => {
  emit("select-tile", tileId);
};

// ─── Drag handling ──────────────────────────────────────────────────────
// One shared pointer-drag session (only one tile can drag at a time), driven
// directly off Pointer Events + setPointerCapture — the same technique as
// `useDraggable`, generalized to a dynamic list of tile elements sharing one
// window-level listener pair.
const draggingId = ref<string | null>(null);
let activePointerId: number | null = null;
let startClientX = 0;
let startClientY = 0;
let startX = 0;
let startY = 0;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const updatePlacement = (tileId: string, x: number, y: number) => {
  const tiles = props.config.tiles.map((t) =>
    t.tileId === tileId ? { ...t, x, y } : t,
  );
  emit("update:config", { ...props.config, tiles });
};

const onTilePointerDown = (event: PointerEvent, placement: OGTilePlacement) => {
  const target = event.currentTarget as HTMLElement;
  draggingId.value = placement.tileId;
  activePointerId = event.pointerId;
  startClientX = event.clientX;
  startClientY = event.clientY;
  startX = placement.x;
  startY = placement.y;
  target.setPointerCapture?.(event.pointerId);
  selectTile(placement.tileId);

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
};

const onPointerMove = (event: PointerEvent) => {
  if (!draggingId.value || event.pointerId !== activePointerId) return;
  const rect = stageRef.value?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return;
  const dxPercent = ((event.clientX - startClientX) / rect.width) * 100;
  const dyPercent = ((event.clientY - startClientY) / rect.height) * 100;
  const x = clamp(startX + dxPercent, 0, 100);
  const y = clamp(startY + dyPercent, 0, 100);
  updatePlacement(draggingId.value, x, y);
};

// Tiles must live in a wing — snap back into the nearest one once the drag
// ends (free movement mid-drag makes the gesture feel natural).
const onPointerUp = (event: PointerEvent) => {
  if (event.pointerId !== activePointerId) return;
  const tileId = draggingId.value;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
  draggingId.value = null;
  activePointerId = null;
  if (!tileId) return;

  const placement = props.config.tiles.find((t) => t.tileId === tileId);
  if (!placement) return;

  let x = placement.x;
  if (x > OG_SAFE_ZONE_START && x < OG_SAFE_ZONE_END) {
    const distanceToLeft = x - OG_SAFE_ZONE_START;
    const distanceToRight = OG_SAFE_ZONE_END - x;
    x = distanceToLeft <= distanceToRight ? OG_SAFE_ZONE_START : OG_SAFE_ZONE_END;
  }
  x = clamp(x, 0, 100);
  updatePlacement(tileId, x, placement.y);
};

defineExpose({ getStageEl: () => stageRef.value });
</script>

<style scoped>
.og-canvas-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 1200 / 630;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: var(--border-width) solid var(--color-stroke);
  background: var(--color-content-background);
}

.og-canvas-stage {
  position: relative;
  transform-origin: top left;
  overflow: hidden;
}

.og-canvas__wing {
  position: absolute;
  top: 0;
  bottom: 0;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  box-sizing: border-box;
  pointer-events: none;
}

.og-canvas__safezone {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  pointer-events: none;
}

.og-placeholder {
  background: rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-sm);
}

.og-placeholder--avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
}

.og-placeholder-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.og-placeholder--name {
  width: 220px;
  height: 28px;
}

.og-placeholder--subtitle {
  width: 160px;
  height: 18px;
}

.og-placeholder--handle {
  width: 120px;
  height: 16px;
}

.og-canvas__tile {
  position: absolute;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.og-canvas__tile.is-selected {
  outline: 2px solid var(--color-figma-purple);
  outline-offset: 2px;
}

.og-canvas__tile.is-dragging {
  cursor: grabbing;
  z-index: 5;
}

.og-canvas__tile-label {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
</style>
