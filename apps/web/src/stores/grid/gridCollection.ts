import { defineStore } from "pinia";
import type { Grid } from "@grids/contracts/types";

export const useGridCollectionStore = defineStore("gridCollection", {
  state: () => ({
    grids: [] as Grid[],
    isLoading: false,
    error: null as string | null,
    recentGridIds: [] as string[],
  }),

  actions: {
    setGrids(grids: Grid[]) {
      this.grids = grids;
    },

    addGrid(grid: Grid) {
      this.grids.push(grid);
    },

    updateGrid(id: string, patch: Partial<Grid>) {
      const index = this.grids.findIndex((grid) => grid.id === id);
      if (index === -1) return;
      this.grids[index] = { ...this.grids[index], ...patch };
    },

    removeGrid(id: string) {
      this.grids = this.grids.filter((grid) => grid.id !== id);
    },

    setLoading(isLoading: boolean) {
      this.isLoading = isLoading;
    },

    setError(error: string | null) {
      this.error = error;
    },

    setRecentGridIds(ids: string[]) {
      this.recentGridIds = ids;
    },

    recordRecent(id: string) {
      const next = this.recentGridIds.filter((candidate) => candidate !== id);
      next.unshift(id);
      this.recentGridIds = next.slice(0, 3);
    },

    reset() {
      this.$reset();
    },
  },
});
