<!--
  PreviewDesktopIcon.vue — Figma `grids_previewDesktop` (243:5420)

  Mobile 2.0 preview toolbar. A filled monitor whose stand is part of the same
  path. Figma's exported 20x18 leaf, nested at the inset Figma placed it on
  inside the 24x24 box, with `currentColor` in place of Figma's white at 76%
  opacity so the icon follows the button's color token in both themes.

  Distinct from `DeviceDesktopIcon`, which is the outlined glyph the desktop
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
      y="3"
      width="20"
      height="18"
      viewBox="0 0 20 18"
      preserveAspectRatio="none"
    >
      <path
        d="M0 5.75994C0 3.04468 0 1.68705 0.87868 0.84352C1.75736 -5.96046e-08 3.17157 0 6 0H14C16.8284 0 18.2426 -5.96046e-08 19.1213 0.84352C20 1.68705 20 3.04468 20 5.75994V6.71993C20 9.4352 20 10.7928 19.1213 11.6363C18.2426 12.4799 16.8284 12.4799 14 12.4799H10.75V14.8409L16.2372 16.5968C16.6301 16.7225 16.8425 17.1303 16.7115 17.5075C16.5805 17.8847 16.1558 18.0886 15.7628 17.9629L10 16.1188L4.23717 17.9629C3.84421 18.0886 3.41947 17.8847 3.28849 17.5075C3.1575 17.1303 3.36987 16.7225 3.76283 16.5968L9.25 14.8409V12.4799H6C3.17157 12.4799 1.75736 12.4799 0.87868 11.6363C0 10.7928 0 9.4352 0 6.71993V5.75994Z"
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
