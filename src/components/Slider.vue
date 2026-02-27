<template>
  <div class="slider-container">
    <div class="slider-header">
      <span class="slider-label">{{ label }}</span>
    </div>
    <div class="slider-wrapper">
      <span class="slider-hint-left">{{ leftLabel }}</span>
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        @input="handleInput"
        class="slider"
      />
      <span class="slider-hint-right">{{ rightLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  leftLabel: string;
  rightLabel: string;
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', parseFloat(target.value));
};
</script>

<style lang="scss" scoped>
.slider-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
}

.slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slider-label {
  font-size: var(--font-size-sm);
  color: var(--color-content-default);
  font-weight: 500;
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.slider-hint-left,
.slider-hint-right {
  font-size: var(--font-size-xs);
  color: var(--color-content-low);
  white-space: nowrap;
  min-width: 60px;
}

.slider-hint-left {
  text-align: right;
}

.slider-hint-right {
  text-align: left;
}

.slider {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--color-base-34);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-figma-purple);
    cursor: pointer;
    transition: all var(--duration-fast) var(--easing-smooth);

    &:hover {
      transform: scale(1.2);
    }

    &:active {
      transform: scale(1.1);
    }
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-figma-purple);
    cursor: pointer;
    border: none;
    transition: all var(--duration-fast) var(--easing-smooth);

    &:hover {
      transform: scale(1.2);
    }

    &:active {
      transform: scale(1.1);
    }
  }

  &::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: var(--color-base-34);
  }

  &::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: var(--color-base-34);
  }
}
</style>
