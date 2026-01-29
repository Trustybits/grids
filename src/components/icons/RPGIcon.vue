<template>
  <svg 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- Sword blade -->
    <path 
      d="M14.5 3L21 9.5L10.5 20L9 18.5L19.5 8L13 4.5L14.5 3Z" 
      fill="currentColor" 
      opacity="0.8"
    />
    <!-- Sword handle -->
    <rect 
      x="7.5" 
      y="16" 
      width="3" 
      height="4" 
      rx="0.5" 
      transform="rotate(-45 9 18)" 
      fill="currentColor"
    />
    <!-- Shield -->
    <path 
      d="M3 6C3 5.44772 3.44772 5 4 5H8C8.55228 5 9 5.44772 9 6V10C9 12.7614 6.76142 15 4 15C3.44772 15 3 14.5523 3 14V6Z" 
      stroke="currentColor" 
      stroke-width="1.5" 
      fill="none"
    />
    <!-- Shield detail -->
    <line 
      x1="6" 
      y1="7" 
      x2="6" 
      y2="12" 
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
    default: 24
  }
});
</script>
