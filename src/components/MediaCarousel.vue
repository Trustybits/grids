<template>
  <div
    class="media-carousel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
  >
    <!-- Departing card: fades out on top of everything during transition -->
    <div
      v-if="departingItem"
      class="carousel-card carousel-card--departing"
      :style="departingStyle"
    >
      <img
        v-if="departingItem.type === 'image' || !departingItem.type"
        :src="departingItem.src"
        :alt="departingItem.alt || ''"
        class="carousel-media"
        draggable="false"
      />
      <video
        v-else-if="departingItem.type === 'video'"
        :src="departingItem.src"
        :poster="departingItem.poster"
        class="carousel-media"
        muted
        loop
        playsinline
        draggable="false"
      />
    </div>

    <!-- Stacked cards: render in reverse so the active card is on top -->
    <div
      v-for="offset in visibleOffsets"
      :key="'card-' + wrapIndex(activeIndex + offset)"
      class="carousel-card"
      :class="{ 'carousel-card--active': offset === 0 }"
      :style="cardStyle(offset)"
    >
      <!-- Image -->
      <img
        v-if="itemAt(offset).type === 'image' || !itemAt(offset).type"
        :src="itemAt(offset).src"
        :alt="itemAt(offset).alt || ''"
        class="carousel-media"
        draggable="false"
      />
      <!-- Video -->
      <video
        v-else-if="itemAt(offset).type === 'video'"
        :src="itemAt(offset).src"
        :poster="itemAt(offset).poster"
        class="carousel-media"
        muted
        loop
        playsinline
        :autoplay="offset === 0 && autoplayVideo"
        draggable="false"
      />
      <!-- Label overlay (only on the front card) -->
      <div
        v-if="offset === 0 && itemAt(0).label"
        class="carousel-label"
      >
        <span>{{ itemAt(0).label }}</span>
      </div>
    </div>

    <!-- Dot indicators -->
    <div v-if="showDots && items.length > 1" class="carousel-dots">
      <button
        v-for="(item, i) in items"
        :key="'dot-' + i"
        class="carousel-dot"
        :class="{ 'carousel-dot--active': i === activeIndex }"
        @click.stop="goTo(i)"
        :aria-label="'Go to slide ' + (i + 1)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, watch, nextTick, type PropType } from "vue";

export interface MediaCarouselItem {
  id: string;
  src: string;
  type?: "image" | "video" | "gif";
  poster?: string;
  alt?: string;
  label?: string;
  onClick?: () => void;
}

const FADE_DURATION = 500; // ms — matches CSS transition on .carousel-card--departing

