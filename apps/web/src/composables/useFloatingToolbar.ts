import { computed, nextTick, onUnmounted, ref, shallowRef, watch, type Ref } from "vue";
import type { Editor } from "@tiptap/vue-3";
import { readFormatting, type FormattingState } from "@/utils/richText/formatting";
import type { FloatingPosition } from "@/composables/useSlashMenu";

/** How long typing must pause before the toolbar comes back over a caret. */
export const TYPING_IDLE_MS = 900;
const GAP = 8;
const VIEWPORT_PADDING = 8;
const DEFAULT_SIZE = { width: 420, height: 40 };

interface SelectionRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Centered above the selection, or below it when there is no room above,
 * clamped inside the viewport.
 */
export function placeAboveSelection(
  selection: SelectionRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): FloatingPosition {
  const center = (selection.left + selection.right) / 2;
  let top = selection.top - GAP - size.height;
  if (top < VIEWPORT_PADDING) top = selection.bottom + GAP;
  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(center - size.width / 2, viewport.width - size.width - VIEWPORT_PADDING),
  );
  return {
    top: Math.min(top, viewport.height - size.height - VIEWPORT_PADDING),
    left,
  };
}

interface FloatingToolbarOptions {
  editor: Ref<Editor | undefined>;
  /** Toolbar can only show while this is true (edit mode, owner, desktop). */
  isActive: () => boolean;
  /** Hide while other floating UI (slash menu, inline form) is open. */
  isSuppressed: () => boolean;
  /** The rendered toolbar, measured so it can be centered precisely. */
  element: Ref<HTMLElement | null>;
}

/**
 * State for a Notion-style formatting toolbar: shows over a selection right
 * away, hides while the user types, and returns over the caret once typing
 * pauses. Keeps the current formatting in sync with the selection.
 */
export function useFloatingToolbar(options: FloatingToolbarOptions) {
  const typing = ref(false);
  const position = ref<FloatingPosition>({ top: 0, left: 0 });
  const formatting = shallowRef<FormattingState | null>(null);
  const hasSelection = ref(false);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const visible = computed(
    () =>
      options.isActive() &&
      !options.isSuppressed() &&
      formatting.value !== null &&
      (hasSelection.value || !typing.value),
  );

  const reposition = () => {
    const editor = options.editor.value;
    if (!editor || !options.isActive()) return;
    const { from, to } = editor.state.selection;
    try {
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const singleLine = Math.abs(start.top - end.top) < 2;
      const rect = options.element.value?.getBoundingClientRect();
      position.value = placeAboveSelection(
        {
          top: Math.min(start.top, end.top),
          bottom: Math.max(start.bottom, end.bottom),
          left: start.left,
          right: singleLine ? end.right : start.left,
        },
        rect && rect.width > 0
          ? { width: rect.width, height: rect.height }
          : DEFAULT_SIZE,
      );
    } catch {
      // coordsAtPos needs layout; skip until the view has rendered.
    }
  };

  const refresh = () => {
    const editor = options.editor.value;
    if (!editor || !options.isActive()) {
      formatting.value = null;
      return;
    }
    formatting.value = readFormatting(editor);
    hasSelection.value = !editor.state.selection.empty;
    reposition();
    // The measured width changes with the content (e.g. a custom size label).
    void nextTick(reposition);
  };

  const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
    if (transaction.docChanged && options.editor.value?.isFocused) {
      typing.value = true;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        typing.value = false;
        refresh();
      }, TYPING_IDLE_MS);
    }
    refresh();
  };

  watch(
    options.editor,
    (editor, _prev, onCleanup) => {
      if (!editor) return;
      editor.on("transaction", onTransaction);
      editor.on("focus", refresh);
      onCleanup(() => editor.off("transaction", onTransaction));
      onCleanup(() => editor.off("focus", refresh));
    },
    { immediate: true },
  );

  // Entering or leaving edit mode.
  watch(() => options.isActive(), refresh);

  // Keep attached to the text while the page or tile scrolls.
  watch(visible, (isVisible, _prev, onCleanup) => {
    if (!isVisible) return;
    const handler = () => reposition();
    window.addEventListener("scroll", handler, { capture: true, passive: true });
    window.addEventListener("resize", handler, { passive: true });
    onCleanup(() => {
      window.removeEventListener("scroll", handler, { capture: true });
      window.removeEventListener("resize", handler);
    });
  });

  onUnmounted(() => {
    if (idleTimer) clearTimeout(idleTimer);
  });

  return { visible, position, formatting, refresh };
}
