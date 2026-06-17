<template>
  <div
    ref="panelRef"
    class="color-picker-panel"
    :class="{ 'has-target-toggle': supportsOverlay }"
    :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
    @mousedown.stop
  >
    <div v-if="supportsOverlay" class="target-toggle" role="tablist">
      <button
        type="button"
        class="target-toggle-btn"
        :class="{ 'is-active': target === 'fill' }"
        role="tab"
        :aria-selected="target === 'fill'"
        @click.stop="setTarget('fill')"
      >
        Fill
      </button>
      <button
        type="button"
        class="target-toggle-btn"
        :class="{ 'is-active': target === 'overlay' }"
        role="tab"
        :aria-selected="target === 'overlay'"
        @click.stop="setTarget('overlay')"
      >
        Overlay
      </button>
    </div>
    <template v-for="color in colors" :key="`color-${color}`">
      <button
        class="color-box"
        :style="`background: var(${color})`"
        :data-tooltip="generateColorTooltip(color)"
        @click="onColorClick($event, color)"
      ></button>
    </template>
    <button
      class="color-box no-fill"
      :data-tooltip="generateColorTooltip('--color-content-background')"
      @click="onColorClick($event, '--color-content-background')"
    >
      <NoFillIcon :size="26" />
    </button>
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
        v-if="eyeDropperSupported"
        class="hex-panel-btn"
        title="Pick a color from the page"
        @click.stop="onEyeDropper"
      >
        <EyeDropperIcon :size="18" />
      </button>

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
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type PropType,
} from "vue";
import { type TileChildComponent } from "@/types/Tile";
import { type Tile } from "@grids/contracts/types";
import CheckIcon from "@/components/icons/CheckIcon.vue";
import { useToastStore } from "@/stores/toast";
import NoFillIcon from "@/components/icons/NoFillIcon.vue";
import EyeDropperIcon from "@/components/icons/EyeDropperIcon.vue";

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperConstructor {
  new (): { open: () => Promise<EyeDropperResult> };
}

