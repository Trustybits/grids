<template>
  <svg
    viewBox="0 0 19 18.13"
    :width="size"
    :height="size"
    fill="currentColor"
  >
    <path
      d="M17.4086 6.66543C19.5305 7.71151 19.5305 10.4194 17.4086 11.4654L4.59662 17.7814C2.53435 18.7981 0 17.4748 0 15.3814V2.74945C0 0.656047 2.53435 -0.667198 4.59661 0.349454L17.4086 6.66543Z"
    />
  </svg>
</template>

<script setup lang="ts">
defineProps({
  size: {
    type: [String, Number],
    default: 16,
  },
});
</script>
