<template>
  <div class="embed-wrapper">
    <img v-if="isDirectImage" class="embed-media" :src="content.src" alt="Embedded image" />

    <video v-else-if="isDirectVideo" class="embed-media" :src="content.src" controls />

    <template v-else>
      <iframe
        class="embed-frame"
        :class="{ 'non-interactive': canEdit && !isEmbedInteractive }"
        :src="content.src"
        frameborder="no"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen="true"
      >
        embedded content
      </iframe>

      <!-- Hover overlay: owner-only, shown when embed is NOT interactive.
           Sits above the iframe so pointer events bubble to tile-wrapper for dragging. -->
      <div
        v-if="canEdit && !isEmbedInteractive"
        class="embed-interact-overlay"
      >
        <button
          class="embed-interact-btn"
          @mousedown.stop
          @click.stop="isEmbedInteractive = true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 15l-2 5L9 9l11 4-5 2z"/><path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M3 19a2 2 0 0 0 2 2"/><path d="M5 3h4"/><path d="M15 3h4"/><path d="M3 9v4"/><path d="M21 5v4"/><path d="M3 15v4"/></svg>
          Interact
        </button>
      </div>

    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, inject, ref, type Ref } from "vue";
import { type EmbedContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  props: {
    content: {
      type: Object as () => EmbedContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const canEdit = computed(() => layoutStore.canEdit);

    const tileActivated = inject<Ref<boolean>>("tileActivated", ref(false));

    const isEmbedInteractive = inject<Ref<boolean>>("isEmbedInteractive", ref(false));

    const isDirectImage = computed(() => {
      const src = props.content.src;
      if (!src) return false;

      try {
        const url = new URL(src);
        const pathname = url.pathname.toLowerCase();
        return (
          pathname.endsWith(".png") ||
          pathname.endsWith(".jpg") ||
          pathname.endsWith(".jpeg") ||
          pathname.endsWith(".gif") ||
          pathname.endsWith(".webp") ||
          pathname.endsWith(".bmp") ||
          pathname.endsWith(".svg")
        );
      } catch {
        const lower = src.toLowerCase();
        return (
          lower.includes(".png") ||
          lower.includes(".jpg") ||
          lower.includes(".jpeg") ||
          lower.includes(".gif") ||
          lower.includes(".webp") ||
          lower.includes(".bmp") ||
          lower.includes(".svg")
        );
      }
    });

    const isDirectVideo = computed(() => {
      const src = props.content.src;
      if (!src) return false;

      try {
        const url = new URL(src);
        const pathname = url.pathname.toLowerCase();
        return (
          pathname.endsWith(".mp4") ||
          pathname.endsWith(".webm") ||
          pathname.endsWith(".mov")
        );
      } catch {
        const lower = src.toLowerCase();
        return lower.includes(".mp4") || lower.includes(".webm") || lower.includes(".mov");
      }
    });

    return {
      canEdit,
      tileActivated,
      isEmbedInteractive,
      isDirectImage,
      isDirectVideo,
    };
  },
});
</script>

<style scoped lang="scss">
.embed-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.embed-media {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.embed-frame {
  width: 100%;
  height: 100%;
  border: none;
  position: relative;
  z-index: 0;
  cursor: default;
  pointer-events: all;
  transition: filter 0.2s ease;
  /* Chromium UA stylesheet uses `overflow: clip !important` on iframe; author
     rules must be !important or scrolling inside nested documents is blocked. */
  overflow: auto !important;
  /* Hides scrollbars only for overflow on this iframe element. Cross-origin
     pages usually scroll their own document; those scrollbars cannot be styled
     from Grids (same-origin policy)—the embedded app must hide them. */
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
  &::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }

  &.non-interactive {
    pointer-events: none;
  }
}

/* Overlay that captures pointer events for dragging when embed is non-interactive.
   Visible on hover (desktop) or when tile is activated (mobile). */
.embed-interact-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.2s ease;

  &:active {
    cursor: grabbing;
  }
}

/* Desktop: show overlay on hover */
.embed-wrapper:hover .embed-interact-overlay {
  opacity: 1;
}

.embed-interact-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  pointer-events: auto;
  transition: background 0.15s ease, transform 0.15s ease;
  user-select: none;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: scale(1.04);
  }

  &:active {
    transform: scale(0.97);
  }
}

</style>
