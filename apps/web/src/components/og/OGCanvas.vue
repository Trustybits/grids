<template>
  <div ref="viewportRef" class="og-canvas-viewport">
    <div
      ref="stageRef"
      class="og-canvas-stage"
      :style="stageStyle"
      @pointerdown.self="selectTile(null)"
    >
      <BackgroundLayer :config="config.background" />

      <!-- Wing guide guides (only in center template) -->
      <template v-if="(config.layoutTemplate || 'center') === 'center'">
        <div class="og-canvas__wing og-canvas__wing--left" :style="leftWingStyle" />
        <div class="og-canvas__wing og-canvas__wing--right" :style="rightWingStyle" />
      </template>

      <!-- Center / Responsive Safe Zone -->
      <div
        class="og-canvas__safezone"
        :class="[`og-layout--${config.layoutTemplate || 'center'}`]"
        :style="safeZoneStyle"
      >
        <div v-if="config.visibility.avatar" class="og-avatar-wrap">
          <div class="og-avatar-circle">
            <img
              v-if="config.customAvatarImage"
              :src="config.customAvatarImage"
              alt="Avatar"
              class="og-avatar-img"
            />
            <span v-else class="og-avatar-initials">{{ avatarDisplayInitials }}</span>
          </div>
        </div>
        <div class="og-info-group">
          <div v-if="config.visibility.name" class="og-title-text">
            {{ effectiveGridTitle }}
          </div>
          <div v-if="config.visibility.subtitle" class="og-subtitle-text">
            {{ effectiveGridSubtitle }}
          </div>
          <div v-if="config.visibility.handle" class="og-handle-badge">
            <span class="og-handle-at">@</span>{{ gridHandle }}
          </div>
        </div>
      </div>

      <!-- Placed Tiles on Canvas -->
      <div
        v-for="(placement, index) in config.tiles"
        :key="placement.tileId"
        class="og-canvas__tile"
        :class="[
          {
            'is-selected': placement.tileId === selectedTileId,
            'is-dragging': placement.tileId === draggingId,
          },
          tileAnimationClass(placement),
        ]"
        :style="tileStyle(placement, index)"
        @pointerdown.stop="onTilePointerDown($event, placement)"
        @click.stop
      >
        <OGTileCard
          v-if="getTile(placement.tileId)"
          :tile="getTile(placement.tileId)!"
          :theme="placement.theme || 'dark'"
        />
        <span v-else class="og-canvas__tile-label">{{ tileLabel(placement.tileId) }}</span>

        <!-- Direct Manipulation Transform Handles (Canva / Photoshop style) -->
        <template v-if="placement.tileId === selectedTileId && !draggingId">
          <!-- Top Rotation Stem & Handle -->
          <div
            class="og-handle-rotate"
            title="Drag to rotate / tilt"
            @pointerdown.stop="onRotatePointerDown($event, placement)"
          >
            <div class="og-handle-rotate__stem" />
            <div class="og-handle-rotate__knob">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </div>
          </div>

          <!-- 4 Corner Outward Resize Handles -->
          <div
            class="og-handle-resize og-handle-resize--nw"
            title="Drag to resize"
            @pointerdown.stop="onResizePointerDown($event, placement)"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
              <path d="M7 17L17 7M7 7h10v10"/>
            </svg>
          </div>
          <div
            class="og-handle-resize og-handle-resize--ne"
            title="Drag to resize"
            @pointerdown.stop="onResizePointerDown($event, placement)"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
              <path d="M7 17L17 7M7 7h10v10"/>
            </svg>
          </div>
          <div
            class="og-handle-resize og-handle-resize--se"
            title="Drag to resize"
            @pointerdown.stop="onResizePointerDown($event, placement)"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
              <path d="M7 17L17 7M7 7h10v10"/>
            </svg>
          </div>
          <div
            class="og-handle-resize og-handle-resize--sw"
            title="Drag to resize"
            @pointerdown.stop="onResizePointerDown($event, placement)"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
              <path d="M7 17L17 7M7 7h10v10"/>
            </svg>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { BackgroundLayer } from "@/lib/animate";
import OGTileCard from "./OGTileCard.vue";
import type { Tile } from "@grids/contracts/types";
import {
  OG_CANVAS_WIDTH,
  OG_CANVAS_HEIGHT,
  OG_SAFE_ZONE_START,
  OG_SAFE_ZONE_END,
  type OGConfig,
  type OGTilePlacement,
} from "@/types/og";
import { useGridSessionStore } from "@/stores/grid/gridSession";

const props = defineProps<{
  config: OGConfig;
  gridTiles: Array<any>;
  selectedTileId?: string | null;
}>();

