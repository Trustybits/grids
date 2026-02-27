<template>
  <slot />
</template>

<script setup lang="ts">
// This component provides tooltip styling via CSS
// Usage: Wrap any element and add data-tooltip attribute to show tooltip on hover
</script>

<style lang="scss">
/* Global tooltip styles - must be unscoped to work with data-tooltip attribute */
[data-tooltip] {
  position: relative;

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) scale(0.9);
    white-space: nowrap;
    font-size: 11px;
    line-height: 1;
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    background-color: var(--color-text-primary);
    color: var(--color-tile-background);
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--duration-fast) var(--easing-ease-out),
                transform var(--duration-fast) var(--easing-ease-out);
    z-index: var(--z-tooltip);
  }

  &:hover::after {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}
</style>
