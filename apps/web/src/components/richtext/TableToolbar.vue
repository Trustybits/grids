<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="rt-table-toolbar"
      role="toolbar"
      aria-label="Table"
      :style="{ top: `${position.top}px`, left: `${position.left}px` }"
      @mousedown.prevent
    >
      <div class="rt-table-group">
        <span class="rt-table-group-label">Col</span>
        <button type="button" class="rt-table-btn" title="Insert column before" @click="run((c) => c.addColumnBefore())">+ Left</button>
        <button type="button" class="rt-table-btn" title="Insert column after" @click="run((c) => c.addColumnAfter())">+ Right</button>
        <button type="button" class="rt-table-btn rt-table-btn--danger" title="Delete column" @click="run((c) => c.deleteColumn())">&times;</button>
      </div>
      <span class="rt-table-sep" />
      <div class="rt-table-group">
        <span class="rt-table-group-label">Row</span>
        <button type="button" class="rt-table-btn" title="Insert row above" @click="run((c) => c.addRowBefore())">+ Above</button>
        <button type="button" class="rt-table-btn" title="Insert row below" @click="run((c) => c.addRowAfter())">+ Below</button>
        <button type="button" class="rt-table-btn rt-table-btn--danger" title="Delete row" @click="run((c) => c.deleteRow())">&times;</button>
      </div>
      <span class="rt-table-sep" />
      <div class="rt-table-group">
        <button type="button" class="rt-table-btn" title="Merge or split selected cells" @click="run((c) => c.mergeOrSplit())">Merge / Split</button>
        <button type="button" class="rt-table-btn" title="Toggle header row" @click="run((c) => c.toggleHeaderRow())">H-Row</button>
        <button type="button" class="rt-table-btn" title="Toggle header column" @click="run((c) => c.toggleHeaderColumn())">H-Col</button>
      </div>
      <span class="rt-table-sep" />
      <button type="button" class="rt-table-btn rt-table-btn--danger" title="Delete entire table" @click="run((c) => c.deleteTable())">Delete Table</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { ChainedCommands, Editor } from "@tiptap/vue-3";
import type { FloatingPosition } from "@/composables/useSlashMenu";

const props = defineProps<{
  editor: Editor | undefined;
  /** Toolbar only shows while the host editor is in edit mode. */
  active: boolean;
}>();

const emit = defineEmits<{ changed: [] }>();

const TOOLBAR_HEIGHT = 36;
const TOOLBAR_MAX_WIDTH = 640;
const PADDING = 8;

const visible = ref(false);
const position = ref<FloatingPosition>({ top: 0, left: 0 });

/** The <table> element around the selection, if the selection is in one. */
const findTableElement = (editor: Editor): HTMLElement | null => {
  if (!editor.isActive("table")) return null;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name !== "table") continue;
    const dom = editor.view.nodeDOM($from.before(depth));
    if (!(dom instanceof HTMLElement)) return null;
    return dom.tagName === "TABLE" ? dom : dom.querySelector("table");
  }
  return null;
};

const update = () => {
  const editor = props.editor;
  const table = editor && props.active ? findTableElement(editor) : null;
  if (!table) {
    visible.value = false;
    return;
  }
  const rect = table.getBoundingClientRect();
  let top = rect.top - TOOLBAR_HEIGHT - 4;
  if (top < PADDING) top = rect.bottom + 4;
  const left = Math.max(
    PADDING,
    Math.min(rect.left, window.innerWidth - TOOLBAR_MAX_WIDTH - PADDING),
  );
  position.value = { top, left };
  visible.value = true;
};

watch(
  () => [props.editor, props.active] as const,
  ([editor], _prev, onCleanup) => {
    update();
    if (!editor) return;
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    onCleanup(() => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    });
  },
  { immediate: true },
);

const run = (command: (chain: ChainedCommands) => ChainedCommands) => {
  if (!props.editor) return;
  command(props.editor.chain().focus()).run();
  emit("changed");
};
</script>

<style scoped>
.rt-table-toolbar {
  position: fixed;
  z-index: 9999;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
  max-width: 640px;
  padding: 4px 6px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-tile-stroke, rgba(255, 255, 255, 0.12));
  background: var(--color-tile-background, #1e1e1e);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
}

.rt-table-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.rt-table-group-label {
  padding: 0 4px 0 2px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  user-select: none;
}

.rt-table-sep {
  flex-shrink: 0;
  width: 1px;
  height: 20px;
  margin: 0 3px;
  background: rgba(255, 255, 255, 0.1);
}

.rt-table-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.rt-table-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.rt-table-btn--danger {
  color: rgba(255, 255, 255, 0.55);
}

.rt-table-btn--danger:hover {
  background: rgba(255, 80, 80, 0.18);
  color: #ff6b6b;
}
</style>