const emit = defineEmits<{
  "update:config": [config: OGConfig];
  "select-tile": [tileId: string | null];
}>();

const viewportRef = ref<HTMLElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);

const scale = ref(1);
let resizeObserver: ResizeObserver | null = null;

const stageStyle = computed(() => ({
  width: `${OG_CANVAS_WIDTH}px`,
  height: `${OG_CANVAS_HEIGHT}px`,
  transform: `scale(${scale.value})`,
}));

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

const safeZoneStyle = computed(() => {
  const tpl = props.config.layoutTemplate || "center";
  if (tpl === "split") {
    return { left: "4%", width: "42%" };
  }
  if (tpl === "gallery") {
    return { left: "12%", width: "76%" };
  }
  return {
    left: `${OG_SAFE_ZONE_START}%`,
    width: `${OG_SAFE_ZONE_END - OG_SAFE_ZONE_START}%`,
  };
});

const getTile = (tileId: string): Tile | null => {
  // Support custom virtual tiles first
  const custom = props.config.customTiles?.find((t: any) => t.i === tileId || t.id === tileId);
  if (custom) return custom as Tile;

  const match = props.gridTiles.find((t: any) => t.i === tileId || t.id === tileId);
  if (!match) return null;
  if (match.content) return match as Tile;
  return {
    i: match.id || tileId,
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    content: {
      type: "text" as any,
      text: match.label || "Tile",
      backgroundColor: match.color,
    } as any,
  } as Tile;
};

const tileLabel = (tileId: string): string => {
  const tile = getTile(tileId);
  if (tile) {
    const c = tile.content as any;
    const label = tile.caption?.trim() || c?.title || c?.label || c?.name || tile.content.type;
    if (label) return label.length > 14 ? `${label.slice(0, 13)}…` : label;
  }
  const match = props.gridTiles.find((t: any) => t.id === tileId || t.i === tileId);
  const label = match?.label ?? tileId;
  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
};

const sessionStore = useGridSessionStore();
const gridTitle = computed(() => sessionStore.currentGrid?.name || "My Grid");
const gridSubtitle = computed(() => "Curated links, stories & media");
const gridHandle = computed(() => sessionStore.currentGrid?.slug || sessionStore.publicGridId || "grids.so");
const gridInitials = computed(() => (gridTitle.value.slice(0, 2) || "G").toUpperCase());

const avatarDisplayInitials = computed(() => {
  if (props.config.customAvatarInitials?.trim()) {
    return props.config.customAvatarInitials.trim().slice(0, 3).toUpperCase();
  }
  return gridInitials.value;
});

const effectiveGridTitle = computed(() => {
  if (props.config.customTitle?.trim()) {
    return props.config.customTitle.trim();
  }
  return gridTitle.value;
});

const effectiveGridSubtitle = computed(() => {
  if (props.config.customSubtitle?.trim()) {
    return props.config.customSubtitle.trim();
  }
  return gridSubtitle.value;
});

const tileAnimationClass = (placement: OGTilePlacement) => {
  if (draggingId.value === placement.tileId) return "";
  if (props.config.animation?.livePlay === false) return "";
  const anim = placement.animation || props.config.animation?.tileAnimation || "none";
  if (anim === "none") return "";
  return `og-anim--${anim}`;
};

const tileStyle = (placement: OGTilePlacement, index: number) => {
  const speed = props.config.animation?.tileSpeed ?? 3;
  const delay = ((index * 0.35) % 2).toFixed(2);
  const tile = getTile(placement.tileId);
  const baseW = 140 * (tile?.w ? Math.max(1, tile.w / 2) : 1);
  const baseH = 140 * (tile?.h ? Math.max(1, tile.h / 2) : 1);
  const wPct = ((baseW * placement.scale) / OG_CANVAS_WIDTH) * 100;
  const hPct = ((baseH * placement.scale) / OG_CANVAS_HEIGHT) * 100;

  return {
    left: `${placement.x}%`,
    top: `${placement.y}%`,
    width: `${wPct}%`,
    height: `${hPct}%`,
    opacity: placement.opacity,
    transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
    "--tile-rot": `${placement.rotation}deg`,
    "--tile-speed": `${speed}s`,
    "--tile-delay": `${delay}s`,
  };
};

const selectTile = (tileId: string | null) => {
  emit("select-tile", tileId);
};

// ─── Drag Handling ────────────────────────────────────────────────────────
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
  event.stopPropagation();
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
  // Snap out of center safezone only in center layout
  if ((props.config.layoutTemplate || "center") === "center") {
    if (x > OG_SAFE_ZONE_START && x < OG_SAFE_ZONE_END) {
      const distanceToLeft = x - OG_SAFE_ZONE_START;
      const distanceToRight = OG_SAFE_ZONE_END - x;
      x = distanceToLeft <= distanceToRight ? OG_SAFE_ZONE_START : OG_SAFE_ZONE_END;
    }
  }
  x = clamp(x, 0, 100);
  updatePlacement(tileId, x, placement.y);
};

