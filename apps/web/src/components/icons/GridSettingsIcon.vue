<!--
  GridSettingsIcon.vue — Figma `grids_settings` (243:5342)

  Mobile 2.0 command bar. Three filled panels — a tall one on the left, a short
  and a tall one stacked on the right — reading as a grid layout. Each is Figma's
  exported path, nested at the inset Figma placed it on inside the 24x24 box so
  every leaf keeps its own geometry. `currentColor` in place of Figma's white at
  76% opacity, so the icon follows the button's color token in both themes.
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
      width="9"
      height="20"
      viewBox="0 0 9 20"
      preserveAspectRatio="none"
    >
      <path
        d="M0 4.21053C0 2.22567 -5.96046e-08 1.23323 0.65901 0.61662C1.31802 5.96046e-08 2.37868 0 4.5 0C6.62132 0 7.68198 5.96046e-08 8.341 0.61662C9 1.23323 9 2.22567 9 4.21053V15.7895C9 17.7743 9 18.7668 8.341 19.3834C7.68198 20 6.62132 20 4.5 20C2.37868 20 1.31802 20 0.65901 19.3834C-5.96046e-08 18.7668 0 17.7743 0 15.7895V4.21053Z"
        fill="currentColor"
      />
    </svg>

    <svg
      x="13"
      y="2"
      width="9"
      height="7"
      viewBox="0 0 9 7"
      preserveAspectRatio="none"
    >
      <path
        d="M0 3.5C0 2.4128 -5.96046e-08 1.8692 0.1713 1.44041C0.3996 0.86867 0.8376 0.41443 1.389 0.17761C1.8024 -7.45058e-08 2.3266 0 3.375 0H5.625C6.6734 0 7.1976 -7.45058e-08 7.611 0.17761C8.1624 0.41443 8.6004 0.86867 8.8287 1.44041C9 1.8692 9 2.4128 9 3.5C9 4.5872 9 5.1308 8.8287 5.55959C8.6004 6.13133 8.1624 6.58557 7.611 6.82239C7.1976 7 6.6734 7 5.625 7H3.375C2.3266 7 1.8024 7 1.389 6.82239C0.8376 6.58557 0.3996 6.13133 0.1713 5.55959C-5.96046e-08 5.1308 0 4.5872 0 3.5Z"
        fill="currentColor"
      />
    </svg>

    <svg
      x="13"
      y="11"
      width="9"
      height="11"
      viewBox="0 0 9 11"
      preserveAspectRatio="none"
    >
      <path
        d="M0 4.4C0 2.3258 4.17233e-07 1.2887 0.659 0.6444C1.318 -3.57628e-07 2.3787 0 4.5 0C6.6213 0 7.682 -3.57628e-07 8.341 0.6444C9 1.2887 9 2.3258 9 4.4V6.6C9 8.6742 9 9.7113 8.341 10.3556C7.682 11 6.6213 11 4.5 11C2.3787 11 1.318 11 0.659 10.3556C4.17233e-07 9.7113 0 8.6742 0 6.6V4.4Z"
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
