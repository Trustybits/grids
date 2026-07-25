import {
  watch,
  computed,
  nextTick,
  onUnmounted,
  inject,
  onMounted,
  type Ref,
} from "vue";
import type { Editor } from "@tiptap/vue-3";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridController } from "@/controllers/useGridController";

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

  const uiStore = useGridUiStore();
  const controller = useGridController();
  const canEdit = computed(() => controller.canEditCurrentGrid());
  const tileId = inject<string | null>("tileId", null);

  // ── Edit mode watcher ──────────────────────────────────────
  watch(
    [() => canEdit.value, () => isEditing.value],
    ([canEdit, editing]) => {
      if (!editor?.value) return;

      const shouldBeEditable = canEdit && editing;
      editor.value.setEditable(shouldBeEditable);

      if (shouldBeEditable) {
        onEnter?.();
        editor.value.commands.focus("end");
        nextTick(() => {
          flushPersist();
          if (tileId) controller.beginEditing(tileId);
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
      controller.commitEditing();
    },
  );

  // ── Auto-focus on mount ────────────────────────────────────
  onMounted(() => {
    if (
      tileId &&
      canEdit.value &&
      uiStore.consumePendingFocus(tileId)
    ) {
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
