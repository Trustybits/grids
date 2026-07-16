import { defineStore } from "pinia";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  type ResponsiveLayoutVersion,
} from "@grids/contracts/types";

export type GridPreview =
  | {
      readonly kind: "responsive-layout";
      readonly gridId: string;
      readonly responsiveLayoutVersion: typeof GRIDDLE_RESPONSIVE_LAYOUT_VERSION;
    }
  | null;

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

    responsiveLayoutVersionOverride:
      (state) =>
      (
        gridId: string | null | undefined,
      ): ResponsiveLayoutVersion | undefined =>
        previewForGrid(state.activePreview, gridId)
          ?.responsiveLayoutVersion,
  },

  actions: {
    startResponsiveLayoutPreview(gridId: string): void {
      this.activePreview = {
        kind: "responsive-layout",
        gridId,
        responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
      };
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
