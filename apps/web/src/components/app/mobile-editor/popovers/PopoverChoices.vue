<!--
  PopoverChoices.vue

  A row of equal choices inside a tool popover — Top · Middle · Bottom, Show ·
  Hide, the font sizes. The current one gets the see-through selected
  background; when the tiles disagree ("mixed") none does. Set `multiple` for
  independent toggles (Bold, Italic, …), where each option's `on` is its state.
-->
<template>
  <div
    class="ppc"
    :class="{ 'ppc--wrap': wrap }"
    :role="multiple ? 'group' : 'radiogroup'"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="ppc__option"
      :class="{ 'is-current': isCurrent(option) }"
      :role="multiple ? undefined : 'radio'"
      :aria-checked="multiple ? undefined : isCurrent(option)"
      :aria-pressed="multiple ? isCurrent(option) : undefined"
      :aria-label="option.ariaLabel ?? option.label"
      :disabled="option.disabled"
      :style="option.fontFamily ? { fontFamily: option.fontFamily } : undefined"
      @click="$emit('select', option.value)"
    >
      <component :is="option.icon" v-if="option.icon" class="ppc__icon" />
      <span v-if="option.label" class="ppc__label" :class="option.labelClass">
        {{ option.label }}
      </span>
      <span v-if="option.hint" class="ppc__hint">{{ option.hint }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Component } from "vue";

export interface PopoverChoice {
  value: string;
  label?: string;
  ariaLabel?: string;
  hint?: string;
  icon?: Component;
  disabled?: boolean;
  /** Toggle groups: whether this option is on. */
  on?: boolean;
  fontFamily?: string;
  labelClass?: string;
}

const props = withDefaults(
  defineProps<{
    options: PopoverChoice[];
    /** The current value; anything not in `options` (mixed) selects none. */
    modelValue?: unknown;
    label: string;
    multiple?: boolean;
    wrap?: boolean;
  }>(),
  { modelValue: undefined, multiple: false, wrap: false },
);

defineEmits<{ select: [value: string] }>();

const isCurrent = (option: PopoverChoice) =>
  props.multiple ? !!option.on : option.value === props.modelValue;
</script>

<style scoped>
/* Figma "Segmented": a filled track with the current option raised. */
.ppc {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 10px;
  background: var(--color-tool-selected-bg);
}

/* Two per row: long labels stay readable. */
.ppc--wrap {
  flex-wrap: wrap;
}

.ppc--wrap .ppc__option {
  flex: 1 1 calc(50% - 1px);
}

.ppc__option {
  display: inline-flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 44px;
  min-height: 46px;
  padding: 4px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-content-high);
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth),
    transform var(--duration-instant) var(--easing-smooth);
}

.ppc__option:active:not(:disabled) {
  transform: scale(0.95);
}

.ppc__option.is-current {
  background: var(--color-toolbar-background);
  color: var(--color-text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

/* Toggles that are on read in the accent, so several can be on at once. */
.ppc[role="group"] .ppc__option.is-current {
  color: var(--color-tool-active);
}

.ppc__option:disabled {
  opacity: 0.35;
  cursor: default;
}

.ppc__option:focus-visible {
  outline: 2px solid var(--color-tool-active);
  outline-offset: -2px;
}

.ppc__icon {
  width: 20px;
  height: 20px;
}

.ppc__label {
  line-height: 1.1;
  white-space: nowrap;
}

.ppc__hint {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-content-low);
}
</style>
