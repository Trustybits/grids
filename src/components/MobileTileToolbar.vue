<template>
  <teleport to="body">
    <div class="mobile-tile-toolbar" @touchstart.stop @touchend.stop @click.stop>
      <div class="mobile-toolbar-inner">
        <div class="resize-presets">
          <button
            v-for="preset in presets"
            :key="preset.label"
            class="preset-btn"
            :class="{ 'is-active': tile.w === preset.w && tile.h === preset.h }"
            @click="applyPreset(preset)"
          >
            <span class="preset-label">{{ preset.label }}</span>
          </button>
        </div>
        <button class="done-btn" @click="onDone">Done</button>
      </div>
    </div>
  </teleport>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import type { Tile } from "@/types/Tile";
import { useLayoutStore } from "@/stores/layout";

interface SizePreset {
  label: string;
  w: number;
  h: number;
}

export default defineComponent({
  props: {
    tile: {
      type: Object as PropType<Tile>,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();

    const presets: SizePreset[] = [
      { label: "2×2", w: 2, h: 2 },
      { label: "2×4", w: 2, h: 4 },
      { label: "4×2", w: 4, h: 2 },
      { label: "4×4", w: 4, h: 4 },
    ];

    const applyPreset = (preset: SizePreset) => {
      layoutStore.resizeTile(props.tile.i, preset.w, preset.h);
    };

    const onDone = () => {
      layoutStore.clearActiveTile();
    };

    return {
      presets,
      applyPreset,
      onDone,
    };
  },
});
</script>

<style scoped lang="scss">
.mobile-tile-toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1100;
  padding: 12px 16px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--color-tile-background) 80%, transparent);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-top: var(--tile-border-width) solid var(--color-tile-stroke);
  animation: mobileToolbarSlideUp var(--duration-normal) var(--easing-spring);
}

@keyframes mobileToolbarSlideUp {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mobile-toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.resize-presets {
  display: flex;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.preset-btn {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  background-color: transparent;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
    border-color var(--duration-fast) var(--easing-ease-in-out),
    transform var(--duration-fast) var(--easing-ease-out);

  &:active {
    transform: scale(0.95);
  }

  &.is-active {
    background-color: var(--color-text-primary);
    color: var(--color-tile-background);
    border-color: var(--color-text-primary);
  }
}

.preset-label {
  pointer-events: none;
}

.done-btn {
  height: 40px;
  padding: 0 16px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-md);
  background-color: var(--color-text-primary);
  color: var(--color-tile-background);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition:
    opacity var(--duration-fast) var(--easing-ease-in-out),
    transform var(--duration-fast) var(--easing-ease-out);

  &:active {
    transform: scale(0.95);
    opacity: 0.8;
  }
}
</style>
