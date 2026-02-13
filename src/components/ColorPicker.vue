<template>
  <div
    class="color-picker-panel"
    :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
    @mousedown.stop
  >
    <template v-for="color in colors" :key="`color-${color}`">
      <button class="color-box" :style="`background: var(${color})`"></button>
    </template>
    <div class="hex-input">hex input</div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted, ref, watch } from "vue";
import { type Tile } from "@/types/Tile";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  components: {},
  props: {
    tile: {
      type: Object as () => Tile,
      required: true,
    },
    childComponent: {
      type: Object as () => any,
      required: true,
    },
    buttonEl: {
      type: Object as () => HTMLElement | null,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();

    const colors = ref<string[]>([
      "--color-red",
      "--color-orange",
      "--color-yellow",
      "--color-green",
      "--color-cyan",
      "--color-blue",
      "--color-purple",
      "--color-pink",
      "--color-light-100",
      "--color-dark-0",
      "--color-tile-background",
      "--color-content-background"
    ]);

    // for color-content-background, draw button as a "no fill" somehow

    const pos = ref({ top: 0, left: 0 });

    const updatePos = () => {
      const el = props.buttonEl;
      if (!el) return;

      const r = el.getBoundingClientRect();
      pos.value = { top: r.bottom + 8, left: r.left + r.width / 2 };
    };

    let rafId: number | null = null;

    const scheduleUpdatePos = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updatePos();
      });
    }

    onMounted(updatePos);
    watch(() => props.buttonEl, updatePos);
    window.addEventListener("resize", scheduleUpdatePos);
    window.addEventListener("scroll", scheduleUpdatePos, { capture: true, passive: true });

    onUnmounted(() => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener("resize", scheduleUpdatePos);
      window.removeEventListener("scroll", scheduleUpdatePos, { capture: true });
    });

    return {
      colors,
      pos,
    };
  },
});
</script>

<style scoped>
.color-picker-panel {
  position: fixed;
  transform: translateX(-50%);
  z-index: 99;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: repeat(3, auto);
  align-items: center;
  gap: 0;
  white-space: nowrap;

  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: 12px;
  padding: 4px;

  animation: colorPickerSlideIn var(--duration-normal) var(--easing-spring);
}

.hex-input {
  grid-row: 3;
  grid-column: 1 / -1;
  justify-self: center;
  /* width: 160px; */
}

.color-box {
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  margin: 2px;
  padding: 0;
  
  border-radius: 6px;
  /* background: var(--swatch, #ff4d4f); */
  border: 1px solid var(--color-tile-stroke);

  cursor: pointer;
  min-width: 0;
  appearance: none;
}

@keyframes colorPickerSlideIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
</style>
