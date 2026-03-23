<template>
  <div
    ref="panelRef"
    class="text-align-panel"
    :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
    @mousedown.stop
  >
    <button
      class="text-align-option"
      :class="{ 'is-active': activeAlign === 'left' }"
      data-tooltip="Align left"
      @click.stop="onAlignClick('left')"
    >
      <AlignLeftIcon />
    </button>
    <button
      class="text-align-option"
      :class="{ 'is-active': activeAlign === 'center' }"
      data-tooltip="Align center"
      @click.stop="onAlignClick('center')"
    >
      <AlignCenterIcon />
    </button>
    <button
      class="text-align-option"
      :class="{ 'is-active': activeAlign === 'right' }"
      data-tooltip="Align right"
      @click.stop="onAlignClick('right')"
    >
      <AlignRightIcon />
    </button>
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
} from "vue";
import type { Tile } from "@/types/Tile";
import type { TextContent } from "@/types/TileContent";
import AlignLeftIcon from "./icons/toolbar/AlignLeftIcon.vue";
import AlignCenterIcon from "./icons/toolbar/AlignCenterIcon.vue";
import AlignRightIcon from "./icons/toolbar/AlignRightIcon.vue";

export default defineComponent({
  components: {
    AlignLeftIcon,
    AlignCenterIcon,
    AlignRightIcon,
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
    const panelRef = ref<HTMLElement | null>(null);
    const pos = ref({ top: 0, left: 0 });

    const activeAlign = computed(() => {
      const content = props.tile.content as TextContent;
      return content?.textAlign ?? "left";
    });

    const onAlignClick = (align: "left" | "center" | "right") => {
      props.childComponent?.handleTextAlignChange?.(align);
    };

    const updatePos = () => {
      const el = props.buttonEl;
      if (!el) return;

      const r = el.getBoundingClientRect();
      const panelW = panelRef.value?.offsetWidth ?? 130;
      const panelH = panelRef.value?.offsetHeight ?? 46;
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
      updatePos();
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
      panelRef,
      pos,
      activeAlign,
      onAlignClick,
    };
  },
});
</script>

<style scoped>
.text-align-panel {
  position: fixed;
  transform: translateX(-50%);
  z-index: 99;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: 12px;
  padding: 4px;
  /* animation: textAlignPanelSlideIn var(--duration-normal) var(--easing-spring); */
}

.text-align-option {
  background-color: transparent;
  color: var(--color-text-primary);
  border: none;
  border-radius: var(--radius-sm);
  height: 36px;
  width: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
    transform var(--duration-fast) var(--easing-ease-out),
    color var(--duration-fast) var(--easing-ease-in-out);
}

.text-align-option:hover {
  background-color: var(--color-content-low);
  transform: scale(1.05);
}

.text-align-option.is-active {
  background-color: var(--color-text-primary);
  color: var(--color-tile-background);
}

.align-preview {
  display: grid;
  width: 18px;
  height: 14px;
  gap: 2px;
}

.align-preview::before,
.align-preview::after {
  content: "";
  height: 2px;
  border-radius: 2px;
  background-color: currentColor;
}

.align-preview {
  grid-template-rows: repeat(3, 1fr);
}

.align-preview::before {
  width: 18px;
}

.align-preview::after {
  width: 12px;
}

.align-left {
  justify-items: start;
}

.align-center {
  justify-items: center;
}

.align-right {
  justify-items: end;
}
</style>
