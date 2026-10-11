<!--
  MobileFormatToolbar.vue

  What the bottom pill becomes while a text tile is being typed in (S5): the
  tile toolbar morphs into this font-styling bar — font, size, bold, italic,
  underline, strike, code, color, alignment, link — with Done to stop typing.
  One bar at a time; it rides on the keyboard with the rest of the pill.

  The controls are the shared `FormatControls` (via the inline docked bar),
  so phone and desktop format the same way. Taps here never count as "outside"
  the tile: the docked bar stops them, and Done ends typing itself.
-->
<template>
  <div class="mft" data-tile-edit-surface>
    <!-- A real box: the docked bar's root is a Teleport, which can't take a
         class, and the controls must be allowed to shrink and scroll. -->
    <div class="mft__controls">
      <DockedFormatBar
        inline
        active
        :editor="editor"
        @edit-link="(href) => emit('edit-link', href)"
      />
    </div>
    <button
      type="button"
      class="mft__done"
      aria-label="Done typing"
      @touchstart.stop
      @pointerdown.stop
      @click.stop="emit('done')"
    >
      <CheckIcon :size="20" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Editor } from "@tiptap/vue-3";
import DockedFormatBar from "@/components/richtext/DockedFormatBar.vue";
import CheckIcon from "@/components/icons/CheckIcon.vue";

defineProps<{ editor: Editor | undefined }>();

const emit = defineEmits<{
  done: [];
  "edit-link": [href: string | null];
}>();
</script>

<style scoped>
.mft {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
  padding: 6px;
  animation: mft-in var(--duration-morph) var(--easing-snap) both;
}

/* Shrinks so the controls scroll sideways inside the pill, but doesn't clip:
   the Font / Size / Color menus open upward, above the bar (the row itself
   scrolls, so nothing spills sideways). */
.mft__controls {
  flex: 1 1 auto;
  min-width: 0;
}

.mft__controls :deep(.rt-docked-bar) {
  min-width: 0;
}

/* The pill is the surface; the docked bar's own card styling would double it. */
.mft :deep(.rt-docked-bar) {
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

.mft__done {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 14px;
  background: var(--color-tool-selected-bg);
  color: var(--color-tool-active);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mft__done:active {
  transform: scale(0.94);
}

@keyframes mft-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mft {
    animation: none;
  }
}
</style>
