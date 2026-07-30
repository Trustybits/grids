import { computed } from "vue";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridPreviewStore } from "@/stores/grid/gridPreview";
import { useGridController } from "@/controllers/useGridController";

/**
 * The `kind` stamped on the descriptor while the mobile chrome is previewing.
 * The preview store holds one preview at a time and records what opened it, so
 * a later surface with its own preview can tell whose is on screen.
 */
export const MOBILE_PREVIEW_KIND = "mobile-breakpoint";

/**
 * Enter/exit the read-only grid preview and read whether one is on screen.
 *
 * Preview is read-only at *every* breakpoint, not only the ones wider than the
 * viewport: `GridController.canEdit` returns false while the preview store
 * holds a preview, which closes the editing affordances on the canvas and the
 * mutation paths behind them in one move. Editing a breakpoint other than the
 * one you are on is a separate, later phase.
 *
 * Preview state is scoped to the current grid by the store, so a preview left
 * over from a grid that has since been unloaded can never suppress editing on
 * the next one.
 */
export function useGridPreview() {
  const sessionStore = useGridSessionStore();
  const previewStore = useGridPreviewStore();
  const controller = useGridController();

  const isPreviewActive = computed(() =>
    previewStore.isActive(sessionStore.currentGrid?.id),
  );

  const enterPreview = () => {
    controller.startPreview(MOBILE_PREVIEW_KIND);
  };

  /**
   * Leaving preview also clears the forced breakpoint. Preview is a temporary
   * lens, so editing resumes at the real viewport instead of staying locked to
   * whichever device was last inspected — which, for a breakpoint wider than
   * the viewport, would otherwise leave the grid silently uneditable.
   */
  const exitPreview = () => {
    controller.stopPreview();
    controller.setForcedBreakpoint(null);
  };

  return { isPreviewActive, enterPreview, exitPreview };
}
