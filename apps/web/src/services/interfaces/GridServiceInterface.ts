import type {
  ConfirmedGridDuplicateStorage,
  CopyDepth,
  Grid,
} from "@grids/contracts/types";

export interface GridServiceInterface {
  // ── Core CRUD ───────────────────────────────────────────────────────
  fetchGrid(id: string): Promise<Grid>;
  /**
   * Subscribe to realtime updates for a single grid. The callback receives the
   * current grid immediately and on every change (null if deleted). Returns an
   * unsubscribe function.
   */
  subscribeToGrid(
    id: string,
    callback: (grid: Grid | null) => void,
  ): () => void;
  saveGrid(grid: Grid): Promise<Grid>;
  updateGrid(grid: Grid): Promise<Grid>;
  deleteGrid(id: string): Promise<void>;

  fetchGridsByUserId(userId: string): Promise<Grid[]>;
  generateId(): string;
  createGrid(
    userId: string,
    name: string,
    starterTiles?: Grid["tiles"],
  ): Promise<Grid>;
  duplicateGrid(
    userId: string,
    sourceGrid: Grid,
    clonedTiles: Grid["tiles"],
    newOverrides: Grid["overrides"],
    storagePlan?: ConfirmedGridDuplicateStorage,
  ): Promise<Grid>;
  touchLastOpenedAt(gridId: string): Promise<void>;

  // ── Recent grids (user document) ──────────────────────────────────
  loadRecentGridIds(userId: string): Promise<string[]>;
  saveRecentGridIds(userId: string, ids: string[]): Promise<void>;

  // ── Starter tiles & full-clone helpers ──────────────────────────────
  createGridWithStarterTiles(userId: string, name: string): Promise<Grid>;
  cloneAndPersistGrid(
    userId: string,
    sourceGrid: Grid,
    copyDepth?: CopyDepth,
    storagePlan?: ConfirmedGridDuplicateStorage,
  ): Promise<Grid>;

  // ── Draft / publish lifecycle ────────────────────────────────────────
  /** Create a hidden draft duplicate of a published grid (preserves tile ids). */
  createDraft(original: Grid): Promise<Grid>;
  /** Idempotently get-or-create the hidden draft for a published grid. */
  getOrCreateDraft(originalId: string): Promise<Grid>;
  /** Publish a draft back into its original document and delete the draft. */
  publishDraft(draftId: string): Promise<void>;
  /** Promote a draft into its own listed public grid (clears draftOf). */
  publishAsCopy(draftId: string, name?: string): Promise<Grid>;
  /** Take a published grid private again (status:"draft"). */
  unpublishGrid(gridId: string): Promise<void>;
}
