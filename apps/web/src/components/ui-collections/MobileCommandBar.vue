<!--
  MobileCommandBar.vue

  Reusable presentational "pill" used by the Mobile 2.0 chrome (bottom grid bar,
  tile carousel, grid settings sheet). It is a container only: it renders a
  rounded, floating bar and owns spacing and surface. Consumers provide the
  buttons/content — and any `Divider` between groups — via the default slot.
-->
<template>
  <div class="mobile-command-bar" role="toolbar" :aria-label="ariaLabel">
    <div class="mobile-command-bar__group">
      <slot />
    </div>
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
  border-radius: var(--radius-md);
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
</style>
