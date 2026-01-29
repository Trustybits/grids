<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 3L5 15C5 16.8856 5 17.8284 5.58579 18.4142C6.17157 19 7.11438 19 9 19H11C12.8856 19 13.8284 19 14.4142 18.4142C15 17.8284 15 16.8856 15 15V3"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M5 10H15"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      d="M10 3V10"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      d="M5 3C5 2.44772 5.44772 2 6 2H14C14.5523 2 15 2.44772 15 3"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
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
