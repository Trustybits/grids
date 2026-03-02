<template>
  <div
    class="font-select-wrapper"
    @click.stop.prevent="handleFontClick"
    ref="fontSelectButtonRef"
  >
    <FontStyleIcon />
    <Chevron
      :size="24"
      class="chevron chevron-adjust"
      :class="isActive ? 'rotate-chevron' : ''"
    />
  </div>

  <teleport to="body">
    <transition name="font-menu">
      <div
        v-if="isActive"
        ref="fontSelectorMenuRef"
        class="font-select-menu"
        :style="{
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          // '--grow-origin': growOrigin,
        }"
      >
        <button
          v-for="font in fontTypes"
          :key="font"
          type="button"
          class="font-select-button"
          :class="{ 'is-current': font === currentFont }"
          @mousedown.prevent
          @pointerdown.prevent
          @click.stop="handleFontSelect(font)"
        >
          {{ font }}
        </button>
      </div>
    </transition>
  </teleport>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import FontStyleIcon from "./icons/toolbar/FontStyleIcon.vue";
import Chevron from "./icons/Chevron.vue";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  components: { FontStyleIcon, Chevron },
  emits: ["open-intent"],
  props: {
    childComponent: {
      type: Object as () => any,
      required: true,
    },
  },
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();
    const isActive = ref(false);
    const fontSelectButtonRef = ref<HTMLButtonElement | null>(null);
    const fontSelectorMenuRef = ref<HTMLDivElement | null>(null);
    const pos = ref({ top: 0, left: 0 });

    const currentFont = computed(() =>
      props.childComponent?.getCurrentFont?.(),
    );

    const FONT_TYPES = ref([
      "Inter",
      "Times New Roman",
      "Geist Mono",
      "Lobster",
    ]);

    const handleFontClick = () => {
      if (isActive.value) {
        isActive.value = false;
        return;
      }

      emit("open-intent", "family");
      isActive.value = true;
      nextTick(() => positionMenu());
    };

    const handleFontSelect = (font: string) => {
      props.childComponent?.handleFontChange(font);
      isActive.value = false;
      layoutStore.closeMenus();
    };

    const positionMenu = () => {
      const btn = fontSelectButtonRef.value;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const rowHeight =
        fontSelectorMenuRef.value?.firstElementChild?.clientHeight ?? 36;

      const top = rect.bottom + 8;
      const left = rect.left - 5;

      pos.value = { top, left };
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (fontSelectorMenuRef.value?.contains(target)) {
        return;
      }

      isActive.value = false;
    };

    let rafId: number | null = null;

    const schedulePositionMenu = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        positionMenu();
      });
    };

    watch(isActive, (open, _prev, onCleanup) => {
      nextTick(positionMenu);

      window.addEventListener("resize", schedulePositionMenu);
      window.addEventListener("scroll", schedulePositionMenu, {
        capture: true,
        passive: true,
      });

      onCleanup(() => {
        if (rafId != null) cancelAnimationFrame(rafId);
        rafId = null;
        window.removeEventListener("resize", schedulePositionMenu);
        window.removeEventListener("scroll", schedulePositionMenu, {
          capture: true,
        });
      });
    });

    onMounted(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("contextmenu", handleClickOutside);
    });

    onUnmounted(() => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("contextmenu", handleClickOutside);
    });

    return {
      handleFontClick,
      handleFontSelect,
      currentFont,
      fontSelectButtonRef,
      fontSelectMenuRef: fontSelectorMenuRef,
      pos,
      // growOrigin,
      isActive,
      fontTypes: FONT_TYPES,
    };
  },
});
</script>

<style scoped>
.font-select-button {
  display: flex;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  text-align: left;
  align-items: center;
  min-height: 36px;
  font-weight: var(--font-weight-semibold);
  padding: 0 12px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
    transform var(--duration-fast) var(--easing-ease-out);
}

.font-select-button:hover {
  background: var(--color-content-low);
}

.font-select-button.is-current {
  background: color-mix(in srgb, var(--color-content-default) 50%, transparent);
}

.chevron {
  color: var(--color-content-default);
  margin-left: 4px;
  transition: transform 0.05s var(--easing-ease-in-out);
  &.rotate-chevron {
    transform: rotate(180deg);
  }
}
.chevron-adjust {
  margin-right: -8px;
}
</style>
