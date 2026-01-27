<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9.5 4.5L3 6.8V19.5L9.5 17.2L14.5 19.5L21 17.2V4.5L14.5 6.8L9.5 4.5Z"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
    <path d="M9.5 4.5V17.2" stroke="currentColor" stroke-width="1.5" />
    <path d="M14.5 6.8V19.5" stroke="currentColor" stroke-width="1.5" />
    <circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5" />
  </svg>
</template>

<script setup>
defineProps({
  size: {
    type: [String, Number],
    default: 24,
  },
});
</script>
