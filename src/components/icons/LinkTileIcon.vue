<template>
  <svg 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" 
      stroke="currentColor" 
      stroke-width="1.5"
    />
    <path 
      d="M9 16C7.11438 16 6.17157 16 5.58579 15.4142C5 14.8284 5 13.8856 5 12C5 10.1144 5 9.17157 5.58579 8.58579C6.17157 8 7.11438 8 9 8C10.8856 8 11.8284 8 12.4142 8.58579C13 9.17157 13 10.1144 13 12" 
      stroke="currentColor" 
      stroke-width="1.5" 
      stroke-linecap="round" 
      stroke-linejoin="round"
    />
    <path 
      d="M11 12C11 13.8856 11 14.8284 11.5858 15.4142C12.1716 16 13.1144 16 15 16C16.8856 16 17.8284 16 18.4142 15.4142C19 14.8284 19 13.8856 19 12C19 10.1144 19 9.17157 18.4142 8.58579C17.8284 8 16.8856 8 15 8" 
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
    default: 24
  }
});
</script>
