<template>
  <div class="embed-wrapper">
    <iframe
      class="embed-frame"
      scrolling="no"
      :src="content.src"
      frameborder="no"
      loading="lazy"
      allowfullscreen="true"
    >
      embedded content
    </iframe>
  </div>
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

<style scoped lang="scss">
.embed-wrapper {
  width: 100%;
  height: 100%;
  border-radius: var(--tile-border-radius);
  overflow: hidden;
  position: relative;
}

.embed-frame {
  width: 100%;
  height: 100%;
  border: none;
  position: relative;
  z-index: 0;
  cursor: default;
  pointer-events: all;
}
</style>
