import { defineStore } from "pinia";
import type { Breakpoint, Grid } from "@grids/contracts/types";
import { breakpointRank } from "@/utils/BreakpointUtils";

export type GridPersistenceStatus =
  | "idle"
  | "pending"
  | "saving"
  | "error";

export interface GridPersistenceScope {
  gridId: string;
  sessionGeneration: number;
}

export const useGridSessionStore = defineStore("gridSession", {
  state: () => ({
    currentGrid: null as Grid | null,
    isOwner: false,
    isDemoGrid: false,
    isLoading: false,
    isResyncing: false,
    loadError: null as string | null,
    sessionGeneration: 0,
    persistenceStatus: "idle" as GridPersistenceStatus,
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
      this.sessionGeneration += 1;
      this.currentGrid = grid;
      this.persistenceStatus = "idle";
      this.persistenceError = null;
    },

    setOwner(isOwner: boolean) {
      this.isOwner = isOwner;
    },

    /**
     * The open grid was transferred to another user while we had it open. Patch
     * the cached owner id and drop edit rights so both `isOwner` and any
     * `currentGrid.userId`-derived ownership checks flip to read-only without
     * replacing the grid content (which would clobber unsaved local edits).
     */
    markOwnershipRevoked(newOwnerId: string) {
      if (this.currentGrid) {
        this.currentGrid.userId = newOwnerId;
      }
      this.isOwner = false;
    },

    setDemoGrid(isDemoGrid: boolean) {
      this.isDemoGrid = isDemoGrid;
    },

    setLoading(isLoading: boolean) {
      this.isLoading = isLoading;
    },

    setResyncing(isResyncing: boolean) {
      this.isResyncing = isResyncing;
    },

    setLoadError(error: string | null) {
      this.loadError = error;
    },

    setPersistenceError(error: string | null) {
      this.persistenceError = error;
      if (error) {
        this.persistenceStatus = "error";
      }
    },

    setPersistenceStatus(status: GridPersistenceStatus) {
      this.persistenceStatus = status;
    },

    getPersistenceScope(): GridPersistenceScope | null {
      if (!this.currentGrid) return null;
      return {
        gridId: this.currentGrid.id,
        sessionGeneration: this.sessionGeneration,
      };
    },

    matchesPersistenceScope(scope: GridPersistenceScope): boolean {
      return (
        this.currentGrid?.id === scope.gridId &&
        this.sessionGeneration === scope.sessionGeneration
      );
    },

    reset() {
      const nextGeneration = this.sessionGeneration + 1;
      this.$reset();
      this.sessionGeneration = nextGeneration;
    },
  },
});
