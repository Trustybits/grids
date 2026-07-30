<!--
  PreviewMobileIcon.vue — Figma `grids_previewMobile` (525:18380)

  Mobile 2.0 preview toolbar. A filled phone; `fill-rule: evenodd` cuts both the
  notch and the home indicator back out of the body. Figma's exported 16x20 leaf
  (portrait, so it is inset horizontally where the other two are inset
  vertically), nested at the inset Figma placed it on inside the 24x24 box, with
  `currentColor` in place of Figma's white at 76% opacity so the icon follows the
  button's color token in both themes.

  Distinct from `DeviceMobileIcon`, which is the outlined glyph the desktop
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
      x="4"
      y="2"
      width="16"
      height="20"
      viewBox="0 0 16 20"
      preserveAspectRatio="none"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M16 7.80145V11.8676C16 15.7013 16 17.6181 14.8284 18.809C13.6569 20 11.7712 20 8 20C4.22876 20 2.34315 20 1.17157 18.809C-1.19209e-07 17.6181 0 15.7013 0 11.8676V7.80145C0 3.96782 -1.19209e-07 2.051 1.17157 0.860051C1.54739 0.478011 1.99669 0.218521 2.55813 0.0422812C2.91142 -0.0686288 3.28557 0.0893312 3.5 0.392651C3.55391 0.474851 3.60506 0.553041 3.65377 0.627511C4.28829 1.59749 4.50937 1.93544 5.02215 2.25936C5.13195 2.32871 5.24604 2.39078 5.36371 2.44518C5.95547 2.71873 6.637 2.71873 8 2.71873C9.363 2.71873 10.0445 2.71873 10.6363 2.44518C10.754 2.39078 10.8681 2.32871 10.9778 2.25936C11.4906 1.93544 11.7117 1.59749 12.3462 0.627521C12.3949 0.553051 12.4461 0.474851 12.5 0.392651C12.6992 0.0883512 13.0639 -0.0735586 13.4105 0.0325614C13.9866 0.208951 14.4456 0.470931 14.8284 0.860051C16 2.051 16 3.96782 16 7.80145ZM5 16.2294C4.58579 16.2294 4.25 16.567 4.25 16.9835C4.25 17.4 4.58579 17.7376 5 17.7376H11C11.4142 17.7376 11.75 17.4 11.75 16.9835C11.75 16.567 11.4142 16.2294 11 16.2294H5Z"
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
