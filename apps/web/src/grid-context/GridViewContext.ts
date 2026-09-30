import type { ComputedRef, DeepReadonly, InjectionKey } from "vue";
import type {
  AnyTileContent,
  Breakpoint,
  DocumentItem,
  Grid,
  TileContent,
} from "@grids/contracts/types";
import type {
  GridHistoryUrlMaps,
  GridLayoutReadinessAdapter,
} from "@/controllers/GridController";
import type { UpdateCaptionInput } from "@/controllers/GridCommands";
import type { GridLayoutItem } from "@/types/GridLayout";
import type { GridPreview } from "@/stores/grid/gridPreview";

export type GridViewMode = "live" | "demo";

export interface GridViewContext {
  mode: GridViewMode;

  grid: ComputedRef<DeepReadonly<Grid> | null>;
  /**
   * The grid's public identity. Under draft/publish an owner edits a hidden
   * draft document, so `grid.id` is the draft's id while the shareable URL,
   * analytics, and per-grid Firestore subcollections (chat messages, upvotes)
   * all live under the original. Tiles that key data by grid id must use this
   * rather than `grid.id`. Equals `grid.id` outside draft editing; empty when
   * no grid is loaded.
   */
  publicGridId: ComputedRef<string>;
  isOwner: ComputedRef<boolean>;
  canEdit: ComputedRef<boolean>;
  activePreview: ComputedRef<GridPreview>;
  isPreviewActive: ComputedRef<boolean>;
  blocksGridMutation: ComputedRef<boolean>;
  isLoading: ComputedRef<boolean>;
  verticalCompact: ComputedRef<boolean>;
  activeBreakpoint: ComputedRef<Breakpoint>;
  viewportBreakpoint: ComputedRef<Breakpoint>;
  forcedBreakpoint: ComputedRef<Breakpoint | null>;
  displayPositions: ComputedRef<GridLayoutItem[]>;
  showMetaData: ComputedRef<boolean>;
  showMetaDataVerbose: ComputedRef<boolean>;
  showGridGuide: ComputedRef<boolean>;
  uploadingTiles: ComputedRef<Record<string, number>>;
  activeTileId: ComputedRef<string | null>;
  activePanelId: ComputedRef<string | null>;
  pendingFocusTileId: ComputedRef<string | null>;

  registerLayoutReadinessAdapter(
    adapter: GridLayoutReadinessAdapter,
  ): () => void;
  setActiveBreakpoint(breakpoint: Breakpoint): void;
  setViewportBreakpoint(breakpoint: Breakpoint): void;
  setForcedBreakpoint(breakpoint: Breakpoint | null): void;
  setDisplayPositions(positions: GridLayoutItem[]): void;
  commitCompactedLayout(layout: GridLayoutItem[]): void;
  stopPreview(): void;

  beginMove(urlMaps?: GridHistoryUrlMaps): void;
  commitMove(urlMaps?: GridHistoryUrlMaps): void;
  beginResize(urlMaps?: GridHistoryUrlMaps): void;
  commitResize(urlMaps?: GridHistoryUrlMaps): void;
  beginEditing(tileId: string, urlMaps?: GridHistoryUrlMaps): void;
  commitEditing(urlMaps?: GridHistoryUrlMaps): void;
  setTileContent(tileId: string, content: TileContent): void;
  patchTileContent(
    tileId: string,
    patch: Partial<AnyTileContent>,
  ): void;
  patchTileContentSilently(
    tileId: string,
    patch: Partial<AnyTileContent>,
  ): void;
  autosaveTileContent(
    tileId: string,
    patch: Partial<AnyTileContent>,
  ): void;
  patchDocumentItem(
    tileId: string,
    itemId: string,
    patch: Partial<DocumentItem>,
  ): void;
  updateCaption(input: UpdateCaptionInput): void;
  removeTile(tileId: string, settledLayout?: GridLayoutItem[]): void;
  duplicateTile(tileId: string): string | null;
  resizeTile(tileId: string, width: number, height: number): void;
  toggleTileBorder(tileId: string): void;
  toggleLinkBackground(tileId: string): void;

  setPendingFocusTileId(tileId: string | null): void;
  setPanelActive(tileId: string, panelId: string): void;
  toggleMenuActive(tileId: string): void;
  togglePanelActive(tileId: string, panelId: string): void;
  closeMenus(): void;
  getCookieValue(name: string): string | null;
}

export const gridViewContextKey: InjectionKey<GridViewContext> =
  Symbol("GridViewContext");
