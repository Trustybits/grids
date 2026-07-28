<!--
  PreviewIcon.vue — Figma `grids_preview` (424:3845)

  Mobile 2.0 command bar. A filled eye: the pupil sits behind the eye shape,
  which is cut out around the iris (`fill-rule: evenodd`) so the pupil shows
  through. Both are Figma's exported paths, nested at the insets Figma placed
  them on inside the 24x24 box, in Figma's own order. `currentColor` in place of
  Figma's white at 76% opacity, so the icon follows the button's color token in
  both themes.
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
      x="9.75"
      y="9.75"
      width="4.5"
      height="4.5"
      viewBox="0 0 4.5 4.5"
      preserveAspectRatio="none"
    >
      <path
        d="M0 2.25C0 1.0074 1.0074 0 2.25 0C3.4926 0 4.5 1.0074 4.5 2.25C4.5 3.4926 3.4926 4.5 2.25 4.5C1.0074 4.5 0 3.4926 0 2.25Z"
        fill="currentColor"
      />
    </svg>

    <svg
      x="2"
      y="4"
      width="20"
      height="16"
      viewBox="0 0 20 16"
      preserveAspectRatio="none"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M0 8C0 9.6394 0.42496 10.1915 1.27489 11.2957C2.97196 13.5004 5.81811 16 10 16C14.1819 16 17.028 13.5004 18.7251 11.2957C19.575 10.1915 20 9.6394 20 8C20 6.3606 19.575 5.80853 18.7251 4.70433C17.028 2.49956 14.1819 0 10 0C5.81811 0 2.97196 2.49956 1.27489 4.70433C0.42496 5.80853 0 6.3606 0 8ZM10 4.25C7.92893 4.25 6.25 5.92893 6.25 8C6.25 10.0711 7.92893 11.75 10 11.75C12.0711 11.75 13.75 10.0711 13.75 8C13.75 5.92893 12.0711 4.25 10 4.25Z"
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
