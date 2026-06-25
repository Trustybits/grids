import type {
  Breakpoint,
  Grid,
  TilePosition,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import { breakpointRank } from "@/utils/BreakpointUtils";
import type {
  GridControllerDependencies,
  GridControllerStores,
  GridEditPermissionInput,
  GridLayoutReadinessAdapter,
} from "../GridControllerTypes";

export class GridViewportController {
  private layoutReadinessAdapter: GridLayoutReadinessAdapter | null =
    null;

  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
  ) {}

  registerLayoutReadinessAdapter(
    adapter: GridLayoutReadinessAdapter,
  ): () => void {
    this.layoutReadinessAdapter = adapter;

    return () => {
      if (this.layoutReadinessAdapter === adapter) {
        this.layoutReadinessAdapter = null;
      }
    };
  }

  canEdit({
    isOwner,
    forcedBreakpoint,
    viewportBreakpoint,
  }: GridEditPermissionInput): boolean {
    if (!isOwner) return false;
    if (!forcedBreakpoint) return true;
    return (
      breakpointRank(forcedBreakpoint) <=
      breakpointRank(viewportBreakpoint)
    );
  }

  setActiveBreakpoint(breakpoint: Breakpoint): void {
    this.stores.viewport.setActiveBreakpoint(breakpoint);
  }

  setViewportBreakpoint(breakpoint: Breakpoint): void {
    this.stores.viewport.setViewportBreakpoint(breakpoint);
  }

  setForcedBreakpoint(
    breakpoint: Breakpoint | null,
    grid: Grid | null = this.stores.session.currentGrid,
    resolvedUrls: Readonly<Record<string, string>> =
      this.stores.uploads.resolvedUrls,
    resolvedDocumentItemUrls: Readonly<
      Record<string, Readonly<Record<string, string>>>
    > = this.stores.uploads.resolvedDocumentItemUrls,
  ): void {
    this.stores.viewport.setForcedBreakpoint(breakpoint);
    if (!grid) {
      this.stores.history.setStableSnapshot(null);
      return;
    }
    this.stores.history.setStableSnapshot(
      this.dependencies.snapshotCodec.capture({
        grid,
        breakpoint:
          breakpoint ?? this.stores.viewport.activeBreakpoint,
        actionLabel: "",
        resolvedUrls,
        resolvedDocumentItemUrls,
      }),
    );
  }

  setDisplayPositions(positions: GridLayoutItem[]): void {
    this.stores.viewport.setDisplayPositions(positions);
  }

  getBreakpointPositions(
    grid: Grid | null,
    breakpoint: Breakpoint,
  ): Record<string, TilePosition> | undefined {
    return this.stores.viewport.getBreakpointPositions(grid, breakpoint);
  }

  hasBreakpointOverride(
    grid: Grid | null,
    breakpoint: Breakpoint,
  ): boolean {
    return this.stores.viewport.hasBreakpointOverride(grid, breakpoint);
  }

  waitForLayoutReady(breakpoint: Breakpoint): Promise<void> {
    return (
      this.layoutReadinessAdapter?.waitForLayoutReady(breakpoint) ??
      Promise.resolve()
    );
  }
}
