<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 19H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M9 5V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M15 10V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
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
