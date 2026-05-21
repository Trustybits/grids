<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :class="{ spin: spinning }"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-width="2"
      stroke-dasharray="40 20"
      stroke-linecap="round"
    />
  </svg>
</template>

<script setup lang="ts">
defineProps({
  size: {
    type: [String, Number],
    default: 24,
  },
  spinning: {
    type: Boolean,
    default: true,
  },
});
</script>

<style scoped>
.spin {
  animation: icon-spin 1s linear infinite;
}
@keyframes icon-spin {
  to { transform: rotate(360deg); }
}
</style>
