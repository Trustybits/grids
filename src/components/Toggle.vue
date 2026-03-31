<template>
  <label class="toggle" :data-tooltip="tooltip">
    <span class="toggle__label">{{ label }}</span>
    <div class="toggle-switch" :class="{ 'toggle-switch--checked': modelValue }">
      <input
        type="checkbox"
        class="toggle-input"
        :checked="modelValue"
        @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <span class="toggle-slider"></span>
    </div>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  modelValue: boolean;
  tooltip?: string;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<style lang="scss" scoped>
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm);
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--duration-fast) var(--easing-smooth);
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  line-height: 1.5;
  min-height: 40px;

  &:hover {
    background-color: var(--color-base-34);
  }

  &__label {
    user-select: none;
  }
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;

  .toggle-input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--color-base-34);
    transition: var(--duration-fast);
    border-radius: 20px;

    &:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: var(--duration-fast);
      border-radius: 50%;
    }
  }

  &--checked .toggle-slider {
    background-color: var(--color-figma-purple);

    &:before {
      transform: translateX(16px);
    }
  }
}
</style>
