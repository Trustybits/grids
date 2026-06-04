<template>
  <div class="ghost-split-button">
    <button class="ghost-split-main" @click="$emit('main-click')">
      <slot name="main" />
    </button>
    <button
      ref="chevronRef"
      class="ghost-split-chevron"
      :class="{ 'ghost-split-chevron--open': open }"
      @click.stop="$emit('update:open', !open)"
    >
      <Chevron :size="12" />
    </button>
    <div v-if="open" class="ghost-split-dropdown">
      <slot name="dropdown" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Chevron from "@/components/icons/Chevron.vue";

defineProps<{ open: boolean }>();
defineEmits<{
  "main-click": [];
  "update:open": [value: boolean];
}>();

const chevronRef = ref<HTMLElement | null>(null);
defineExpose({ chevronRef });
</script>

<style lang="scss" scoped>
.ghost-split-button {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
  border-radius: var(--radius-sm);
}

.ghost-split-main {
  flex: 1;
  display: flex;
  align-items: center;
  padding: var(--spacing-sm);
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  line-height: 1.5;
  min-height: 40px;
  min-width: 240px;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  transition: background-color var(--duration-fast) var(--easing-smooth);

  &:hover {
    background-color: var(--color-input-edit);
  }
}

.ghost-split-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-left: 1px solid var(--color-tile-stroke);
  color: var(--color-content-low);
  cursor: pointer;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth);

  &:hover {
    background-color: var(--color-input-edit);
    color: var(--color-text-primary);
  }

  :deep(svg) {
    transition: transform var(--duration-fast) var(--easing-smooth);
  }

  &.ghost-split-chevron--open :deep(svg) {
    transform: rotate(180deg);
  }
}

.ghost-split-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--color-tile-background);
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  z-index: 10;
  min-width: 140px;
  padding: 4px;
}

:slotted(.ghost-split-dropdown-item) {
  display: block;
  width: 100%;
  padding: 6px 10px;
  text-align: left;
  background: none;
  border: none;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-base);
  border-radius: var(--radius-xs);
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--color-input-edit);
  }
}

:slotted(.ghost-split-dropdown-item--danger) {
  color: var(--color-red);
}
</style>
