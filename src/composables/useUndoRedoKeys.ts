import { onMounted, onUnmounted } from "vue";
import { useLayoutStore } from "@/stores/layout";

function isEditorOrInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useUndoRedoKeys() {
  const layoutStore = useLayoutStore();

  const handleKeydown = async (e: KeyboardEvent) => {
    if (!layoutStore.canEdit) return;
    if (isEditorOrInput(e.target)) return;

    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    if (e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      await layoutStore.undo();
    } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
      e.preventDefault();
      await layoutStore.redo();
    }
  };

  onMounted(() => {
    window.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
}
