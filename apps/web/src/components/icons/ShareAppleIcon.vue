<!--
  ShareAppleIcon.vue — Figma `grids_shareApple` (401:3203)

  The share glyph for Apple platforms: the tray with an arrow rising out of it
  that iOS, iPadOS and macOS use for their share sheet. Everything else gets
  ShareDefaultIcon (the three-node graph); MobileGridBar picks between them.

  Two of Figma's exported paths — the arrow, then the tray — nested at the insets
  Figma placed them on inside the 24x24 box. `currentColor` in place of Figma's
  white at 76% opacity, so the icon follows the button's color token in both
  themes.
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
      x="8.25"
      y="1.25"
      width="7.5"
      height="14.5"
      viewBox="0 0 7.50002 14.5"
      preserveAspectRatio="none"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M3.75001 14.5C4.16421 14.5 4.50001 14.1642 4.50001 13.75V2.77744L6.18061 4.73809C6.45011 5.05259 6.92361 5.08901 7.23811 4.81944C7.55261 4.54988 7.58901 4.0764 7.31941 3.76191L4.31941 0.26191C4.17701 0.09567 3.96891 0 3.75001 0C3.53111 0 3.32301 0.09567 3.18061 0.26191L0.180574 3.76191C-0.0889962 4.0764 -0.0525759 4.54988 0.261924 4.81944C0.576414 5.08901 1.04989 5.05259 1.31945 4.73809L3.00001 2.77744V13.75C3.00001 14.1642 3.33581 14.5 3.75001 14.5Z"
        fill="currentColor"
      />
    </svg>

    <svg
      x="2"
      y="9"
      width="20"
      height="13"
      viewBox="0 0 20 12.9998"
      preserveAspectRatio="none"
    >
      <path
        d="M14 0C13.2978 0 12.9467 4.32134e-07 12.6945 0.16851C12.5853 0.24148 12.4915 0.33525 12.4186 0.44446C12.25 0.69667 12.25 1.0478 12.25 1.75V6C12.25 7.2426 11.2427 8.25 10 8.25C8.7574 8.25 7.75004 7.2426 7.75004 6V1.75C7.75004 1.0478 7.75004 0.69664 7.58149 0.4444C7.50854 0.33523 7.41481 0.2415 7.30564 0.16855C7.05341 -4.61936e-07 6.70227 0 6 0C3.17157 0 1.75736 2.38419e-07 0.87868 0.87868C0 1.7574 0 3.1714 0 5.9998V6.9998C0 9.8282 0 11.2424 0.87868 12.1211C1.75736 12.9998 3.17157 12.9998 6 12.9998H14C16.8284 12.9998 18.2426 12.9998 19.1213 12.1211C20 11.2424 20 9.8282 20 6.9998V5.9998C20 3.1714 20 1.7574 19.1213 0.87868C18.2426 2.38419e-07 16.8284 0 14 0Z"
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