// ─── Direct Manipulation: Rotate (Canva style) ────────────────────────────
let rotateTargetId: string | null = null;
let rotateCenter = { x: 0, y: 0 };
let rotateStartAngle = 0;
let rotateInitialRotation = 0;

const onRotatePointerDown = (event: PointerEvent, placement: OGTilePlacement) => {
  event.stopPropagation();
  const tileEl = (event.target as HTMLElement).closest(".og-canvas__tile");
  if (!tileEl) return;
  const rect = tileEl.getBoundingClientRect();
  rotateCenter = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  rotateTargetId = placement.tileId;
  rotateInitialRotation = placement.rotation || 0;
  rotateStartAngle = Math.atan2(event.clientY - rotateCenter.y, event.clientX - rotateCenter.x) * (180 / Math.PI);

  window.addEventListener("pointermove", onRotatePointerMove);
  window.addEventListener("pointerup", onRotatePointerUp);
  window.addEventListener("pointercancel", onRotatePointerUp);
};

const onRotatePointerMove = (event: PointerEvent) => {
  if (!rotateTargetId) return;
  const currentAngle = Math.atan2(event.clientY - rotateCenter.y, event.clientX - rotateCenter.x) * (180 / Math.PI);
  const delta = currentAngle - rotateStartAngle;
  let newRot = Math.round((rotateInitialRotation + delta) % 360);
  if (newRot > 180) newRot -= 360;
  if (newRot < -180) newRot += 360;

  const tiles = props.config.tiles.map((t) =>
    t.tileId === rotateTargetId ? { ...t, rotation: newRot } : t,
  );
  emit("update:config", { ...props.config, tiles });
};

const onRotatePointerUp = () => {
  rotateTargetId = null;
  window.removeEventListener("pointermove", onRotatePointerMove);
  window.removeEventListener("pointerup", onRotatePointerUp);
  window.removeEventListener("pointercancel", onRotatePointerUp);
};

// ─── Direct Manipulation: Resize (Canva style) ────────────────────────────
let resizeTargetId: string | null = null;
let resizeCenter = { x: 0, y: 0 };
let resizeInitialDist = 0;
let resizeInitialScale = 1;

const onResizePointerDown = (event: PointerEvent, placement: OGTilePlacement) => {
  event.stopPropagation();
  const tileEl = (event.target as HTMLElement).closest(".og-canvas__tile");
  if (!tileEl) return;
  const rect = tileEl.getBoundingClientRect();
  resizeCenter = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  resizeTargetId = placement.tileId;
  resizeInitialScale = placement.scale || 1;
  const dx = event.clientX - resizeCenter.x;
  const dy = event.clientY - resizeCenter.y;
  resizeInitialDist = Math.sqrt(dx * dx + dy * dy);

  window.addEventListener("pointermove", onResizePointerMove);
  window.addEventListener("pointerup", onResizePointerUp);
  window.addEventListener("pointercancel", onResizePointerUp);
};

const onResizePointerMove = (event: PointerEvent) => {
  if (!resizeTargetId || resizeInitialDist <= 0) return;
  const dx = event.clientX - resizeCenter.x;
  const dy = event.clientY - resizeCenter.y;
  const currentDist = Math.sqrt(dx * dx + dy * dy);
  const ratio = currentDist / resizeInitialDist;
  const newScale = Math.max(0.4, Math.min(2.4, Number((resizeInitialScale * ratio).toFixed(2))));

  const tiles = props.config.tiles.map((t) =>
    t.tileId === resizeTargetId ? { ...t, scale: newScale } : t,
  );
  emit("update:config", { ...props.config, tiles });
};

const onResizePointerUp = () => {
  resizeTargetId = null;
  window.removeEventListener("pointermove", onResizePointerMove);
  window.removeEventListener("pointerup", onResizePointerUp);
  window.removeEventListener("pointercancel", onResizePointerUp);
};

defineExpose({ getStageEl: () => stageRef.value });
</script>

<style scoped lang="scss">
.og-canvas-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 1200 / 630;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: var(--border-width) solid var(--color-stroke);
  background: #000000;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
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
  border: 1px dashed rgba(255, 255, 255, 0.15);
  pointer-events: none;
  z-index: 1;
}

