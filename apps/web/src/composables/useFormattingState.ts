import { shallowRef, watch, type Ref } from "vue";
import type { Editor } from "@tiptap/vue-3";
import { readFormatting, type FormattingState } from "@/utils/richText/formatting";

/**
 * The formatting at the editor's selection, kept current on every
 * transaction. Null while `isActive` is false, so hosts can hide on it.
 */
export function useFormattingState(
  editor: Ref<Editor | undefined>,
  isActive: () => boolean,
) {
  const formatting = shallowRef<FormattingState | null>(null);

  const refresh = () => {
    const current = editor.value;
    formatting.value = current && isActive() ? readFormatting(current) : null;
  };

  watch(
    editor,
    (current, _prev, onCleanup) => {
      if (!current) return;
      current.on("transaction", refresh);
      onCleanup(() => current.off("transaction", refresh));
    },
    { immediate: true },
  );
  watch(isActive, refresh, { immediate: true });

  return { formatting, refresh };
}
