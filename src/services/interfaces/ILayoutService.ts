import type { CopyDepth, Layout } from "@/types/Layout";

export interface ILayoutService {
  // ── Core CRUD ───────────────────────────────────────────────────────
  fetchLayout(id: string): Promise<Layout>;
  saveLayout(layout: Layout): Promise<void>;
  updateLayout(layout: Layout): Promise<void>;
  deleteLayout(id: string): Promise<void>;

  fetchLayoutsByUserId(userId: string): Promise<Layout[]>;
  generateId(): string;
  createLayout(
    userId: string,
    name: string,
    starterTiles?: Layout["tiles"],
  ): Promise<Layout>;
  duplicateLayout(
    userId: string,
    sourceLayout: Layout,
    clonedTiles: Layout["tiles"],
    newOverrides: Layout["overrides"],
  ): Promise<Layout>;
  touchLastOpenedAt(layoutId: string): Promise<void>;

  // ── Recent layouts (user document) ──────────────────────────────────
  loadRecentLayoutIds(userId: string): Promise<string[]>;
  saveRecentLayoutIds(userId: string, ids: string[]): Promise<void>;

  // ── Starter tiles & full-clone helpers ──────────────────────────────
  createLayoutWithStarterTiles(userId: string, name: string): Promise<Layout>;
  cloneAndPersistLayout(
    userId: string,
    sourceLayout: Layout,
    copyDepth?: CopyDepth,
  ): Promise<Layout>;

  // ── Save serialization queue ────────────────────────────────────────
  queueSave(
    layout: Layout,
    resolvedUrls?: Record<string, string>,
  ): Promise<void>;
}