export default defineComponent({
  components: {
    CheckIcon,
    NoFillIcon,
    EyeDropperIcon,
  },
  props: {
    tile: {
      type: Object as () => Tile,
      default: null,
    },
    childComponent: {
      type: Object as PropType<TileChildComponent | null>,
      default: null,
    },
    buttonEl: {
      type: Object as () => HTMLElement | null,
      required: true,
    },
    onColorChange: {
      type: Function as unknown as PropType<((color: string) => void) | null>,
      default: null,
    },
    currentColor: {
      type: String,
      default: "",
    },
    supportsOverlay: {
      type: Boolean,
      default: false,
    },
    currentOverlayColor: {
      type: String,
      default: "",
    },
  },
  setup(props) {
    const toastStore = useToastStore();
    const panelRef = ref<HTMLElement | null>(null);

    const hexInput = ref("");
    const hexInputRef = ref<HTMLInputElement | null>(null);
    const pos = ref({ top: 0, left: 0 });

    // Which color the swatches/hex field currently edit — the tile's persisted
    // active treatment. Only meaningful when the tile supports a separate
    // overlay; otherwise it stays on "fill".
    const target = computed<"fill" | "overlay">(
      () => props.childComponent?.colorMode ?? "fill",
    );

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
    ]);

    const verifyValidColor = (color: string): boolean => {
      return /^#[0-9a-fA-F]{6}$/.test(color);
    };

    const extractCustomHexDigits = (color: string): string => {
      const trimmed = color.trim();
      if (!trimmed) return "";
      const normalized = normalizeHex(trimmed);
      if (!verifyValidColor(normalized)) return "";
      return normalized.slice(1).toUpperCase();
    };

    // Resolve any applied background color — a custom hex or a `var(--token)`
    // swatch — to 6 hex digits so the hex field always reflects the current
    // color. Tokens are resolved against the live DOM so the active theme
    // determines the concrete value.
    const resolveColorToHexDigits = (color: string): string => {
      const trimmed = color.trim();
      if (!trimmed) return "";

      const directHex = extractCustomHexDigits(trimmed);
      if (directHex) return directHex;

      const host = panelRef.value ?? document.body;
      const probe = document.createElement("div");
      probe.style.backgroundColor = trimmed;
      probe.style.display = "none";
      host.appendChild(probe);
      const resolved = getComputedStyle(probe).backgroundColor;
      host.removeChild(probe);
      return rgbToHexDigits(resolved);
    };

    // Convert an `rgb()` / `rgba()` string to 6 uppercase hex digits.
    // Returns "" for transparent or unparseable values.
    const rgbToHexDigits = (rgb: string): string => {
      const match = rgb.match(
        /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/,
      );
      if (!match) return "";
      const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
      if (alpha === 0) return "";
      return [match[1], match[2], match[3]]
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    };

    const onColorClick = (event: MouseEvent, color: string) => {
      event.preventDefault();
      const value = `var(${color.trim()})`;

      // Reflect the resolved color of the swatch in the hex field so the
      // user can see the concrete hex value they just selected.
      const swatchEl = event.currentTarget as HTMLElement | null;
      if (swatchEl) {
        hexInput.value = rgbToHexDigits(
          getComputedStyle(swatchEl).backgroundColor,
        );
      }

      handleColorChange(value);
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

      handleColorChange(hex);
    };

    const handleColorChange = (color: string): void => {
      if (props.onColorChange) {
        props.onColorChange(color);
        return;
      }
      if (
        target.value === "overlay" &&
        props.childComponent?.handleOverlayColorChange !== undefined
      ) {
        props.childComponent.handleOverlayColorChange(color);
      } else if (
        props.childComponent?.handleBackgroundColorChange !== undefined
      ) {
        props.childComponent.handleBackgroundColorChange(color);
      }
    };

    // Reflect the active target's current color in the hex field so it always
    // mirrors what the swatches edit.
    const syncHexToTarget = () => {
      const source =
        target.value === "overlay" ? props.currentOverlayColor : props.currentColor;
      hexInput.value = resolveColorToHexDigits(source);
    };

    const setTarget = (next: "fill" | "overlay") => {
      props.childComponent?.setColorMode?.(next);
    };

    // Keep the hex field locked to the active target's current color: re-sync
    // whenever the target is toggled or either applied color changes. This is
    // what makes Fill/Overlay switch back and forth cleanly.
    watch(
      [target, () => props.currentColor, () => props.currentOverlayColor],
      syncHexToTarget,
    );

    // The native EyeDropper API is Chromium-only; the button is hidden where
    // it is unavailable (Firefox, Safari, most mobile browsers).
    const eyeDropperSupported = "EyeDropper" in window;

    const onEyeDropper = async () => {
      const Ctor = (window as unknown as { EyeDropper?: EyeDropperConstructor })
        .EyeDropper;
      if (!Ctor) return;

      try {
        const { sRGBHex } = await new Ctor().open();
        const hex = normalizeHex(sRGBHex);
        if (!verifyValidColor(hex)) return;
        hexInput.value = hex.slice(1).toUpperCase();
        handleColorChange(hex);
      } catch {
        // User dismissed the picker (e.g. pressed Escape) — no action needed.
      }
    };

    const updatePos = () => {
      const el = props.buttonEl;
      if (!el) return;

      const r = el.getBoundingClientRect();

      const panelW = panelRef.value?.offsetWidth ?? 210;
      const panelH = panelRef.value?.offsetHeight ?? 130;
      const gap = 8;

      let top = r.bottom + gap;
      let left = r.left + r.width / 2;

      if (top + panelH > window.innerHeight) {
        top = r.top - gap - panelH;
      }

      const halfW = panelW / 2;
      const margin = 8;

      if (left - halfW < margin) {
        left = halfW + margin;
      } else if (left + halfW > window.innerWidth - margin) {
        left = window.innerWidth - margin - halfW;
      }

      pos.value = { top, left };
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
      syncHexToTarget();
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

    const generateColorTooltip = (rawColorStr: string): string => {
      const standardColors: string[] = [
        "red",
        "orange",
        "yellow",
        "green",
        "cyan",
        "blue",
        "purple",
        "pink",
      ];
      const colorType = rawColorStr.replace("--color-", "");
      if (standardColors.filter((elem) => elem === colorType).length > 0) {
        return colorType;
      }

      switch (colorType) {
        case "light-100":
          return "light";
        case "dark-0":
          return "dark";
        case "tile-background":
          return "default";
        case "content-background":
          return "no fill";
        default:
          return "";
      }
    };

    return {
      colors,
      pos,
      hexInput,
      hexInputRef,
      target,
      setTarget,
      onColorClick,
      onHexSubmit,
      generateColorTooltip,
      panelRef,
      eyeDropperSupported,
      onEyeDropper,
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
  border: var(--border-width) solid var(--color-stroke);
  border-radius: 12px;
  padding: 4px;
}

/* Fill / Overlay target toggle — spans the full swatch grid width */
.target-toggle {
  grid-row: 1;
  grid-column: 1 / -1;
  display: flex;
  gap: 2px;
  margin: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--color-content-low);
}

.target-toggle-btn {
  flex: 1;
  height: 26px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
    color var(--duration-fast) var(--easing-ease-in-out);
}

.target-toggle-btn:hover {
  background: var(--color-content-default);
}

.target-toggle-btn.is-active {
  background: var(--color-text-primary);
  color: var(--color-tile-background);
}

/* When the toggle is present the swatch rows shift down one grid row. */
.color-picker-panel.has-target-toggle {
  grid-template-rows: auto repeat(3, auto);
}

.color-picker-panel.has-target-toggle .hex-panel {
  grid-row: 4;
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

.color-box.no-fill {
  background: transparent;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.color-box.no-fill svg {
  display: block;
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
</style>
