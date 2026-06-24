import type { Breakpoint } from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import {
  createPositionMap,
  syncPositionOnlyLayout,
} from "../GridControllerHelpers";
import type {
  GridControllerDependencies,
  GridControllerStores,
} from "../GridControllerTypes";

export class GridLayoutController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
    private readonly canEditCurrentGrid: () => boolean,
    private readonly pushUndoSnapshot: (actionLabel: string) => void,
    private readonly scheduleSave: () => void,
  ) {}

  getViewportGridY(): number {
    return this.dependencies.measureViewportGridRow();
  }

  commitGestureGeometry(): void {
    const grid = this.stores.session.currentGrid;
    if (this.stores.viewport.activeBreakpoint !== "lg") {
      this.captureActiveBreakpointOverride();
    } else if (grid && this.stores.viewport.displayPositions.length) {
      syncPositionOnlyLayout(
        grid,
        this.stores.viewport.displayPositions,
      );
    }
    this.scheduleSave();
  }

  commitRenderedDesktopLayout(
    layout: GridLayoutItem[] = this.stores.viewport.displayPositions,
  ): void {
    const grid = this.stores.session.currentGrid;
    if (!grid || !this.canEditCurrentGrid()) {
      return;
    }

    if (
      this.stores.viewport.activeBreakpoint === "lg" &&
      layout.length
    ) {
      syncPositionOnlyLayout(grid, layout);
    }
    this.scheduleSave();
  }

  commitCompactedLayout(layout: GridLayoutItem[]): void {
    const grid = this.stores.session.currentGrid;
    if (!grid || !this.canEditCurrentGrid()) {
      return;
    }
    syncPositionOnlyLayout(grid, layout);
    this.scheduleSave();
  }

  updateBreakpointOverride(): void {
    if (this.captureActiveBreakpointOverride()) {
      this.scheduleSave();
    }
  }

  saveBreakpointPositions(
    breakpoint: Breakpoint,
    tiles: GridLayoutItem[],
  ): void {
    const grid = this.stores.session.currentGrid;
    if (!grid || breakpoint === "lg") return;

    grid.overrides ??= {};
    grid.overrides[breakpoint] = createPositionMap(tiles);
    this.scheduleSave();
  }

  resetBreakpoint(breakpoint: Breakpoint): void {
    const grid = this.stores.session.currentGrid;
    if (!grid || breakpoint === "lg") return;

    this.pushUndoSnapshot("Reset breakpoint grid");
    if (grid.overrides) delete grid.overrides[breakpoint];
    this.scheduleSave();
  }

  private captureActiveBreakpointOverride(): boolean {
    const grid = this.stores.session.currentGrid;
    const breakpoint = this.stores.viewport.activeBreakpoint;
    if (!grid || breakpoint === "lg") return false;

    grid.overrides ??= {};
    grid.overrides[breakpoint] = createPositionMap(
      this.stores.viewport.displayPositions,
    );
    return true;
  }
}
