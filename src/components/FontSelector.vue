<template>
  <div
    class="font-select-wrapper"
    @click.stop.prevent="handleClick"
    ref="fontSelectButtonRef"
  >
    <FontStyleIcon />
    <Chevron
      :size="24"
      class="chevron"
      :class="isActive ? 'rotate-chevron' : ''"
    />
  </div>

  <teleport to="body">
    <transition name="font-panel">
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
          @click.stop="handleButtonClick(font)"
        >
          {{ font }}
        </button>
      </div>
    </transition>
  </teleport>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from "vue";
import FontStyleIcon from "./icons/toolbar/FontStyleIcon.vue";
import Chevron from "./icons/Chevron.vue";
import { useFloatingSelector } from "@/composables/useFloatingSelector";

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

    const positionMenu = () => {
      const btn = fontSelectButtonRef.value;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();

      const top = rect.bottom + 8;
      const left = rect.left - 5;

      pos.value = { top, left };
    };

    const { handleClick, handleButtonClick } = useFloatingSelector({
      isActive,
      menuRef: fontSelectorMenuRef,
      positionMenu,
      buttonAction: props.childComponent?.handleFontChange,
      emitter: () => emit("open-intent", "family"),
    });

    return {
      handleClick,
      handleButtonClick,
      currentFont,
      fontSelectButtonRef,
      fontSelectorMenuRef,
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

.font-select-button:active {
  background: color-mix(in srgb, var(--color-content-low) 80%, black 20%);
  transform: scale(0.985);
}

.font-select-button.is-current {
  background: color-mix(in srgb, var(--color-content-default) 50%, transparent);
}

.chevron {
  color: var(--color-content-default);
  margin-left: 4px;
  margin-right: -8px;
  transition: transform 0.05s var(--easing-ease-in-out);
  &.rotate-chevron {
    transform: rotate(180deg);
  }
}

.font-panel-enter-active {
  animation: fontPanelSlideIn var(--duration-normal) var(--easing-spring);
}

.font-panel-leave-active {
  animation: fontPanelSlideOut var(--duration-normal) var(--easing-spring);
}

@keyframes fontPanelSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes fontPanelSlideOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
}
</style>