.og-canvas__safezone {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
  z-index: 2;
  transition: all 0.3s ease;

  &.og-layout--split {
    left: 4% !important;
    width: 44% !important;
    align-items: flex-start !important;
    text-align: left !important;
    padding-left: 20px;

    .og-info-group {
      align-items: flex-start !important;
    }
  }

  &.og-layout--gallery {
    top: auto !important;
    bottom: 24px !important;
    left: 10% !important;
    width: 80% !important;
    height: auto !important;
    flex-direction: row !important;
    gap: 16px !important;
    padding: 10px 20px;
    background: rgba(0, 0, 0, 0.45);
    border-radius: 9999px;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
}

.og-avatar-wrap {
  margin-bottom: 8px;
}

.og-avatar-circle {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a855f7, #6366f1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  border: 3px solid rgba(255, 255, 255, 0.7);
  overflow: hidden;
}

.og-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.og-avatar-initials {
  font-size: 36px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.og-info-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.og-title-text {
  font-size: 34px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
  line-height: 1.2;
}

.og-subtitle-text {
  font-size: 17px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  line-height: 1.3;
}

.og-handle-badge {
  margin-top: 4px;
  padding: 4px 14px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.og-handle-at {
  color: var(--color-figma-purple, #a855f7);
  margin-right: 1px;
}

.og-canvas__tile {
  position: absolute;
  border-radius: var(--tile-border-radius, 18px);
  cursor: grab;
  touch-action: none;
  user-select: none;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  transition: outline 0.15s ease;

  &.is-selected {
    outline: 3px solid var(--color-figma-purple, #a855f7);
    outline-offset: 4px;
    z-index: 20;
  }

  &.is-dragging {
    cursor: grabbing;
    z-index: 25;
  }
}

/* ── Canva / Photoshop Direct Manipulation Handles ──────────────────────── */
.og-handle-rotate {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  z-index: 35;

  &:active {
    cursor: grabbing;
  }

  &__stem {
    width: 2px;
    height: 14px;
    background: var(--color-figma-purple, #a855f7);
  }

  &__knob {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffffff;
    color: #18181b;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--color-figma-purple, #a855f7);
    transition: transform 0.15s ease;

    &:hover {
      transform: scale(1.15);
    }
  }
}

.og-handle-resize {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  color: #18181b;
  border: 2px solid var(--color-figma-purple, #a855f7);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 35;
  transition: transform 0.15s ease;

  &:hover {
    transform: scale(1.2);
  }

  &--nw {
    top: -9px;
    left: -9px;
    cursor: nwse-resize;
    svg { transform: rotate(180deg); }
  }

  &--ne {
    top: -9px;
    right: -9px;
    cursor: nesw-resize;
    svg { transform: rotate(-90deg); }
  }

  &--se {
    bottom: -9px;
    right: -9px;
    cursor: nwse-resize;
    svg { transform: rotate(0deg); }
  }

  &--sw {
    bottom: -9px;
    left: -9px;
    cursor: nesw-resize;
    svg { transform: rotate(90deg); }
  }
}

.og-canvas__tile-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  padding: 8px;
  text-align: center;
}

/* ── Tile Animations ─────────────────────────────────────────────────────── */
.og-anim--float {
  animation: ogTileFloat var(--tile-speed, 3s) ease-in-out infinite alternate;
  animation-delay: var(--tile-delay, 0s);
}

.og-anim--pulse {
  animation: ogTilePulse var(--tile-speed, 3s) ease-in-out infinite;
  animation-delay: var(--tile-delay, 0s);
}

.og-anim--shimmer {
  animation: ogTileShimmer var(--tile-speed, 3s) ease-in-out infinite;
  animation-delay: var(--tile-delay, 0s);
}

.og-anim--tilt {
  animation: ogTileTilt var(--tile-speed, 3s) ease-in-out infinite alternate;
  animation-delay: var(--tile-delay, 0s);
}

@keyframes ogTileFloat {
  0% { transform: translate(-50%, -50%) rotate(var(--tile-rot, 0deg)) translateY(0); }
  100% { transform: translate(-50%, -50%) rotate(var(--tile-rot, 0deg)) translateY(-16px); }
}

@keyframes ogTilePulse {
  0%, 100% { transform: translate(-50%, -50%) rotate(var(--tile-rot, 0deg)) scale(1); }
  50% { transform: translate(-50%, -50%) rotate(var(--tile-rot, 0deg)) scale(1.06); }
}

@keyframes ogTileShimmer {
  0%, 100% { filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25)); }
  50% { filter: drop-shadow(0 0 20px rgba(168, 85, 247, 0.8)); }
}

@keyframes ogTileTilt {
  0% { transform: translate(-50%, -50%) rotate(calc(var(--tile-rot, 0deg) - 6deg)); }
  100% { transform: translate(-50%, -50%) rotate(calc(var(--tile-rot, 0deg) + 6deg)); }
}
</style>