export default defineComponent({
  name: "MediaCarousel",
  props: {
    items: {
      type: Array as PropType<MediaCarouselItem[]>,
      required: true,
    },
    /** Auto-advance interval in ms. 0 = disabled. */
    interval: {
      type: Number,
      default: 4000,
    },
    /** Max number of stacked cards visible behind the active one */
    maxVisibleBehind: {
      type: Number,
      default: 5,
    },
    /** Show dot indicators */
    showDots: {
      type: Boolean,
      default: true,
    },
    /** Auto-play video when it's the active card */
    autoplayVideo: {
      type: Boolean,
      default: true,
    },
    /** Pause auto-advance on hover */
    pauseOnHover: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["change"],
  setup(props, { emit }) {
    const activeIndex = ref(0);
    let autoTimer: ReturnType<typeof setInterval> | null = null;
    let isPaused = false;

    // Departing card state: holds the item that is fading out
    const departingItem = ref<MediaCarouselItem | null>(null);
    const departingPhase = ref<"visible" | "fading">("visible");
    let departingTimeout: ReturnType<typeof setTimeout> | null = null;
    let isTransitioning = false;

    // Swipe tracking
    const pointerStartX = ref(0);
    const pointerStartY = ref(0);
    const isDragging = ref(false);
    const SWIPE_THRESHOLD = 30;

    const itemCount = computed(() => props.items.length);

    // How many cards behind the active one to render (capped by available items)
    const behindCount = computed(() =>
      Math.min(props.maxVisibleBehind, itemCount.value - 1),
    );

    // Array of offsets: [behindCount, behindCount-1, ..., 1, 0]
    // Rendered in this order so offset=0 (active) is painted last (on top).
    const visibleOffsets = computed(() => {
      const offsets: number[] = [];
      for (let i = behindCount.value; i >= 0; i--) {
        offsets.push(i);
      }
      return offsets;
    });

    function wrapIndex(i: number): number {
      const len = itemCount.value;
      return ((i % len) + len) % len;
    }

    // Helper to get item at a given stack offset from activeIndex
    // offset=0 is the front card (activeIndex), offset=1 is the NEXT item, etc.
    function itemAt(offset: number): MediaCarouselItem {
      return props.items[wrapIndex(activeIndex.value + offset)];
    }

    // Advance with departing fade-out effect
    function advanceTo(newIndex: number) {
      if (isTransitioning || itemCount.value <= 1) return;
      if (newIndex === activeIndex.value) return;

      isTransitioning = true;

      // Capture the current front card as the departing card
      departingItem.value = { ...props.items[activeIndex.value] };
      departingPhase.value = "visible";

      // Move the active index immediately — the stack behind shifts forward
      activeIndex.value = wrapIndex(newIndex);
      emit("change", activeIndex.value);

      // On next frame, trigger the fade-out on the departing card
      nextTick(() => {
        requestAnimationFrame(() => {
          departingPhase.value = "fading";
        });
      });

      // Clean up the departing card after the CSS transition completes
      if (departingTimeout) clearTimeout(departingTimeout);
      departingTimeout = setTimeout(() => {
        departingItem.value = null;
        departingPhase.value = "visible";
        isTransitioning = false;
      }, FADE_DURATION);
    }

    function next() {
      advanceTo(activeIndex.value + 1);
    }

    function prev() {
      advanceTo(activeIndex.value - 1);
    }

    function goTo(index: number) {
      advanceTo(index);
      restartTimer();
    }

    // Style for the departing (fading-out) card
    const departingStyle = computed(() => {
      const z = behindCount.value + 2; // above everything
      if (departingPhase.value === "visible") {
        return {
          zIndex: z,
          opacity: 1,
          transform: "translate(0, 0) scale(1)",
        };
      }
      // Fading phase: fade out and scale down slightly
      return {
        zIndex: z,
        opacity: 0,
        transform: "translate(0, 0) scale(0.97)",
      };
    });

    // Card style based on its offset from the active card
    function cardStyle(offset: number) {
      if (offset === 0) {
        return {
          zIndex: behindCount.value + 1,
          transform: "translate(0, 0) scale(1)",
          opacity: 1,
        };
      }

      // Each card behind shifts right and up, gets smaller, and more transparent
      const shiftX = offset * 10;  // px right
      const shiftY = offset * -6;  // px up
      const scale = 1 - offset * 0.03;
      // Opacity decreases more steeply for cards further back
      const opacity = Math.max(0.1, 1 - offset * 0.22);

      return {
        zIndex: behindCount.value + 1 - offset,
        transform: `translate(${shiftX}px, ${shiftY}px) scale(${scale})`,
        opacity,
      };
    }

    // Auto-advance
    function startTimer() {
      stopTimer();
      if (props.interval > 0 && itemCount.value > 1) {
        autoTimer = setInterval(() => {
          if (!isPaused && !isTransitioning) next();
        }, props.interval);
      }
    }

    function stopTimer() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    function restartTimer() {
      stopTimer();
      startTimer();
    }

    // Pointer / swipe handlers
    function onPointerDown(e: PointerEvent) {
      pointerStartX.value = e.clientX;
      pointerStartY.value = e.clientY;
      isDragging.value = true;
      if (props.pauseOnHover) isPaused = true;
    }

    function onPointerMove(_e: PointerEvent) {
      // Could add drag visual feedback here
    }

    function onPointerUp(e: PointerEvent) {
      if (!isDragging.value) return;
      isDragging.value = false;
      if (props.pauseOnHover) isPaused = false;

      const dx = e.clientX - pointerStartX.value;
      const dy = e.clientY - pointerStartY.value;

      // Only count horizontal swipes (ignore vertical scrolls)
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          next();
        } else {
          prev();
        }
        restartTimer();
      } else if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        // Tap — fire onClick on active item
        const active = props.items[activeIndex.value];
        if (active?.onClick) active.onClick();
      }
    }

    watch(() => props.items.length, () => {
      if (activeIndex.value >= props.items.length) {
        activeIndex.value = 0;
      }
      restartTimer();
    });

    onMounted(() => {
      startTimer();
    });

    onUnmounted(() => {
      stopTimer();
      if (departingTimeout) clearTimeout(departingTimeout);
    });

    return {
      activeIndex,
      visibleOffsets,
      wrapIndex,
      itemAt,
      cardStyle,
      departingItem,
      departingStyle,
      next,
      prev,
      goTo,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    };
  },
});
</script>

<style scoped lang="scss">
.media-carousel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  touch-action: pan-y;
  user-select: none;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.carousel-card {
  position: absolute;
  bottom: 0;
  left: 0;
  width: calc(100% - 20px);
  height: calc(100% - 20px);
  border-radius: var(--radius-sm, 8px);
  overflow: hidden;
  transition:
    transform 400ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 400ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
  transform-origin: bottom left;
  will-change: transform, opacity;
  pointer-events: none;

  &--active {
    pointer-events: auto;
  }

  &--departing {
    pointer-events: none;
    transition:
      opacity 500ms ease-out,
      transform 500ms ease-out;
  }
}

.carousel-media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.carousel-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.carousel-dots {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 5px;
  z-index: 100;
  padding: 3px 6px;
  border-radius: var(--radius-full, 9999px);
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
}

.carousel-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: background var(--duration-fast, 150ms) ease, transform var(--duration-fast, 150ms) ease;

  &--active {
    background: #fff;
    transform: scale(1.25);
  }

  &:hover:not(&--active) {
    background: rgba(255, 255, 255, 0.7);
  }
}
</style>
