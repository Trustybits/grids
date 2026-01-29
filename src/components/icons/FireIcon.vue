<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12.5 2C12.5 2 9.5 5.5 9.5 9C9.5 10.6569 10.8431 12 12.5 12C14.1569 12 15.5 10.6569 15.5 9C15.5 7 14 5.5 14 5.5C14 5.5 16.5 7.5 16.5 10.5C16.5 12.1569 15.1569 13.5 13.5 13.5"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M3.5 14C3.5 14 5.5 11 8.5 11C11.5 11 13 13.5 13 13.5C13 13.5 14.5 11.5 16.5 11.5C19.5 11.5 20.5 14 20.5 14C20.5 17.5 17.5 22 12 22C6.5 22 3.5 17.5 3.5 14Z"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
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
