import type { CopyDepth, Grid } from "@grids/contracts/types";

export interface IGridService {
  // ── Core CRUD ───────────────────────────────────────────────────────
  fetchGrid(id: string): Promise<Grid>;
  saveGrid(grid: Grid): Promise<void>;
  updateGrid(grid: Grid): Promise<void>;
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
  ): Promise<Grid>;

  // ── Save serialization queue ────────────────────────────────────────
  queueSave(
    grid: Grid,
    resolvedUrls?: Record<string, string>,
    resolvedDocumentItemUrls?: Record<string, Record<string, string>>,
  ): Promise<void>;
}
