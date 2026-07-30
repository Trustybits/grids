<!--
  PreviewTabletIcon.vue — Figma `grids_previewTablet` (525:18377)

  Mobile 2.0 preview toolbar. A filled tablet; `fill-rule: evenodd` cuts the
  home indicator back out of the body. Figma's exported 20x16 leaf, nested at
  the inset Figma placed it on inside the 24x24 box, with `currentColor` in
  place of Figma's white at 76% opacity so the icon follows the button's color
  token in both themes.

  Distinct from `DeviceTabletIcon`, which is the outlined glyph the desktop
  `ViewControls` switcher still uses.
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
      y="4"
      width="20"
      height="16"
      viewBox="0 0 20 16"
      preserveAspectRatio="none"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M1.17157 14.8284C2.34315 16 4.22876 16 8 16H12C15.7712 16 17.6569 16 18.8284 14.8284C20 13.6569 20 11.7712 20 8C20 4.22876 20 2.34314 18.8284 1.17157C17.6569 -1.19209e-07 15.7712 0 12 0H8C4.22876 0 2.34315 -1.19209e-07 1.17157 1.17157C1.19209e-07 2.34315 0 4.22876 0 8C0 11.7712 1.19209e-07 13.6569 1.17157 14.8284ZM7 12.25C6.58579 12.25 6.25 12.5858 6.25 13C6.25 13.4142 6.58579 13.75 7 13.75H13C13.4142 13.75 13.75 13.4142 13.75 13C13.75 12.5858 13.4142 12.25 13 12.25H7Z"
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
