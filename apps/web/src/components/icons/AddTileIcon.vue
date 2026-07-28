<!--
  AddTileIcon.vue — Figma `grids_addTile` (243:5389)

  Mobile 2.0 command bar. A filled icon, unlike the older stroked set: the path
  is Figma's export verbatim, nested at the inset Figma placed it on inside the
  24x24 box so the leaf keeps its own geometry. Figma fills it white at 76%
  opacity; here it is `currentColor` so it follows the button's color token and
  works in both themes.
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
      x="2"
      y="2"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      preserveAspectRatio="none"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M10 20C5.28595 20 2.92893 20 1.46447 18.5355C-1.19209e-07 17.0711 0 14.714 0 10C0 5.28595 -1.19209e-07 2.92893 1.46447 1.46447C2.92893 -1.19209e-07 5.28595 0 10 0C14.714 0 17.0711 -1.19209e-07 18.5355 1.46447C20 2.92893 20 5.28595 20 10C20 14.714 20 17.0711 18.5355 18.5355C17.0711 20 14.714 20 10 20ZM10 6.25C10.4142 6.25 10.75 6.58579 10.75 7V9.25H13C13.4142 9.25 13.75 9.5858 13.75 10C13.75 10.4142 13.4142 10.75 13 10.75H10.75V13C10.75 13.4142 10.4142 13.75 10 13.75C9.5858 13.75 9.25 13.4142 9.25 13V10.75H7C6.58579 10.75 6.25 10.4142 6.25 10C6.25 9.5858 6.58579 9.25 7 9.25H9.25V7C9.25 6.58579 9.5858 6.25 10 6.25Z"
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
