<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <component
    :is="elementType"
    v-bind="elementProps"
    class="ui-btn"
    :class="[
      `ui-btn--${variant}`,
      `ui-btn--${size}`,
      {
        'ui-btn--block': block,
        'ui-btn--disabled': disabled || loading,
        'ui-btn--loading': loading,
      },
    ]"
    :disabled="isButton ? (disabled || loading) : undefined"
    @click="handleClick"
  >
    <span v-if="loading" class="ui-btn__spinner" aria-hidden="true" />
    <span v-if="$slots['icon-left']" class="ui-btn__icon ui-btn__icon--left">
      <slot name="icon-left" />
    </span>
    <span class="ui-btn__label">
      <slot />
    </span>
    <span v-if="$slots['icon-right']" class="ui-btn__icon ui-btn__icon--right">
      <slot name="icon-right" />
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    to?: string;
    href?: string;
    disabled?: boolean;
    block?: boolean;
    loading?: boolean;
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    disabled: false,
    block: false,
    loading: false,
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const isButton = computed(() => !props.to && !props.href);

const elementType = computed(() => {
  if (props.to) return RouterLink;
  if (props.href) return 'a';
  return 'button';
});

const elementProps = computed(() => {
  if (props.to) {
    return { to: props.to };
  }
  if (props.href) {
    return {
      href: props.href,
      target: '_blank',
      rel: 'noopener noreferrer',
    };
  }
  return { type: 'button' };
});

const handleClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) {
    event.preventDefault();
    return;
  }
  emit('click', event);
};
</script>

<style lang="scss" scoped>
.ui-btn {
  --btn-padding-x: var(--spacing-lg);
  --btn-padding-y: var(--spacing-sm);
  --btn-font-size: 14px;
  --btn-radius: var(--radius-sm);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--btn-padding-y) var(--btn-padding-x);
  font-size: var(--btn-font-size);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-base);
  line-height: 1;
  border-radius: var(--btn-radius);
  border: var(--tile-border-width) solid transparent;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    border-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth),
    opacity var(--duration-fast) var(--easing-smooth);

  &:focus-visible {
    outline: 2px solid var(--color-figma-purple);
    outline-offset: 2px;
  }

  // ─── Sizes ───────────────────────────────────────────────────
  &--sm {
    --btn-padding-x: 12px;
    --btn-padding-y: 6px;
    --btn-font-size: 13px;
  }

  &--md {
    --btn-padding-x: var(--spacing-md);
    --btn-padding-y: var(--spacing-sm);
    --btn-font-size: 14px;
    font-weight: var(--font-weight-semibold);
  }

  &--lg {
    --btn-padding-x: 16px;
    --btn-padding-y: 12px;
    --btn-font-size: 15px;
    font-weight: var(--font-weight-semibold);
  }

  // ─── Variants ────────────────────────────────────────────────

  &--primary {
    background-color: var(--primary-color, var(--color-content-high));
    border-color: transparent;
    color: var(--color-text-primary);

    &:hover:not(.ui-btn--disabled) {
      background-color: var(--color-content-high);
    }
  }

  &--secondary {
    background-color: transparent;
    border-color: var(--color-tile-stroke);
    color: var(--color-text-primary);

    &:hover:not(.ui-btn--disabled) {
      background-color: var(--color-content-background);
      border-color: var(--color-content-high);
    }
  }

  &--ghost {
    background-color: transparent;
    border-color: transparent;
    color: var(--color-content-default);

    &:hover:not(.ui-btn--disabled) {
      color: var(--color-text-primary);
      background-color: var(--color-content-background);
    }
  }

  &--danger {
    background-color: var(--color-figma-red);
    border-color: transparent;
    color: #fff;

    &:hover:not(.ui-btn--disabled) {
      background-color: color-mix(in srgb, var(--color-figma-red) 85%, #000);
    }
  }

  &--brand {
    background: var(--mkt-brand-gradient, var(--color-figma-purple));
    border: 0;
    color: #000;
    font-weight: var(--font-weight-bold);
    letter-spacing: -0.01em;

    &:hover:not(.ui-btn--disabled) {
      opacity: 0.9;
    }
  }

  &--outline {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.22);
    color: var(--mkt-fg-1, var(--color-text-primary));
    font-weight: var(--font-weight-semibold);
    letter-spacing: -0.01em;

    &:hover:not(.ui-btn--disabled) {
      border-color: rgba(255, 255, 255, 0.35);
      background: rgba(255, 255, 255, 0.04);
    }
  }

  // ─── States ──────────────────────────────────────────────────

  &--block {
    width: 100%;
  }

  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  &--disabled.ui-btn--secondary,
  &--disabled.ui-btn--ghost {
    opacity: 0.4;
    color: var(--color-content-low);
  }

  &--loading {
    position: relative;

    .ui-btn__label,
    .ui-btn__icon {
      opacity: 0;
    }
  }
}

.ui-btn__spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ui-btn-spin 0.6s linear infinite;
}

.ui-btn__icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.ui-btn__label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

@keyframes ui-btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
