<template>
  <div class="menu-section">
    <slot></slot>
  </div>
</template>

<style lang="scss" scoped>
.menu-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
</style>
