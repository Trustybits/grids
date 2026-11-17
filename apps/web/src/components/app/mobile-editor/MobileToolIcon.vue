<!--
  MobileToolIcon.vue

  A phone-toolbar icon from the Figma tool set (`assets/mobile-toolbar/*.svg`,
  exported unchanged). Drawn as a CSS mask filled with `currentColor`, so one
  asset serves every tool state (default / selected / on / danger) and theme —
  the same thing Figma's "Tool state" variable modes do to the icons.

  Font is the exception: its icon is the "Aa" text glyph, as in Figma.
-->
<template>
  <span
    v-if="name === 'font'"
    class="mti mti--glyph"
    aria-hidden="true"
  >Aa</span>
  <span
    v-else
    class="mti"
    :style="{ '--mti-src': `url(&quot;${src}&quot;)` }"
    aria-hidden="true"
  ></span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  /** File name without `.svg` (e.g. "border", "map-style"), or "font". */
  name: string;
}>();

// Relative on purpose: glob patterns don't go through the `@` alias.
const ICONS = import.meta.glob<string>("../../../assets/mobile-toolbar/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

const byName: Record<string, string> = Object.fromEntries(
  Object.entries(ICONS).map(([path, url]) => [
    path.replace(/^.*\/([^/]+)\.svg$/, "$1"),
    url,
  ]),
);

const src = computed(() => byName[props.name] ?? "");
</script>

<style scoped>
/* 21px, the Figma tool icon size. */
.mti {
  display: inline-block;
  flex: 0 0 auto;
  width: 21px;
  height: 21px;
  background-color: currentColor;
  -webkit-mask: var(--mti-src) center / contain no-repeat;
  mask: var(--mti-src) center / contain no-repeat;
}

.mti--glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  -webkit-mask: none;
  mask: none;
  font-family: "Inter", sans-serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  color: currentColor;
}
</style>
