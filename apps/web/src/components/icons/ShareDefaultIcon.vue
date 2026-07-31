<!--
  ShareDefaultIcon.vue — Figma `grids_shareDefault` (243:5446)

  The share glyph shown on every platform except Apple's — three filled nodes
  joined by two links, the convention Android and the desktop web share. Apple
  platforms get ShareAppleIcon (the tray-and-arrow their share sheet uses)
  instead; MobileGridBar picks between them.

  Figma's exported path, nested at the inset Figma placed it on inside the 24x24
  box. `currentColor` in place of Figma's white at 76% opacity, so the icon
  follows the button's color token in both themes.
-->
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <svg
      x="3.5"
      y="2"
      width="17"
      height="20"
      viewBox="0 0 17 20"
      preserveAspectRatio="none"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M10.303 3.33333C10.303 1.49238 11.8022 0 13.6515 0C15.5008 0 17 1.49238 17 3.33333C17 5.17428 15.5008 6.66667 13.6515 6.66667C12.7177 6.66667 11.8738 6.28596 11.2671 5.67347L6.6317 8.8295C6.6745 9.0425 6.697 9.2625 6.697 9.4872C6.697 9.9322 6.609 10.3576 6.44959 10.7464L11.5323 14.0858C12.1092 13.6161 12.8473 13.3333 13.6515 13.3333C15.5008 13.3333 17 14.8257 17 16.6667C17 18.5076 15.5008 20 13.6515 20C11.8022 20 10.303 18.5076 10.303 16.6667C10.303 16.1845 10.4062 15.7255 10.5917 15.3111L5.55007 11.9987C4.96196 12.5098 4.1916 12.8205 3.34848 12.8205C1.49917 12.8205 0 11.3281 0 9.4872C0 7.64623 1.49917 6.15385 3.34848 6.15385C4.4119 6.15385 5.35853 6.64725 5.97145 7.41518L10.4639 4.35642C10.3594 4.03359 10.303 3.6896 10.303 3.33333Z"
        fill="currentColor"
      />
    </svg>
  </svg>
</template>

<script setup lang="ts">
defineProps({
  size: {
    type: [String, Number],
    default: 24,
  },
});
</script>
