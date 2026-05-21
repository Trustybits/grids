import { onMounted, onUnmounted } from "vue";
import { useGridStore } from "@/stores/grid";

function isEditorOrInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useUndoRedoKeys() {
  const gridStore = useGridStore();

  const handleKeydown = async (e: KeyboardEvent) => {
    if (!gridStore.canEdit) return;
    if (isEditorOrInput(e.target)) return;

    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    if (e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      await gridStore.undo();
    } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
      e.preventDefault();
      await gridStore.redo();
    }
  };

  onMounted(() => {
    window.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
}
