import { defineStore } from "pinia";

/** Neutral descriptor for a future, session-local grid preview feature. */
export interface GridPreviewDescriptor {
  readonly kind: string;
  readonly gridId: string;
}

export type GridPreview = GridPreviewDescriptor | null;

function previewForGrid(
  preview: GridPreview,
  gridId: string | null | undefined,
): GridPreview {
  return preview && gridId === preview.gridId ? preview : null;
}

/**
 * Session-local presentation preview state.
 *
 * This store intentionally does not import the grid session store. Every
 * getter requires the caller's current grid id so a stale preview can never
 * affect a newly loaded grid.
 */
export const useGridPreviewStore = defineStore("gridPreview", {
  state: () => ({
    activePreview: null as GridPreview,
  }),

  getters: {
    previewForGrid:
      (state) =>
      (gridId: string | null | undefined): GridPreview =>
        previewForGrid(state.activePreview, gridId),

    isActive:
      (state) =>
      (gridId: string | null | undefined): boolean =>
        previewForGrid(state.activePreview, gridId) !== null,

    blocksGridMutation:
      (state) =>
      (gridId: string | null | undefined): boolean =>
        previewForGrid(state.activePreview, gridId) !== null,
  },

  actions: {
    startPreview(preview: GridPreviewDescriptor): void {
      this.activePreview = { ...preview };
    },

    stopPreview(gridId?: string): void {
      if (gridId && this.activePreview?.gridId !== gridId) return;
      this.activePreview = null;
    },

    reset(): void {
      this.$reset();
    },
  },
});
