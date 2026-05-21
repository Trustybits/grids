import { watch, nextTick, onUnmounted, inject, onMounted, type Ref } from "vue";
import type { Editor } from "@tiptap/vue-3";
import { useGridStore } from "@/stores/grid";

interface EditingLifecycleOptions {
  editor: Ref<Editor | undefined>;
  isEditing: Ref<boolean>;
  containerRef: Ref<HTMLElement | null>;
  flushPersist: () => void;
  onEnter?: () => void;
  onExit?: () => void;
  shouldBlockExit?: () => boolean;
}

export function useEditingLifecycle(options: EditingLifecycleOptions) {
  const {
    editor,
    isEditing,
    containerRef,
    flushPersist,
    onEnter,
    onExit,
    shouldBlockExit,
  } = options;

  const gridStore = useGridStore();
  const tileId = inject<string | null>("tileId", null);

  // ── Edit mode watcher ──────────────────────────────────────
  watch(
    [() => gridStore.canEdit, () => isEditing.value],
    ([canEdit, editing]) => {
      if (!editor?.value) return;

      const shouldBeEditable = canEdit && editing;
      editor.value.setEditable(shouldBeEditable);

      if (shouldBeEditable) {
        onEnter?.();
        editor.value.commands.focus("end");
        nextTick(() => {
          flushPersist();
          if (tileId) gridStore.beginEditing(tileId);
        });
        return;
      }

      editor.value.commands.blur();
      onExit?.();

      if (!canEdit) {
        isEditing.value = false;
        return;
      }

      flushPersist();
      gridStore.commitEditing();
    },
  );

  // ── Auto-focus on mount ────────────────────────────────────
  onMounted(() => {
    if (
      tileId &&
      gridStore.canEdit &&
      gridStore.pendingFocusTileId === tileId
    ) {
      gridStore.pendingFocusTileId = null;
      isEditing.value = true;
    }
  });

  // ── Click-outside handler ──────────────────────────────────
  let exitClickHandler: ((event: MouseEvent) => void) | null = null;

  const removeExitClickHandler = () => {
    if (exitClickHandler) {
      document.removeEventListener("click", exitClickHandler);
      exitClickHandler = null;
    }
  };

  watch(isEditing, (editing) => {
    if (editing) {
      nextTick(() => {
        setTimeout(() => {
          exitClickHandler = (event: MouseEvent) => {
            if (shouldBlockExit?.()) return;
            if (
              containerRef.value &&
              !containerRef.value.contains(event.target as Node)
            ) {
              isEditing.value = false;
            }
          };
          document.addEventListener("click", exitClickHandler);
        }, 0);
      });
    } else {
      removeExitClickHandler();
    }
  });

  onUnmounted(() => {
    removeExitClickHandler();
  });

  return { tileId };
}

export function useEditorContentSync(
  editor: Ref<Editor | undefined>,
  contentGetter: () => string | undefined,
  parseContent?: (text: string) => unknown,
) {
  const parse = parseContent ?? ((text: string) => JSON.parse(text));

  watch(contentGetter, (newText) => {
    if (!editor.value) return;
    if (editor.value.isFocused) return;
    const current = JSON.stringify(editor.value.getJSON());
    if (current === (newText || "")) return;
    const content = newText ? parse(newText) : "";
    editor.value.commands.setContent(content, false);
  });
}
