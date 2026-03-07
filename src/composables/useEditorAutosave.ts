import { onUnmounted } from "vue";

const DEBOUNCE_MS = 1500;

/**
 * Provides a debounced `schedulePersist` that calls the given `persist`
 * callback after the user stops editing for 1.5 s, plus a `flushPersist`
 * that fires immediately and cancels any pending timer.
 *
 * Automatically flushes on component unmount so no edits are lost.
 */
export function useEditorAutosave(persist: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedulePersist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      persist();
      timer = null;
    }, DEBOUNCE_MS);
  };

  const flushPersist = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    persist();
  };

  onUnmounted(() => {
    if (timer) {
      clearTimeout(timer);
      persist();
      timer = null;
    }
  });

  return { schedulePersist, flushPersist };
}
