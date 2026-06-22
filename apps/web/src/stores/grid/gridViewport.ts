import { defineStore } from "pinia";
import type {
  Breakpoint,
  Grid,
  TilePosition,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import { breakpointRank } from "@/utils/BreakpointUtils";

export const useGridViewportStore = defineStore("gridViewport", {
  state: () => ({
    activeBreakpoint: "lg" as Breakpoint,
    viewportBreakpoint: "lg" as Breakpoint,
    forcedBreakpoint: null as Breakpoint | null,
    displayPositions: [] as GridLayoutItem[],
  }),

  getters: {
    renderedBreakpoint: (state): Breakpoint =>
      state.forcedBreakpoint ?? state.activeBreakpoint,

    isForcedBreakpointViewOnly: (state): boolean =>
      state.forcedBreakpoint !== null &&
      breakpointRank(state.forcedBreakpoint) >
        breakpointRank(state.viewportBreakpoint),
  },

  actions: {
    setActiveBreakpoint(breakpoint: Breakpoint) {
      this.activeBreakpoint = breakpoint;
    },

    setViewportBreakpoint(breakpoint: Breakpoint) {
      this.viewportBreakpoint = breakpoint;
    },

    setForcedBreakpoint(breakpoint: Breakpoint | null) {
      this.forcedBreakpoint = breakpoint;
    },

    setDisplayPositions(positions: GridLayoutItem[]) {
      this.displayPositions = positions;
    },

    getBreakpointPositions(
      grid: Grid | null,
      breakpoint: Breakpoint,
    ): Record<string, TilePosition> | undefined {
      return grid?.overrides?.[breakpoint];
    },

    hasBreakpointOverride(
      grid: Grid | null,
      breakpoint: Breakpoint,
    ): boolean {
      const positions = this.getBreakpointPositions(grid, breakpoint);
      return !!positions && Object.keys(positions).length > 0;
    },

    reset() {
      this.$reset();
    },
  },
});
