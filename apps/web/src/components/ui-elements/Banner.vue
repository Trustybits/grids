<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <Transition :name="transitionName">
    <div
      v-if="!isDismissed"
      ref="bannerEl"
      class="banner"
      :class="[`banner--${severity}`]"
      role="status"
    >
      <div v-if="$slots.icon" class="banner__icon">
        <slot name="icon" />
      </div>

      <span class="banner__message">
        <slot />
      </span>

      <button
        v-if="dismissible"
        class="banner__close"
        aria-label="Dismiss"
        @click="dismiss"
      >
        <CloseXIcon :size="14" />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import CloseXIcon from '@/components/icons/CloseXIcon.vue';

export type BannerSeverity = 'info' | 'caution' | 'success' | 'error';

const props = withDefaults(
  defineProps<{
    severity?: BannerSeverity;
    dismissible?: boolean;
    transitionName?: string;
  }>(),
  {
    severity: 'info',
    dismissible: true,
    transitionName: 'banner',
  },
);

const emit = defineEmits<{
  dismiss: [];
}>();

const bannerEl = ref<HTMLElement | null>(null);
const isDismissed = ref(false);

const dismiss = () => {
  isDismissed.value = true;
  emit('dismiss');
};

const reset = () => {
  isDismissed.value = false;
};

defineExpose({ bannerEl, reset });

watch(
  () => props.severity,
  () => {
    isDismissed.value = false;
  },
);
</script>

<style lang="scss" scoped>
.banner {
  position: sticky;
  top: 0;
  z-index: calc(var(--z-base, 1) + 10);

  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 8px 14px;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  backdrop-filter: blur(20px);

  &--info {
    background-color: color-mix(in srgb, var(--color-figma-purple, #a259ff) 18%, var(--color-tile-background));
    border-bottom: 1px solid color-mix(in srgb, var(--color-figma-purple, #a259ff) 30%, transparent);
    color: var(--color-text-primary);
  }

  &--caution {
    background-color: color-mix(in srgb, var(--color-figma-yellow, #f5a623) 18%, var(--color-tile-background));
    border-bottom: 1px solid color-mix(in srgb, var(--color-figma-yellow, #f5a623) 30%, transparent);
    color: var(--color-text-primary);
  }

  &--success {
    background-color: color-mix(in srgb, var(--color-figma-green, #1bc47d) 18%, var(--color-tile-background));
    border-bottom: 1px solid color-mix(in srgb, var(--color-figma-green, #1bc47d) 30%, transparent);
    color: var(--color-text-primary);
  }

  &--error {
    background-color: color-mix(in srgb, var(--color-figma-red, #f24822) 18%, var(--color-tile-background));
    border-bottom: 1px solid color-mix(in srgb, var(--color-figma-red, #f24822) 30%, transparent);
    color: var(--color-text-primary);
  }
}

.banner__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;

  .banner--info & {
    color: var(--color-figma-purple, #a259ff);
  }

  .banner--caution & {
    color: var(--color-figma-yellow, #f5a623);
  }

  .banner--success & {
    color: var(--color-figma-green, #1bc47d);
  }

  .banner--error & {
    color: var(--color-figma-red, #f24822);
  }
}

.banner__message {
  flex-shrink: 1;
}

.banner__close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-content-default);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity var(--duration-fast) var(--easing-smooth);

  &:hover {
    opacity: 1;
  }
}

.banner-enter-active,
.banner-leave-active {
  transition:
    opacity 0.2s var(--easing-ease-out),
    transform 0.2s var(--easing-ease-out);
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
