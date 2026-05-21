<template>
  <div class="icon-button">
    <component
      :is="href ? 'a' : 'button'"
      v-bind="linkProps"
      class="icon-button__trigger"
      :class="{ 'icon-button__trigger--active': active }"
      :style="hoverColorStyle"
      @click="$emit('click', $event)"
    >
      <div class="icon-button__icon">
        <slot />
      </div>
    </component>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  href?: string;
  hoverColor?: string;
  active?: boolean;
}>();

defineEmits<{
  click: [event: MouseEvent];
}>();

const linkProps = computed(() => {
  if (props.href) {
    return {
      href: props.href,
      target: '_blank',
      rel: 'noopener noreferrer',
    };
  }
  return { type: 'button' };
});

const hoverColorStyle = computed(() => {
  if (props.hoverColor) {
    return { '--icon-button-hover-color': props.hoverColor } as Record<string, string>;
  }
  return {};
});
</script>

<style lang="scss" scoped>
.icon-button {
  position: relative;
}

.icon-button__trigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--duration-fast) var(--easing-smooth);
  padding: 0;
  border: none;
  line-height: 0;
  text-decoration: none;

  &:hover,
  &--active {
    background: var(--color-base-34);

    .icon-button__icon {
      color: var(--icon-button-hover-color, var(--color-figma-purple));
    }
  }
}

.icon-button__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--bg-contrast-color, var(--color-content-default));
  transition: color var(--duration-fast) var(--easing-smooth);

  :deep(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
}
</style>
