<template>
  <div
    class="link-tile-content"
    :class="{ 'is-wide-1-high': isWideOneHigh, 'is-tall-1-wide': isTallOneWide }"
    :style="{ '--link-title-lines': String(titleLineClamp) }"
  >
    <div v-if="content.metaImageUrl" class="tile-background" aria-hidden="true">
      <img
        class="tile-background-image"
        :src="content.metaImageUrl"
        :alt="content.metaTitle || content.domain"
      />
      <div class="tile-background-overlay"></div>
    </div>

    <div class="tile-foreground">
      <div class="tile-header">
        <div class="tile-logo">
          <img :src="content.faviconUrl" :alt="content.domain" />
        </div>

        <p v-if="isWideOneHigh" class="tile-title tile-title--wide">
          {{ content.metaTitle || content.metaSiteName || content.domain || 'Link' }}
        </p>

        <div v-if="!isTallOneWide" class="tile-link-indicator" aria-hidden="true">
          <svg
            class="tile-link-indicator-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 17L17 7"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M10 7H17V14"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>

      <div v-if="isTallOneWide" class="tile-link-indicator tile-link-indicator--bottom" aria-hidden="true">
        <svg
          class="tile-link-indicator-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 17L17 7"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M10 7H17V14"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div v-if="!isWideOneHigh && !isTallOneWide" class="tile-text">
        <p class="tile-title">{{ content.metaTitle || content.metaSiteName || content.domain || 'Link' }}</p>
        <p v-if="content.metaDescription" class="tile-description">{{ content.metaDescription }}</p>
        <p class="tile-subtitle">{{ formatLink(content.link) }}</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, computed, type ComputedRef } from "vue";
import { type LinkContent } from "@/types/TileContent";

export default defineComponent({
  props: {
    content: {
      type: Object as () => LinkContent,
      required: true,
    },
  },
  setup(props) {
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);

    const isWideOneHigh = computed(() => (gridTileW?.value ?? 0) > 1 && (gridTileH?.value ?? 0) === 1);
    const isTallOneWide = computed(() => (gridTileW?.value ?? 0) === 1 && (gridTileH?.value ?? 0) > 1);
    const titleLineClamp = computed(() => ((gridTileH?.value ?? 0) < 3 ? 2 : 3));

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
      onShortClick,
      titleLineClamp,
      isWideOneHigh,
      isTallOneWide,
    }
  },
});
</script>

<style scoped>
.link-tile-content {
  --link-title-lines: 3;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: var(--tile-padding);
  position: relative;
  border-radius: var(--tile-border-radius);
  overflow: hidden;
  isolation: isolate;
  transform: translateZ(0);
}

.tile-background {
  position: absolute;
  inset: -1px;
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
  transform: translateZ(0);
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
    transform: translateZ(0);
}

.tile-foreground {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--spacing-md);
  width: 100%;
  height: 100%;
}

.tile-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
}

.link-tile-content.is-wide-1-high .tile-header {
  align-items: center;
  gap: 12px;
}

.link-tile-content.is-wide-1-high .tile-link-indicator {
  margin-left: auto;
}

.link-tile-content.is-tall-1-wide .tile-foreground {
  gap: 0;
}

.link-tile-content.is-tall-1-wide .tile-link-indicator--bottom {
  margin-top: auto;
  align-self: flex-end;
  width: 100%;
}

.tile-logo {
  width: 32px;
  height: 32px;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.tile-logo img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.tile-link-indicator {
  width: 24px;
  height: 24px;
  color: var(--color-text-primary);
  opacity: 0.21;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
}

.link-tile-content:hover .tile-link-indicator {
  opacity: 1;
}

.tile-link-indicator-icon {
  width: 100%;
  height: 100%;
  display: block;
}

.tile-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tile-title {
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: var(--link-title-lines);
  -webkit-line-clamp: var(--link-title-lines);
}

.tile-title--wide {
  display: block;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  line-clamp: unset;
  -webkit-line-clamp: unset;
}

.tile-description {
  color: var(--color-content-high);
  font-size: 12px;
  line-height: 16px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  -webkit-line-clamp: 2;
}

.tile-subtitle {
  color: var(--color-content-high);
  font-size: 12px;
  line-height: 16px;
  margin: 0;
}
</style>