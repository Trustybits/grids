<template>
  <div class="link-tile-content">
    <div v-if="content.metaImageUrl" class="tile-background" aria-hidden="true">
      <img
        class="tile-background-image"
        :src="content.metaImageUrl"
        :alt="content.metaTitle || content.domain"
      />
      <div class="tile-background-overlay"></div>
    </div>

    <div class="tile-foreground">
      <div class="tile-logo">
        <img :src="content.faviconUrl" :alt="content.domain" />
      </div>

      <div class="tile-text">
        <p class="tile-title">{{ content.metaTitle || content.metaSiteName || content.domain || 'Link' }}</p>
        <p v-if="content.metaDescription" class="tile-description">{{ content.metaDescription }}</p>
        <p class="tile-subtitle">{{ formatLink(content.link) }}</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { type LinkContent } from "@/types/TileContent";

export default defineComponent({
  props: {
    content: {
      type: Object as () => LinkContent,
      required: true,
    },
  },
  setup(props) {
    const formatLink = (link: string) => {
      if (!link) return '@handle or address';
      
      if (link.startsWith('http://') || link.startsWith('https://')) {
        try {
          const url = new URL(link);
          return `@${url.hostname.replace('www.', '')}`;
        } catch {
          return `@${link}`;
        }
      }
      
      return link.startsWith('@') ? link : `@${link}`;
    };

    const onShortClick = () => {
      const url = props.content.link.startsWith("http")
        ? props.content.link
        : `https://${props.content.link}`;
      window.open(url, "_blank");
    };

    return {
      formatLink,
      onShortClick
    }
  },
});
</script>

<style scoped>
.link-tile-content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: var(--tile-padding);
  position: relative;
}

.tile-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.tile-background-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.tile-background-overlay {
  position: absolute;
  inset: 0;
  /*
    Keeps link tile text readable on top of busy images.
    Two layers:
    - bottom-up fade into the theme's content background
    - subtle overall wash (matches the Figma example's white @ 34%)
  */
  background-image:
    linear-gradient(
      180deg,
      transparent 21%,
      color-mix(in srgb, var(--color-tile-background) 76%, transparent) 76%,
      var(--color-tile-background) 100%
    ),
    linear-gradient(90deg, color-mix(in srgb, var(--color-tile-background) 34%, transparent) 0%, color-mix(in srgb, var(--color-tile-background) 34%, transparent) 100%);
}

.tile-foreground {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  height: 100%;
}
</style>