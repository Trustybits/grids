import type { Breakpoint, Grid } from "@grids/contracts/types";
import type { Snapshot } from "@/undo/UndoTypes";
import {
  BREAKPOINT_HISTORY_TRANSITION_MS,
  type GridControllerDependencies,
  type GridControllerStores,
  type GridHistoryUrlMaps,
} from "../GridControllerTypes";

type SetForcedBreakpoint = (
  breakpoint: Breakpoint | null,
  grid: Grid | null,
  resolvedUrls: Readonly<Record<string, string>>,
  resolvedDocumentItemUrls: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >,
) => void;

export class GridHistoryController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
    private readonly setForcedBreakpoint: SetForcedBreakpoint,
    private readonly waitForLayoutReady: (
      breakpoint: Breakpoint,
    ) => Promise<void>,
    private readonly commitGestureGeometry: () => void,
    private readonly scheduleSave: (
      resolvedUrls?: Record<string, string>,
      resolvedDocumentItemUrls?: Record<
        string,
        Record<string, string>
      >,
    ) => void,
  ) {}

  captureSnapshot(
    actionLabel: string,
    {
      resolvedUrls,
      resolvedDocumentItemUrls,
    }: GridHistoryUrlMaps = {
      resolvedUrls: this.stores.uploads.resolvedUrls,
      resolvedDocumentItemUrls:
        this.stores.uploads.resolvedDocumentItemUrls,
    },
  ): Snapshot | null {
    const grid = this.stores.session.currentGrid;
    if (!grid) return null;

    return this.dependencies.snapshotCodec.capture({
      grid,
      breakpoint:
        this.stores.viewport.forcedBreakpoint ??
        this.stores.viewport.activeBreakpoint,
      actionLabel,
      resolvedUrls,
      resolvedDocumentItemUrls,
    });
  }

  refreshStableSnapshot(urlMaps?: GridHistoryUrlMaps): void {
    this.stores.history.setStableSnapshot(
      this.captureSnapshot("", urlMaps),
    );
  }

  pushUndoSnapshot(
    actionLabel: string,
    urlMaps?: GridHistoryUrlMaps,
  ): void {
    const snapshot = this.captureSnapshot(actionLabel, urlMaps);
    if (!snapshot) return;

    this.stores.history.pushSnapshot(snapshot);
    this.refreshStableSnapshot(urlMaps);
  }

  async undo(urlMaps?: GridHistoryUrlMaps): Promise<void> {
    const current = this.captureSnapshot("", urlMaps);
    if (!current) return;

    const snapshot = this.stores.history.undo(current);
    if (!snapshot) return;

    await this.applySnapshot(snapshot, urlMaps);
  }

  async redo(urlMaps?: GridHistoryUrlMaps): Promise<void> {
    const current = this.captureSnapshot("", urlMaps);
    if (!current) return;

    const snapshot = this.stores.history.redo(current);
    if (!snapshot) return;

    await this.applySnapshot(snapshot, urlMaps);
  }

  async undoRedoUntil(
    snapshotId: number,
    urlMaps?: GridHistoryUrlMaps,
  ): Promise<void> {
    const current = this.captureSnapshot("", urlMaps);
    if (!current) return;

    const snapshot = this.stores.history.undoRedoUntil(
      snapshotId,
      current,
    );
    if (!snapshot) return;

    await this.applySnapshot(snapshot, urlMaps);
  }

  async applySnapshot(
    snapshot: Snapshot,
    urlMaps: GridHistoryUrlMaps = {
      resolvedUrls: this.stores.uploads.resolvedUrls,
      resolvedDocumentItemUrls:
        this.stores.uploads.resolvedDocumentItemUrls,
    },
  ): Promise<void> {
    const grid = this.stores.session.currentGrid;
    if (!grid) return;

    const breakpointChanged =
      this.stores.viewport.forcedBreakpoint !== null &&
      snapshot.forcedBreakpoint !==
        this.stores.viewport.forcedBreakpoint;

    if (breakpointChanged) {
      this.setForcedBreakpoint(
        snapshot.forcedBreakpoint,
        grid,
        urlMaps.resolvedUrls,
        urlMaps.resolvedDocumentItemUrls,
      );
      await Promise.all([
        this.dependencies.delay(BREAKPOINT_HISTORY_TRANSITION_MS),
        this.waitForLayoutReady(snapshot.forcedBreakpoint),
      ]);
    }

    const themeChanged = grid.themeId !== snapshot.themeId;
    this.dependencies.snapshotCodec.apply(grid, snapshot);

    if (themeChanged) {
      this.stores.theme.setTheme(snapshot.themeId);
    }

    this.scheduleSave(
      urlMaps.resolvedUrls,
      urlMaps.resolvedDocumentItemUrls,
    );
    this.refreshStableSnapshot(urlMaps);
    this.stores.history.bumpVersion();
  }

  beginEditing(
    tileId: string,
    urlMaps?: GridHistoryUrlMaps,
  ): void {
    if (
      this.stores.history.beginEdit(
        tileId,
        this.captureSnapshot("Edit tile", urlMaps),
      )
    ) {
      this.refreshStableSnapshot(urlMaps);
    }
  }

  commitEditing(urlMaps?: GridHistoryUrlMaps): void {
    const pending = this.stores.history.takeEditSnapshot();
    if (!pending) return;

    const current = this.captureSnapshot("", urlMaps);
    if (
      current &&
      !this.dependencies.snapshotCodec.equals(pending, current)
    ) {
      this.stores.history.pushSnapshot(pending);
      this.scheduleSave();
      this.refreshStableSnapshot(urlMaps);
    }
  }

  beginMove(urlMaps?: GridHistoryUrlMaps): void {
    this.stores.history.beginMove(
      this.captureSnapshot("Move tile", urlMaps),
    );
  }

  commitMove(urlMaps?: GridHistoryUrlMaps): void {
    const pending = this.stores.history.takeMoveSnapshot();
    if (!pending) return;

    this.stores.history.pushSnapshot(pending);
    this.commitGestureGeometry();
    this.refreshStableSnapshot(urlMaps);
  }

  beginResize(urlMaps?: GridHistoryUrlMaps): void {
    this.stores.history.beginResize(
      this.captureSnapshot("Resize tile", urlMaps),
    );
  }

  commitResize(urlMaps?: GridHistoryUrlMaps): void {
    const pending = this.stores.history.takeResizeSnapshot();
    if (!pending) return;

    this.stores.history.pushSnapshot(pending);
    this.commitGestureGeometry();
    this.refreshStableSnapshot(urlMaps);
  }
}
