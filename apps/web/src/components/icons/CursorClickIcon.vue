<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M15 15l-2 5L9 9l11 4-5 2z" />
    <path d="M5 3a2 2 0 0 0-2 2" />
    <path d="M19 3a2 2 0 0 1 2 2" />
    <path d="M3 19a2 2 0 0 0 2 2" />
    <path d="M5 3h4" />
    <path d="M15 3h4" />
    <path d="M3 9v4" />
    <path d="M21 5v4" />
    <path d="M3 15v4" />
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
