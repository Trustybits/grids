<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="3"
      width="7.5"
      height="7.5"
      rx="2"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <rect
      x="13.5"
      y="3"
      width="7.5"
      height="7.5"
      rx="3.75"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <rect
      x="3"
      y="13.5"
      width="7.5"
      height="7.5"
      rx="3.75"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <rect
      x="13.5"
      y="13.5"
      width="7.5"
      height="7.5"
      rx="2"
      stroke="currentColor"
      stroke-width="1.5"
    />
  </svg>
</template>

<script setup lang="ts">
defineProps({
  size: {
    type: [String, Number],
    default: 24,
  },
});
</script>
