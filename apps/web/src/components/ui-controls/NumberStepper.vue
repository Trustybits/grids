<template>
  <div class="stepper" :data-tooltip="tooltip">
    <span class="stepper__label">{{ label }}</span>
    <div class="stepper__controls">
      <button
        type="button"
        class="stepper__button"
        :aria-label="`Decrease ${label}`"
        :disabled="modelValue <= min"
        @click="step(-1)"
      >
        −
      </button>
      <span class="stepper__value" aria-live="polite">{{ modelValue }}</span>
      <button
        type="button"
        class="stepper__button"
        :aria-label="`Increase ${label}`"
        :disabled="modelValue >= max"
        @click="step(1)"
      >
        +
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    tooltip?: string;
  }>(),
  {
    min: -Infinity,
    max: Infinity,
    step: 1,
    tooltip: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const step = (direction: 1 | -1): void => {
  const next = Math.min(
    props.max,
    Math.max(props.min, props.modelValue + direction * props.step),
  );
  if (next !== props.modelValue) emit("update:modelValue", next);
};
</script>

<style lang="scss" scoped>
.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  line-height: 1.5;
  min-height: 40px;
  box-sizing: border-box;

  &__label {
    user-select: none;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-shrink: 0;
  }

  &__value {
    min-width: 2ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
    user-select: none;
  }

  &__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--color-tile-stroke);
    border-radius: var(--radius-sm);
    background: var(--color-content-low);
    color: inherit;
    font: inherit;
    line-height: 1;
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--easing-smooth);

    &:hover:not(:disabled) {
      background-color: var(--color-input-edit);
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }
}
</style>
