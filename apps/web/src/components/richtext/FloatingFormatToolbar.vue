<template>
  <Teleport to="body">
    <div
      v-if="toolbar.visible.value && state && editor"
      ref="rootRef"
      class="rt-format-toolbar"
      role="toolbar"
      aria-label="Text formatting"
      :style="{
        top: `${toolbar.position.value.top}px`,
        left: `${toolbar.position.value.left}px`,
      }"
      @pointerdown.stop
      @click.stop
    >
      <FormatControls
        :editor="editor"
        :state="state"
        menu-placement="below"
        @applied="toolbar.refresh"
        @edit-link="(href) => emit('edit-link', href)"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Desktop formatting toolbar: floats over the selection, or over the caret
 * once typing pauses. Placement and visibility live in useFloatingToolbar;
 * the controls are the shared FormatControls.
 */
import { computed, ref } from "vue";
import type { Editor } from "@tiptap/vue-3";
import { useFloatingToolbar } from "@/composables/useFloatingToolbar";
import FormatControls from "./FormatControls.vue";

const props = defineProps<{
  editor: Editor | undefined;
  /** Edit mode, owner, and a device that gets the floating toolbar. */
  active: boolean;
  /** Another floating surface (slash menu, inline form) is open. */
  suppressed: boolean;
}>();

const emit = defineEmits<{
  /** Open the link editor for the selection; null href when none. */
  "edit-link": [href: string | null];
}>();

const rootRef = ref<HTMLElement | null>(null);

const toolbar = useFloatingToolbar({
  editor: computed(() => props.editor),
  isActive: () => props.active,
  isSuppressed: () => props.suppressed,
  element: rootRef,
});

const state = computed(() => toolbar.formatting.value);

defineExpose({ refresh: toolbar.refresh, visible: toolbar.visible });
</script>

<style scoped>
.rt-format-toolbar {
  position: fixed;
  /* Above the tile toolbar and action bar (10000): editing UI wins. */
  z-index: 10010;
  padding: 4px;
  border-radius: var(--radius-md, 8px);
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  background: var(--color-tile-background);
  color: var(--color-text-primary);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  font-family: "Inter", sans-serif;
  font-size: 13px;
  user-select: none;
  white-space: nowrap;
}
</style>
