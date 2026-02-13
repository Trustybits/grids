<template>
  <div
    class="color-picker-panel"
    :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
    @mousedown.stop
  >
    <template v-for="color in colors" :key="`color-${color}`">
      <button
        class="color-box"
        :style="`background: var(${color})`"
        @click="onColorClick($event, color)"
      ></button>
    </template>
    <div class="hex-panel">
      <div
        :class="{
          'hex-panel-starter': !hexInput,
          'hex-panel-starter-active': !!hexInput,
        }"
      >
        #
      </div>
      <input
        v-model="hexInput"
        ref="hexInputRef"
        class="hex-panel-input"
        type="text"
        placeholder="FFFFFF"
        maxlength="6"
        @keydown.enter.stop="onHexSubmit"
      />

      <button
        class="hex-panel-btn"
        title="Apply color"
        @click.stop="onHexSubmit"
      >
        <CheckIcon :size="18" />
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted, ref, watch } from "vue";
import { type Tile } from "@/types/Tile";
import { useLayoutStore } from "@/stores/layout";
import CheckIcon from "@/components/icons/CheckIcon.vue";
import { useToastStore } from "@/stores/toast";

export default defineComponent({
  components: {
    CheckIcon,
  },
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
    const toastStore = useToastStore();

    const hexInput = ref("");
    const hexInputRef = ref<HTMLInputElement | null>(null);

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
      "--color-content-background",
    ]);

    const verifyValidColor = (color: string): boolean => {
      return /^#[0-9a-fA-F]{6}$/.test(color);
    };

    const onColorClick = (event: MouseEvent, color: string) => {
      event.preventDefault();
      props.childComponent?.handleBackgroundColorChange(`var(${color.trim()})`);
    };

    const normalizeHex = (hex: string): string => {
      if (hex.startsWith("0x")) {
        hex = hex.slice(2);
      }

      if (hex.startsWith("x")) {
        hex = hex.slice(1);
      }

      if (!hex.startsWith("#")) {
        hex = "#" + hex;
      }
      return hex;
    };

    const onHexSubmit = () => {
      // fix and validate hex value
      let hex = hexInput.value.trim();

      if (!hex) return;

      hex = normalizeHex(hex);

      if (!verifyValidColor(hex)) {
        if (hex.length !== 7) {
          toastStore.addToast(
            "Invalid hex format, provide 6 characters exactly",
            "error",
          );
        } else {
          toastStore.addToast(
            "Invalid hex format, only A-F and 0-9 are permitted",
            "error",
          );
        }
        return;
      }

      props.childComponent?.handleBackgroundColorChange(hex);
    };
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
    };

    onMounted(() => {
      updatePos();
      hexInputRef.value?.focus();
    });

    watch(() => props.buttonEl, updatePos);
    window.addEventListener("resize", scheduleUpdatePos);
    window.addEventListener("scroll", scheduleUpdatePos, {
      capture: true,
      passive: true,
    });

    onUnmounted(() => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener("resize", scheduleUpdatePos);
      window.removeEventListener("scroll", scheduleUpdatePos, {
        capture: true,
      });
    });

    return {
      colors,
      pos,
      hexInput,
      hexInputRef,
      onColorClick,
      onHexSubmit,
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

.hex-panel {
  grid-row: 3;
  grid-column: 1 / -1;
  justify-self: center;
  /* width: 160px; */
}

.hex-panel-starter {
  /* color: gray; */
  color: var(--color-light-100-34);
  opacity: 0.7;
  display: inline-block;
}

.hex-panel-starter-active {
  color: white;
  opacity: 0.7;
  display: inline-block;
}

.hex-panel-input {
  min-width: 6cqi;
  width: 60px;
  height: 30px;
  padding: 0 0 0 4px;
  margin: 4px 0 0px 0;
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  line-height: 36px;
  outline: none;
  border: none;
  display: inline-block;

  &::placeholder {
    color: var(--color-content-default);
    opacity: 0.6;
  }
}

.hex-panel-btn {
  background-color: transparent;
  color: var(--color-text-primary);
  border: none;
  border-radius: var(--radius-sm);
  height: 30px;
  width: 30px;
  padding: 0;
  display: inline-block;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
    transform var(--duration-fast) var(--easing-ease-out),
    color var(--duration-fast) var(--easing-ease-in-out);

  :deep(svg) {
    width: 22px;
    height: 22px;
    display: block;
  }

  &:hover {
    background-color: var(--color-content-low);
    transform: scale(1.05);
  }
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
