<template>
  <iframe
    style="
      width: 100%;
      height: 100%;
      border-radius: 16px;
      position: relative;
      z-index: 0;
      cursor: default;
      pointer-events: all;
    "
    scrolling="no"
    :src="content.src"
    frameborder="no"
    loading="lazy"
    allowfullscreen="true"
  >
    embedded content
  </iframe>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { type EmbedContent } from "@/types/TileContent";

export default defineComponent({
  props: {
    content: {
      type: Object as () => EmbedContent,
      required: true,
    },
  },
  setup(props) {
    return {};
  },
});
</script>

<style scoped></style>
