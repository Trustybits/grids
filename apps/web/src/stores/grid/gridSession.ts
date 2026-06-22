import { defineStore } from "pinia";
import type { Breakpoint, Grid } from "@grids/contracts/types";
import { breakpointRank } from "@/utils/BreakpointUtils";

export const useGridSessionStore = defineStore("gridSession", {
  state: () => ({
    currentGrid: null as Grid | null,
    isOwner: false,
    isDemoGrid: false,
    isLoading: false,
    loadError: null as string | null,
    persistenceError: null as string | null,
  }),

  getters: {
    verticalCompact: (state): boolean =>
      state.currentGrid?.verticalCompact ?? true,

    canEditAtBreakpoint:
      (state) =>
      (
        forcedBreakpoint: Breakpoint | null,
        viewportBreakpoint: Breakpoint,
      ): boolean => {
        if (!state.isOwner) return false;
        if (!forcedBreakpoint) return true;
        return (
          breakpointRank(forcedBreakpoint) <=
          breakpointRank(viewportBreakpoint)
        );
      },
  },

  actions: {
    setCurrentGrid(grid: Grid | null) {
      this.currentGrid = grid;
    },

    setOwner(isOwner: boolean) {
      this.isOwner = isOwner;
    },

    setDemoGrid(isDemoGrid: boolean) {
      this.isDemoGrid = isDemoGrid;
    },

    setLoading(isLoading: boolean) {
      this.isLoading = isLoading;
    },

    setLoadError(error: string | null) {
      this.loadError = error;
    },

    setPersistenceError(error: string | null) {
      this.persistenceError = error;
    },

    reset() {
      this.$reset();
    },
  },
});
