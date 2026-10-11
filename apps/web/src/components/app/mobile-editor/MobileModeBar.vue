<!--
  MobileModeBar.vue

  What the tile toolbar morphs into while the tile is in a tool mode (plan
  S6): one line saying what your finger does now, and the way out.

    crop      Drag to reposition · Done
    pan       Drag and pinch the map · Done
    interact  Interacting · Stop
    edit      Editing · Done   (typing in a tile without a format bar:
                                profile, link, documents, classic text)

  Lives in the bottom bar's pill like the toolbar it replaces, so the bar
  morphs rather than swaps.
-->
<template>
  <div
    class="mmb"
    role="toolbar"
    :aria-label="copy.label"
    data-tile-edit-surface
    @mousedown.prevent
  >
    <!-- mousedown.prevent: a tap on the bar must not take focus from the
         field being typed in (that would drop the keyboard). -->
    <MobileToolIcon :name="copy.icon" class="mmb__icon" />
    <span class="mmb__label">{{ copy.label }}</span>
    <button type="button" class="mmb__done" @click="$emit('done')">
      {{ copy.action }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MobileToolIcon from "./MobileToolIcon.vue";
import type { TileToolMode } from "@/composables/useTileToolModes";

export type MobileBarMode = TileToolMode | "edit";

const props = defineProps<{ mode: MobileBarMode }>();

defineEmits<{ done: [] }>();

const COPY: Record<MobileBarMode, { icon: string; label: string; action: string }> = {
  crop: { icon: "crop", label: "Drag to reposition", action: "Done" },
  pan: { icon: "pan", label: "Drag and pinch the map", action: "Done" },
  interact: { icon: "interact", label: "Interacting", action: "Stop" },
  edit: { icon: "edit", label: "Editing", action: "Done" },
};

const copy = computed(() => COPY[props.mode]);
</script>

<style scoped>
.mmb {
  /* Taps act at once: no double-tap zoom wait on our controls. */
  touch-action: manipulation;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  height: 56px;
  padding: 0 8px 0 16px;
  animation: mmb-in var(--duration-morph) var(--easing-snap) both;
}

.mmb__icon {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  color: var(--color-tool-active);
}

.mmb__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mmb__done {
  flex: 0 0 auto;
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 18px;
  background: var(--color-tool-on-bg);
  color: var(--color-tool-active);
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mmb__done:active {
  transform: scale(0.95);
}

@keyframes mmb-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mmb {
    animation: none;
  }
}
</style>
