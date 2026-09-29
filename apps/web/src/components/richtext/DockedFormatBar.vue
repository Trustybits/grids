<template>
  <Teleport to="body" :disabled="inline">
    <div
      v-if="active && state && editor"
      class="rt-docked-bar"
      :class="{ 'rt-docked-bar--fixed': !inline }"
      role="toolbar"
      aria-label="Text formatting"
      :style="inline ? undefined : { bottom: `${keyboardInset + 8}px` }"
      @touchstart.stop
      @pointerdown.stop
      @click.stop
    >
      <FormatControls
        :editor="editor"
        :state="state"
        menu-placement="above"
        scrollable
        @applied="refresh"
        @edit-link="(href) => emit('edit-link', href)"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Touch formatting bar. A floating toolbar over the text would fight the
 * system selection menu and the keyboard on a phone, so formatting docks on
 * top of the keyboard instead. The controls scroll sideways and their menus
 * open upward, away from the keyboard.
 *
 * `inline` renders in place for a host that already sits on the keyboard (the
 * Mobile 2.0 command bar); otherwise the bar positions itself above it.
 *
 * Touch, pointer and click events stop here: a tap on the bar must not read
 * as a tap outside the tile, which would deactivate it or end editing.
 */
import { computed } from "vue";
import type { Editor } from "@tiptap/vue-3";
import { useFormattingState } from "@/composables/useFormattingState";
import { useKeyboardInset } from "@/composables/useKeyboardInset";
import FormatControls from "./FormatControls.vue";

const props = withDefaults(
  defineProps<{
    editor: Editor | undefined;
    /** The text tile is being edited by its owner. */
    active: boolean;
    /** Render in place instead of docking to the keyboard. */
    inline?: boolean;
  }>(),
  { inline: false },
);

const emit = defineEmits<{
  "edit-link": [href: string | null];
}>();

const { keyboardInset } = useKeyboardInset();
const { formatting: state, refresh } = useFormattingState(
  computed(() => props.editor),
  () => props.active,
);
</script>

<style scoped>
.rt-docked-bar {
  box-sizing: border-box;
  width: 100%;
  padding: 4px;
  border-radius: var(--radius-md, 8px);
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  background: var(--color-tile-background);
  color: var(--color-text-primary);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  font-family: "Inter", sans-serif;
  font-size: 13px;
  user-select: none;
  white-space: nowrap;
  pointer-events: auto;
}

.rt-docked-bar--fixed {
  position: fixed;
  left: 8px;
  right: 8px;
  width: auto;
  /* Above the tile toolbar and action bar (10000). */
  z-index: 10010;
}

/* Bigger targets for fingers. */
.rt-docked-bar :deep(.rt-ft-btn) {
  height: 40px;
  min-width: 40px;
}
</style>
