import { computed, nextTick, ref, watch, type Ref } from "vue";
import type { Editor } from "@tiptap/vue-3";
import {
  filterSlashCommands,
  findSlashQuery,
  type InlineFieldsRequest,
  type InsertedImage,
  type SlashCommand,
  type SlashRange,
} from "@/utils/richText/slashCommands";

export interface FloatingPosition {
  top: number;
  left: number;
}

const MENU_WIDTH = 300;
const MENU_HEIGHT = 240;
const GAP = 6;
const VIEWPORT_PADDING = 8;

/**
 * Where a floating panel of the given size fits next to a caret rectangle:
 * below it when there is room (or more room than above), otherwise above,
 * clamped inside the viewport.
 */
export function placeBelowOrAbove(
  caret: { top: number; bottom: number; left: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): FloatingPosition {
  const spaceBelow = viewport.height - caret.bottom - GAP;
  const spaceAbove = caret.top - GAP;
  const top =
    spaceBelow >= size.height || spaceBelow >= spaceAbove
      ? caret.bottom + GAP
      : caret.top - GAP - Math.min(size.height, spaceAbove);
  return {
    top: Math.max(
      VIEWPORT_PADDING,
      Math.min(top, viewport.height - VIEWPORT_PADDING),
    ),
    left: Math.max(
      VIEWPORT_PADDING,
      Math.min(caret.left, viewport.width - size.width - VIEWPORT_PADDING),
    ),
  };
}

interface SlashMenuOptions {
  editor: Ref<Editor | undefined>;
  /** Menu only opens while this is true (edit mode, owner). */
  isActive: () => boolean;
  commands: () => readonly SlashCommand[];
  pickImage: () => Promise<InsertedImage | null>;
  requestFields: (
    request: InlineFieldsRequest,
  ) => Promise<Record<string, string> | null>;
  /** Called after a command changes the document. */
  onCommandDone?: () => void;
}

/**
 * The `/` command menu for a Tiptap editor: detects a `/query` at the caret,
 * filters and positions the menu, handles arrow/enter/tab/escape, and runs the
 * chosen command. `running` stays true while an async command (image picker,
 * inline fields) waits on the user, so hosts can keep edit mode open.
 */
export function useSlashMenu(options: SlashMenuOptions) {
  const open = ref(false);
  const query = ref("");
  const selectedIndex = ref(0);
  const position = ref<FloatingPosition>({ top: 0, left: 0 });
  const running = ref(false);
  let range: SlashRange | null = null;

  const items = computed(() =>
    filterSlashCommands(options.commands(), query.value),
  );
  const visible = computed(() => open.value && items.value.length > 0);

  const hide = () => {
    open.value = false;
    query.value = "";
    selectedIndex.value = 0;
    range = null;
  };

  /** Re-read the caret; call on every update and selection change. */
  const update = () => {
    const editor = options.editor.value;
    if (!editor || !options.isActive() || options.commands().length === 0) {
      hide();
      return;
    }
    const { state, view } = editor;
    const { from, $from, empty } = state.selection;
    if (!empty || !$from.parent.isTextblock) {
      hide();
      return;
    }

    const textBefore = $from.parent.textBetween(
      0,
      $from.parentOffset,
      "\0",
      "\0",
    );
    const match = findSlashQuery(textBefore);
    if (!match) {
      hide();
      return;
    }

    const slashPos = from - $from.parentOffset + match.offset;
    range = { from: slashPos, to: from };
    query.value = match.query;
    position.value = placeBelowOrAbove(view.coordsAtPos(slashPos), {
      width: MENU_WIDTH,
      height: MENU_HEIGHT,
    });
    open.value = true;
    if (selectedIndex.value >= items.value.length) selectedIndex.value = 0;
  };

  const execute = async (index: number) => {
    const editor = options.editor.value;
    const command = items.value[index];
    const target = range;
    if (!editor || !command || !target) return;
    hide();
    running.value = true;
    try {
      await command.run({
        editor,
        range: target,
        pickImage: options.pickImage,
        requestFields: options.requestFields,
      });
    } catch (error) {
      console.error(`[RichText] /${command.id} failed:`, error);
    } finally {
      running.value = false;
    }
    options.onCommandDone?.();
  };

  /** Editor keydown hook; returns true when the menu consumed the key. */
  const handleKeyDown = (event: KeyboardEvent): boolean => {
    if (!visible.value) return false;
    const count = items.value.length;
    switch (event.key) {
      case "ArrowDown":
        selectedIndex.value = (selectedIndex.value + 1) % count;
        return true;
      case "ArrowUp":
        selectedIndex.value = (selectedIndex.value - 1 + count) % count;
        return true;
      case "Enter":
      case "Tab":
        void execute(selectedIndex.value);
        return true;
      case "Escape":
        hide();
        return true;
      default:
        return false;
    }
  };

  // Keep the menu attached to the caret while the page or tile scrolls.
  watch(visible, (isVisible, _prev, onCleanup) => {
    if (!isVisible) return;
    const reposition = () => nextTick(update);
    window.addEventListener("scroll", reposition, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", reposition, { passive: true });
    onCleanup(() => {
      window.removeEventListener("scroll", reposition, { capture: true });
      window.removeEventListener("resize", reposition);
    });
  });

  return {
    visible,
    items,
    selectedIndex,
    position,
    running,
    update,
    hide,
    execute,
    handleKeyDown,
  };
}
