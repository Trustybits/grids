<template>
  <svg 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M15.5 11L15.6716 11.1716C17.0049 12.5049 17.6716 13.1716 17.6716 14C17.6716 14.8284 17.0049 15.4951 15.6716 16.8284L15.5 17" 
      stroke="currentColor" 
      stroke-width="1.5" 
      stroke-linecap="round"
    />
    <path 
      d="M13.2939 7.17041L11.9998 12L10.7058 16.8297" 
      stroke="currentColor" 
      stroke-width="1.5" 
      stroke-linecap="round"
    />
    <path 
      d="M8.50019 7L8.32861 7.17157C6.99528 8.5049 6.32861 9.1716 6.32861 10C6.32861 10.8284 6.99528 11.4951 8.32861 12.8284L8.50019 13" 
      stroke="currentColor" 
      stroke-width="1.5" 
      stroke-linecap="round"
    />
    <path 
      d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" 
      stroke="currentColor" 
      stroke-width="1.5"
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
