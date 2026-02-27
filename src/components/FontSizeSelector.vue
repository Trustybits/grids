<template>
  <div
    class="font-select-wrapper"
    @click.stop.prevent="handleFontClick"
    ref="fontSelectButtonRef"
  >
    <!-- maybe change this to just be hidden when not active -->
     <!-- :style="{ visibility: isActive ?'hidden' : 'visible' }" -->
    <div class="font-select-box" >
      <div class="font-title">{{ currentFontSize }}</div>
      <Chevron :size="24" class="chevron" />
    </div>
  </div>

  <teleport to="body">
    <div
      v-if="isActive"
      ref="fontSelectMenuRef"
      class="font-select-menu"
      :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
    >
      <div class="font-select-title">Small</div>
      <div class="font-select-title">Medium</div>
      <div class="font-select-title">Large</div>
      <div class="font-select-title">Larger</div>
    </div>
  </teleport>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, ref } from "vue";
import Chevron from "./icons/Chevron.vue";

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
    const pos = ref({ top: 0, left: 0 });

    const currentFontSize = computed(() =>
      props.childComponent?.getCurrentFontSize(),
    );

    const positionMenu = () => {
      const btn = fontSelectButtonRef.value;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();

      const menuW = fontSelectMenuRef.value?.offsetWidth ?? 100;
      const menuH = fontSelectMenuRef.value?.offsetHeight ?? 230;

      let top = rect.top - 37;
      let left = rect.left;

      pos.value = { top: top, left: left };

      console.log("pos.value", pos.value);
    };

    const handleFontClick = () => {
      isActive.value = !isActive.value;
      nextTick(() => positionMenu());
      console.log("Font button clicked");
    };

    return {
      isActive,
      fontSelectButtonRef,
      fontSelectMenuRef,
      pos,
      currentFontSize,
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
  padding: 8px 10px;
  border: thin white solid;
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
  border: solid white 1px;
  background: var(--color-tile-background);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
}

.font-select-title {
  font-weight: var(--font-weight-semibold);
  /* padding: 7px 10px; */
  /* margin-right: 22px; */
  padding: 7px 22px;
  border: solid orange thin;
}

.font-title {
  font-weight: var(--font-weight-semibold);
}

.chevron {
  color: var(--color-content-default);
  margin-left: 4px;
}
</style>
