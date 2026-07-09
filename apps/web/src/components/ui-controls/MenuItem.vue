<template>
  <button
    class="menu-item"
    :class="{ 'menu-item--danger': danger }"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  danger?: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  click: [];
}>();
</script>

<style lang="scss" scoped>
.menu-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  padding: var(--spacing-sm);
  text-align: left;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) var(--easing-smooth);
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  line-height: 1.5;
  min-height: 40px;

  &:hover {
    background-color: var(--color-input-edit);
  }

  &--danger:hover {
    background-color: var(--color-figma-red);
    color: var(--color-light-100);
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;

    &:hover {
      background-color: transparent;
    }

    &.menu-item--danger:hover {
      color: var(--color-text-primary);
    }
  }
}
</style>
