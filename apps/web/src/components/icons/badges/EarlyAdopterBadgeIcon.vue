<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- Sunrise / dawn motif: horizon line with rising sun, evoking "earliest days" -->
    <circle
      cx="12"
      cy="12"
      r="10"
      fill="url(#early-adopter-bg)"
      stroke="currentColor"
      stroke-opacity="0.18"
      stroke-width="0.75"
    />
    <path
      d="M5 15.25H19"
      stroke="#FFFFFF"
      stroke-opacity="0.95"
      stroke-width="1.4"
      stroke-linecap="round"
    />
    <circle cx="12" cy="13.5" r="3.6" fill="#FFFFFF" fill-opacity="0.95" />
    <path
      d="M12 7.25V8.75"
      stroke="#FFFFFF"
      stroke-opacity="0.85"
      stroke-width="1.2"
      stroke-linecap="round"
    />
    <path
      d="M7.4 9.4L8.5 10.5"
      stroke="#FFFFFF"
      stroke-opacity="0.7"
      stroke-width="1.2"
      stroke-linecap="round"
    />
    <path
      d="M16.6 9.4L15.5 10.5"
      stroke="#FFFFFF"
      stroke-opacity="0.7"
      stroke-width="1.2"
      stroke-linecap="round"
    />
    <defs>
      <linearGradient
        id="early-adopter-bg"
        x1="2"
        y1="2"
        x2="22"
        y2="22"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stop-color="#FBBF24" />
        <stop offset="100%" stop-color="#F97316" />
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
