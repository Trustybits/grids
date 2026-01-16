<template>
  <div class="link-tile-content">
    <div v-if="content.metaImageUrl" class="tile-preview">
      <img :src="content.metaImageUrl" :alt="content.metaTitle || content.domain" />
    </div>

    <div class="tile-logo">
      <img :src="content.faviconUrl" :alt="content.domain" />
    </div>

    <div class="tile-text">
      <p class="tile-title">{{ content.metaTitle || content.metaSiteName || content.domain || 'Link' }}</p>
      <p v-if="content.metaDescription" class="tile-description">{{ content.metaDescription }}</p>
      <p class="tile-subtitle">{{ formatLink(content.link) }}</p>
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
}

.tile-preview {
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.tile-preview img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}
</style>