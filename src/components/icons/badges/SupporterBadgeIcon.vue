<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- Heart inside a coin/disc — gratitude + financial support -->
    <circle
      cx="12"
      cy="12"
      r="10"
      fill="url(#supporter-bg)"
      stroke="currentColor"
      stroke-opacity="0.18"
      stroke-width="0.75"
    />
    <path
      d="M12 16.5C12 16.5 6.5 13.5 6.5 10C6.5 8.5 7.7 7.25 9.25 7.25C10.4 7.25 11.4 7.95 12 8.95C12.6 7.95 13.6 7.25 14.75 7.25C16.3 7.25 17.5 8.5 17.5 10C17.5 13.5 12 16.5 12 16.5Z"
      fill="#FFFFFF"
      fill-opacity="0.95"
    />
    <defs>
      <linearGradient
        id="supporter-bg"
        x1="2"
        y1="2"
        x2="22"
        y2="22"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stop-color="#F97316" />
        <stop offset="100%" stop-color="#DC2626" />
      </linearGradient>
    </defs>
  </svg>
</template>

<script setup lang="ts">
defineProps({
  size: {
    type: [String, Number],
    default: 20,
  },
});
</script>
