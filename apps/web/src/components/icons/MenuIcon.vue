<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 7h16M4 12h16M4 17h16"
      stroke="currentColor"
      stroke-width="1.5"
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
});
</script>
