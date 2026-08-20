import { defineStore } from "pinia";
import type { Breakpoint, Grid } from "@grids/contracts/types";
import { breakpointRank } from "@/utils/BreakpointUtils";

// Stable signature of a grid's user-editable content, used to decide whether a
// draft differs from the published original it shadows. Only the fields that
// publish writes back are included; identity/metadata (id, rev, timestamps,
// draftOf/status) is deliberately excluded.
function gridContentSignature(grid: Grid): string {
  return JSON.stringify({
    name: grid.name,
    colNum: grid.colNum,
    verticalCompact: grid.verticalCompact,
    tiles: grid.tiles,
    overrides: grid.overrides ?? {},
    backgroundImageSrc: grid.backgroundImageSrc,
    backgroundImageHash: grid.backgroundImageHash ?? "",
    backgroundEmbed: grid.backgroundEmbed,
    backgroundColor: grid.backgroundColor ?? "",
    backgroundActiveSource: grid.backgroundActiveSource ?? null,
    ogImageSrc: grid.ogImageSrc ?? "",
    themeId: grid.themeId ?? "",
    duplicatable: grid.duplicatable ?? false,
  });
}

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
    // Draft/publish: when the owner edits a published grid, `currentGrid` is the
    // hidden DRAFT doc and these hold the public original's id and a snapshot of
    // its content at load time. Both null in ordinary (non-draft) editing, so
    // `publicGridId` collapses to `currentGrid.id` and behavior is unchanged.
    publishedId: null as string | null,
    publishedGrid: null as Grid | null,
  }),

  getters: {
    verticalCompact: (state): boolean =>
      state.currentGrid?.verticalCompact ?? true,

    /**
     * The grid's public identity — the id used for the shareable URL, the
     * default-grid preference, deletion, transfers, and analytics. Equals the
     * draft's original when editing a draft, else the open grid's own id.
     */
    publicGridId: (state): string =>
      state.publishedId ?? state.currentGrid?.id ?? "",

    /** True while the session is editing a hidden draft of a published grid. */
    isDraftEditing: (state): boolean => state.publishedId !== null,

    /**
     * Whether the draft differs from the published original (i.e. there are
     * changes that a publish would push live). False when not draft-editing.
     */
    hasUnpublishedChanges: (state): boolean => {
      if (!state.publishedId || !state.currentGrid || !state.publishedGrid) {
        return false;
      }
      return (
        gridContentSignature(state.currentGrid) !==
        gridContentSignature(state.publishedGrid)
      );
    },

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
     * Enter draft-editing: `currentGrid` is the draft, while `publishedId` and
     * `publishedGrid` retain the public original's identity and content
     * snapshot. Call after setCurrentGrid(draft). `publishedGrid` is stored as a
     * detached copy so later edits to the draft don't mutate the baseline used
     * by `hasUnpublishedChanges`.
     */
    setDraftEditing(publishedId: string, publishedGrid: Grid) {
      this.publishedId = publishedId;
      this.publishedGrid = structuredClone(publishedGrid);
    },

    /** Leave draft-editing without replacing the current grid. */
    clearDraftEditing() {
      this.publishedId = null;
      this.publishedGrid = null;
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
