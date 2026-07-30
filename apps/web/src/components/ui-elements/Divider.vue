<!-- eslint-disable vue/multi-word-component-names -->
<!--
  Divider.vue

  The one hairline used to separate content, in either orientation. It fills the
  space it is given and is held back `--divider-inset` from each end, so its
  length follows its container instead of being restated per site — a vertical
  divider in a 40px-tall command pill lands at 16px, and the same rule gives a
  horizontal divider its side inset inside a sheet.

  Decorative by default: these separate content visually, and a screen reader
  reaching one has already been given the structure by the surrounding markup.
  Pass `semantic` where the split carries meaning a reader would otherwise miss.

  The divider owns its thickness, color, and end inset. The gap *around* it is
  layout: horizontal dividers keep a default block rhythm callers can override,
  and vertical ones take their side spacing from the flex `gap` of the row they
  sit in.
-->
<template>
  <div
    class="divider"
    :class="`divider--${orientation}`"
    :role="semantic ? 'separator' : undefined"
    :aria-orientation="semantic ? orientation : undefined"
    :aria-hidden="semantic ? undefined : 'true'"
  ></div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    orientation?: "horizontal" | "vertical";
    /** Expose the divider to assistive tech as a real separator. */
    semantic?: boolean;
  }>(),
  {
    orientation: "horizontal",
    semantic: false,
  },
);
</script>

<style lang="scss" scoped>
.divider {
  flex: 0 0 auto;
  background-color: var(--color-divider);
}

.divider--horizontal {
  height: var(--border-width);
  margin: var(--spacing-xs) var(--divider-inset);
}

// `align-self` overrides a centering parent, which is what lets the divider
// take its length from the row rather than declaring one.
.divider--vertical {
  width: var(--border-width);
  align-self: stretch;
  margin-top: var(--divider-inset);
  margin-bottom: var(--divider-inset);
}
</style>
