<!--
  MobileTileDragGhost.vue

  The card a user has pulled up out of the Add-a-Tile carousel, drawn above
  everything while it is carried to the grid. Purely presentational: every
  number it renders (position, size, corner radius, opacity) is driven frame by
  frame from useTileDragToAdd, which is why nothing here transitions. While it
  is on the finger it is drawn completely still — its artwork loop only plays
  once it has been let go.

  Over the grid it takes the held cell's size and the tile's corner radius and
  drops the carousel stroke — it is drawn as the tile it is about to become.
  The artwork inside scales with it, since MobileTileThumbnail sizes itself
  from its box.
-->
<template>
  <div
    class="mtdg"
    :class="{ 'mtdg--tile': ghost.overGrid }"
    :style="style"
    aria-hidden="true"
  >
    <span class="mtdg__ink">
      <MobileTileThumbnail
        :type-id="ghost.typeId"
        :icon="icon"
        :active="!ghost.carried"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
import MobileTileThumbnail from "@/components/app/MobileTileThumbnail.vue";
import type { TileDragGhost } from "@/composables/useTileDragToAdd";

const props = defineProps<{
  ghost: TileDragGhost;
  icon: Component;
}>();

const style = computed(() => ({
  width: `${props.ghost.size}px`,
  height: `${props.ghost.size}px`,
  borderRadius: `${props.ghost.radius}px`,
  opacity: String(props.ghost.opacity),
  transform: `translate3d(${props.ghost.x}px, ${props.ghost.y}px, 0)`,
}));
</script>

<style lang="scss" scoped>
.mtdg {
  position: fixed;
  top: 0;
  left: 0;
  // Above the command bar and its sheets: the card is in the user's hand.
  z-index: 2000;
  overflow: hidden;
  background: var(--color-tile-background);
  color: var(--color-text-primary);
  // Same inset-stroke-plus-shadow surface as the carousel card, lifted: the
  // shadow is deeper because the card is now off the fan and over the page.
  box-shadow:
    inset 0 0 0 var(--border-width) var(--color-stroke),
    0 18px 40px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  will-change: transform, width, height;
}

// Over a cell it is a tile, not a card: tiles carry no stroke, and the shadow
// tightens as it comes down towards the grid.
.mtdg--tile {
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
}

.mtdg__ink {
  position: absolute;
  inset: 0;
}
</style>
