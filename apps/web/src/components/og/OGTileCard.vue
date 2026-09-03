<template>
  <div
    class="og-tile-card"
    :class="[`og-tile-card--${tile.content.type}`, `theme-${theme || 'dark'}`]"
    :style="cardStyle"
  >
    <div class="og-tile-card__inner">
      <component
        :is="currentComponent"
        v-if="currentComponent"
        v-bind="contentProps"
      />
      <div v-else class="og-tile-card__fallback">
        <component :is="tileDef?.icon" v-if="tileDef?.icon" class="og-tile-card__fallback-icon" />
        <span class="og-tile-card__fallback-label">{{ tileLabel }}</span>
      </div>
    </div>
    <div v-if="tile.caption" class="og-tile-card__caption">
      {{ tile.caption }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, shallowRef, watchEffect, type Component } from "vue";
import type { Tile } from "@grids/contracts/types";
import { getContentComponent } from "@/utils/TileUtils";
import { getTileDefinition } from "@/registries/tileRegistry";

const props = withDefaults(
  defineProps<{
    tile: Tile;
    theme?: "dark" | "light";
  }>(),
  {
    theme: "dark",
  },
);

// Provide standard tile layout context needed by tile content components
provide(
  "gridTileH",
  computed(() => props.tile.h || 2),
);
provide(
  "gridTileW",
  computed(() => props.tile.w || 2),
);
provide("tileId", props.tile.i);
provide(
  "tileX",
  computed(() => props.tile.x || 0),
);
provide(
  "tileY",
  computed(() => props.tile.y || 0),
);

const tileDef = computed(() => getTileDefinition(props.tile.content.type));

const currentComponent = shallowRef<Component | null>(null);

watchEffect(() => {
  try {
    currentComponent.value = getContentComponent(props.tile.content);
  } catch {
    currentComponent.value = null;
  }
});

const contentProps = computed(() => {
  const def = tileDef.value;
  const extra = def?.extraProps?.(props.tile) ?? {};
  return { content: props.tile.content, ...extra };
});

const tileBg = computed(() => {
  if (props.theme === "light") return "#ffffff";
  const c = props.tile.content as unknown as Record<string, unknown>;
  return (
    (typeof c?.backgroundColor === "string" && c.backgroundColor) ||
    (typeof c?.color === "string" && c.color) ||
    "var(--color-tile-background, rgba(28, 28, 34, 0.85))"
  );
});

const tileTextColor = computed(() => {
  if (props.theme === "light") return "#18181b";
  const c = props.tile.content as unknown as Record<string, unknown>;
  return (
    (typeof c?.textColor === "string" && c.textColor) ||
    "var(--color-text-primary, #ffffff)"
  );
});

const cardStyle = computed(() => ({
  "--tile-bg": tileBg.value,
  "--tile-text-color": tileTextColor.value,
}));

const tileLabel = computed(() => {
  const c = props.tile.content as unknown as Record<string, unknown>;
  return (
    props.tile.caption?.trim() ||
    (typeof c?.title === "string" && c.title) ||
    (typeof c?.label === "string" && c.label) ||
    (typeof c?.name === "string" && c.name) ||
    tileDef.value?.label ||
    "Tile"
  );
});
</script>

<style scoped lang="scss">
.og-tile-card {
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: var(--tile-border-radius, 18px);
  background-color: var(--tile-bg);
  color: var(--tile-text-color);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.25);
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  user-select: none;
  transform: translateZ(0);

  &.theme-light {
    background-color: #ffffff !important;
    color: #18181b !important;

    &::after {
      border-color: rgba(0, 0, 0, 0.12) !important;
    }

    :deep(*) {
      --color-text-primary: #18181b;
      --color-content-low: #71717a;
    }
  }

  /* Subtle border overlay */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 1px solid var(--color-tile-stroke, rgba(255, 255, 255, 0.14));
    border-radius: inherit;
    pointer-events: none;
    z-index: 5;
  }

  &__inner {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    pointer-events: none;

    /* Ensure child content scales nicely inside the OG tile */
    :deep(*) {
      pointer-events: none !important;
      user-select: none !important;
    }

    :deep(img) {
      max-width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  &__fallback {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    text-align: center;
  }

  &__fallback-icon {
    width: 28px;
    height: 28px;
    opacity: 0.85;
  }

  &__fallback-label {
    font-family: var(--font-family-base, sans-serif);
    font-size: 13px;
    font-weight: 600;
    color: var(--tile-text-color);
    letter-spacing: -0.01em;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__caption {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    font-size: 11px;
    font-weight: 500;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    z-index: 4;
  }
}
</style>
