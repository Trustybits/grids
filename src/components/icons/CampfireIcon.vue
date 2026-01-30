<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- 📋 PASTE YOUR FIGMA SVG CONTENT HERE -->
    <!-- This is the TILE BUTTON icon (node-id=941-513) -->
    <!-- Copy the SVG from Figma and paste the path elements below -->
    <path d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" stroke="currentColor" stroke-width="1.5"/>
    <path d="M16.3333 10.5383C16.3333 13.841 13.4888 14.6667 12.0666 14.6667C10.8222 14.6667 8.33331 13.841 8.33331 10.5383C8.33331 9.14011 9.13891 8.23884 9.84064 7.76849C10.1976 7.52925 10.6557 7.70134 10.7153 8.11749C10.8342 8.94733 11.5851 9.56629 12.0397 8.85332C12.4282 8.24409 12.5686 7.42113 12.5686 6.92597C12.5686 6.1931 13.3353 5.72739 13.9339 6.1764C15.1008 7.0516 16.3333 8.51733 16.3333 10.5383Z" stroke="currentColor" stroke-width="1.5"/>
    <path d="M11 17L9 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M13 17L15 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M15 17L18 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M9 17L6 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>

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
