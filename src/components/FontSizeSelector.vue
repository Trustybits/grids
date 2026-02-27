<template>
  <div
    class="font-select-wrapper"
    @click.stop.prevent="handleFontClick"
    ref="fontSelectButtonRef"
  >
    <div class="font-select-box">
      <div class="font-title">{{ currentFontSize }}</div>
      <Chevron :size="24" class="chevron" />
    </div>
  </div>

  <teleport to="body">
    <transition name="font-menu">
      <div
        v-if="isActive"
        ref="fontSelectMenuRef"
        class="font-select-menu"
        :style="{
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          width: `${pos.width}px`,
          '--grow-origin': growOrigin,
        }"
      >
        <div
          v-for="size in fontSizes"
          :key="size"
          class="font-select-title"
          :class="{ 'is-current': size === currentFontSize }"
        >
          {{ size }}
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, ref } from "vue";
import Chevron from "./icons/Chevron.vue";

const FONT_SIZES = ["Small", "Medium", "Large", "Larger"] as const;
type FontSizeOption = (typeof FONT_SIZES)[number];

const normalizeSize = (value: string | undefined | null): FontSizeOption => {
  const normalized = value?.trim().toLowerCase();
  return (
    FONT_SIZES.find((size) => size.toLowerCase() === normalized) ?? "Medium"
  );
};

export default defineComponent({
  components: {
    Chevron,
  },
  props: {
    childComponent: {
      type: Object as () => any,
      required: true,
    },
  },
  setup(props) {
    const isActive = ref(false);
    const fontSelectButtonRef = ref<HTMLButtonElement | null>(null);
    const fontSelectMenuRef = ref<HTMLDivElement | null>(null);
    const pos = ref({ top: 0, left: 0, width: 0 });

    const currentFontSize = computed<FontSizeOption>(() =>
      normalizeSize(props.childComponent?.getCurrentFontSize?.()),
    );
    const selectedIndex = computed(() =>
      FONT_SIZES.indexOf(currentFontSize.value),
    );
    const growOrigin = computed(
      () => `${((selectedIndex.value + 0.5) / FONT_SIZES.length) * 100}%`,
    );

    const positionMenu = () => {
      const btn = fontSelectButtonRef.value;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const rowHeight =
        fontSelectMenuRef.value?.firstElementChild?.clientHeight ?? 36;

      const top = rect.top - selectedIndex.value * rowHeight;
      const left = rect.left;

      pos.value = { top, left, width: rect.width };
    };

    const handleFontClick = () => {
      if (isActive.value) {
        isActive.value = false;
        return;
      }

      isActive.value = true;
      nextTick(() => positionMenu());
    };

    return {
      isActive,
      fontSizes: FONT_SIZES,
      fontSelectButtonRef,
      fontSelectMenuRef,
      pos,
      currentFontSize,
      growOrigin,
      handleFontClick,
    };
  },
});
</script>

<style scoped>
.font-select-wrapper {
  display: flex;
  flex: 1;
  align-items: stretch;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid var(--color-content-subtle);
  border-radius: var(--radius-sm);
  background: var(--color-content-inverse-soft);
  cursor: pointer;
}

.font-select-box {
  display: flex;
  flex: 1;
  align-self: stretch;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  font-size: var(--font-size-md);
  margin-right: -6px;
}

.font-select-menu {
  position: fixed;
  z-index: 3000;
  border: 1px solid var(--color-content-subtle);
  background: var(--color-tile-background);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  overflow: hidden;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
  transform-origin: center var(--grow-origin, 50%);
}

.font-select-title {
  display: flex;
  align-items: center;
  min-height: 36px;
  font-weight: var(--font-weight-semibold);
  padding: 0 12px;
  white-space: nowrap;
}

.font-select-title.is-current {
  background: color-mix(in srgb, var(--color-content-default) 14%, transparent);
}

.font-title {
  font-weight: var(--font-weight-semibold);
}

.chevron {
  color: var(--color-content-default);
  margin-left: 4px;
}

.font-menu-enter-active,
.font-menu-leave-active {
  transition:
    transform 220ms cubic-bezier(0.2, 0.82, 0.2, 1),
    opacity 180ms ease;
}

.font-menu-enter-from,
.font-menu-leave-to {
  opacity: 0;
  transform: scaleY(0.28);
}

.font-menu-enter-to,
.font-menu-leave-from {
  opacity: 1;
  transform: scaleY(1);
}
</style>
