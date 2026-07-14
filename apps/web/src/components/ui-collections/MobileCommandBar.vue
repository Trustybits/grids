<!--
  MobileCommandBar.vue

  Reusable presentational "pill" used by the Mobile 2.0 chrome (bottom grid bar,
  tile carousel, grid settings sheet). It is a container only: it renders a
  rounded, floating bar and owns spacing, surface, and the optional group
  divider. Consumers provide the buttons/content via slots.

  Slots:
    - default : the primary group of command items.
    - end     : an optional trailing group. When present, a divider is drawn
                between the default group and this group (matches the Figma
                "… | Share" layout).
-->
<template>
  <div class="mobile-command-bar" role="toolbar" :aria-label="ariaLabel">
    <div class="mobile-command-bar__group">
      <slot />
    </div>
    <template v-if="$slots.end">
      <span class="mobile-command-bar__divider" aria-hidden="true" />
      <div class="mobile-command-bar__group">
        <slot name="end" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Accessible label for the toolbar landmark. */
    ariaLabel?: string;
  }>(),
  {
    ariaLabel: "Grid commands",
  },
);
</script>

<style lang="scss" scoped>
.mobile-command-bar {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs);
  border-radius: var(--radius-full);
  background-color: var(--color-toolbar-background);
  border: var(--border-width) solid var(--color-stroke);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(20px);
}

.mobile-command-bar__group {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.mobile-command-bar__divider {
  width: var(--border-width);
  align-self: stretch;
  margin: var(--spacing-xs) 2px;
  background-color: var(--color-stroke);
}
</style>
