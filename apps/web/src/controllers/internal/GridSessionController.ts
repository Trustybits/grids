import type { Grid } from "@grids/contracts/types";
import type {
  GridControllerDependencies,
  GridControllerStores,
} from "../GridControllerTypes";

// How long the reload overlay is held after the reloaded grid is committed, so
// the swap reads as a deliberate refresh instead of a one-frame flicker.
const RESYNC_OVERLAY_MS = 350;

export class GridSessionController {
  // Realtime listener on the open grid document; used only to detect ownership
  // changes (e.g. an accepted transfer) so we can flip the previous owner to
  // read-only without waiting for a reload. It never syncs grid content.
  private gridSubscription: (() => void) | null = null;
  // Guards against overlapping reactivation checks — rapid tab flips must not
  // stack Firestore reads or reloads on top of one another.
  private resyncInFlight = false;

  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
    private readonly refreshStableSnapshot: () => void,
    private readonly flushChatCleanup: () => void,
  ) {}

  resetSessionDependents(): void {
    // Flush the outgoing grid's pending chat-tile cleanup before the history
    // and session stores are reset — while its id and undo/redo stacks are
    // still intact for the reachability check.
    this.flushChatCleanup();
    this.stopGridSubscription();
    this.stores.history.reset();
    this.stores.preview.reset();
    this.stores.viewport.reset();
    this.stores.uploads.reset();
    this.stores.ui.resetSessionState();
    this.stores.session.reset();
  }

  /** Tear down the current grid's realtime ownership listener, if any. */
  stopGridSubscription(): void {
    this.gridSubscription?.();
    this.gridSubscription = null;
  }

  async loadGrid(id: string): Promise<void> {
    this.stores.session.setLoadError(null);
    this.resetSessionDependents();
    const sessionGeneration = this.stores.session.sessionGeneration;
    let committedGrid = false;
    this.stores.history.initializeManager();
    this.stores.session.setLoading(true);

    try {
      const gridService = this.dependencies.getGridService();
      const grid = await gridService.fetchGrid(id);
      if (this.stores.session.sessionGeneration !== sessionGeneration) {
        return;
      }

      const userId =
        this.dependencies.getAuthProvider().getCurrentUserId();

      this.stores.session.setCurrentGrid(grid);
      committedGrid = true;
      const isOwner = !!(userId && grid.userId && userId === grid.userId);
      this.stores.session.setOwner(isOwner);
      this.stores.session.setDemoGrid(false);
      // Only owners need the ownership listener — it exists to catch losing the
      // grid (e.g. an accepted transfer). Skipping it for viewers avoids opening
      // a realtime listener on every anonymous public-page view.
      if (isOwner) {
        this.startGridSubscription(id, userId);
      }

      const preferences = this.dependencies.readMetadataPreferences();
      this.stores.ui.setShowMetaData(preferences.showMetaData);
      this.stores.ui.setShowMetaDataVerbose(
        preferences.showMetaDataVerbose,
      );

      this.stores.collection.recordRecent(id);
      if (userId) {
        void gridService
          .saveRecentGridIds(
            userId,
            this.stores.collection.recentGridIds,
          )
          .catch((error: unknown) => {
            console.error("Failed to save recent grids:", error);
          });
      }

      await gridService.touchLastOpenedAt(id);
      this.stores.collection.updateGrid(id, {
        lastOpenedAt: this.dependencies.now(),
      });
      this.refreshStableSnapshot();
    } catch (error) {
      if (this.stores.session.sessionGeneration !== sessionGeneration) {
        return;
      }

      this.stores.session.setLoadError("Failed to load grid.");
      console.error(error);
    } finally {
      if (
        committedGrid ||
        this.stores.session.sessionGeneration === sessionGeneration
      ) {
        this.stores.session.setLoading(false);
      }
    }
  }

  /**
   * On tab reactivation, check whether the grid has been saved elsewhere while
   * this tab was backgrounded. Grids carry a monotonic `rev`; if the stored rev
   * has advanced beyond our loaded copy, any local save would be rejected as a
   * revision conflict — so we reload to the latest saved state, discarding local
   * edits (which would only conflict on save anyway). When the rev still
   * matches, this is a no-op with no visible overlay.
   */
  async resyncIfStale(): Promise<void> {
    const activeGrid = this.stores.session.currentGrid;
    if (
      !activeGrid ||
      this.stores.session.isLoading ||
      this.resyncInFlight
    ) {
      return;
    }

    this.resyncInFlight = true;
    const sessionGeneration = this.stores.session.sessionGeneration;
    try {
      const gridService = this.dependencies.getGridService();
      const latest = await gridService.fetchGrid(activeGrid.id);

      // Discard the check if the session moved on (navigation / reload) while
      // the fetch was in flight.
      if (this.stores.session.sessionGeneration !== sessionGeneration) {
        return;
      }

      const currentRev = this.readRev(this.stores.session.currentGrid?.rev);
      const latestRev = this.readRev(latest.rev);
      if (currentRev === latestRev) {
        return;
      }

      this.stores.session.setResyncing(true);
      try {
        // Paint the overlay over the current grid before we tear it down.
        await this.dependencies.delay(0);
        if (this.stores.session.sessionGeneration !== sessionGeneration) {
          return;
        }
        this.commitReloadedGrid(latest);
        // commitReloadedGrid resets session-dependent state (clearing the
        // flag); re-assert it and hold briefly so the swap is perceptible.
        this.stores.session.setResyncing(true);
        await this.dependencies.delay(RESYNC_OVERLAY_MS);
      } finally {
        this.stores.session.setResyncing(false);
      }
    } catch (error) {
      // A failed staleness check must never disrupt the live session; the next
      // reactivation retries.
      console.error("Failed to resync grid on reactivation:", error);
    } finally {
      this.resyncInFlight = false;
    }
  }

  /**
   * Commit an already-fetched grid as the active session, reusing the same
   * store-reset ordering as `loadGrid`. Unlike `loadGrid` this is a passive
   * refresh, so it skips the analytics enter event, recents, and lastOpenedAt
   * touch — the user did not re-open the grid, it just changed underneath them.
   */
  private commitReloadedGrid(grid: Grid): void {
    // A passive resync must not disturb the physical viewport measurement.
    // `resetSessionDependents` resets the viewport store to its "lg" defaults;
    // on a normal load the grid unmounts/remounts (via the loading state) so
    // the responsive layout re-measures and re-pushes the real breakpoint, but
    // a resync keeps the grid mounted, so nothing would restore it — leaving
    // the store stuck at "lg" and the grid rendering the wrong breakpoint's
    // positions. Preserve the measured (and any user-forced) breakpoint here.
    const {
      activeBreakpoint,
      viewportBreakpoint,
      forcedBreakpoint,
    } = this.stores.viewport;

    this.resetSessionDependents();
    this.stores.history.initializeManager();

    this.stores.viewport.setActiveBreakpoint(activeBreakpoint);
    this.stores.viewport.setViewportBreakpoint(viewportBreakpoint);
    this.stores.viewport.setForcedBreakpoint(forcedBreakpoint);

    const userId = this.dependencies.getAuthProvider().getCurrentUserId();
    this.stores.session.setCurrentGrid(grid);
    this.stores.session.setOwner(
      !!(userId && grid.userId && userId === grid.userId),
    );
    this.stores.session.setDemoGrid(false);

    const preferences = this.dependencies.readMetadataPreferences();
    this.stores.ui.setShowMetaData(preferences.showMetaData);
    this.stores.ui.setShowMetaDataVerbose(preferences.showMetaDataVerbose);

    this.refreshStableSnapshot();
  }

  private readRev(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  clearSession(): void {
    this.resetSessionDependents();
  }

  /**
   * Watch the open grid document for an ownership change (e.g. an accepted
   * transfer). When the grid's `userId` moves away from us while we still hold
   * edit rights, flip to read-only immediately and tell the user, instead of
   * letting them keep editing a grid they can no longer save.
   */
  private startGridSubscription(
    gridId: string,
    currentUserId: string | null,
  ): void {
    this.stopGridSubscription();
    // Captured after setCurrentGrid, this pins the listener to this session so a
    // late snapshot can't act after a different grid has been loaded.
    const generation = this.stores.session.sessionGeneration;
    this.gridSubscription = this.dependencies
      .getGridService()
      .subscribeToGrid(gridId, (grid) => {
        this.handleGridSnapshot(gridId, generation, currentUserId, grid);
      });
  }

  private handleGridSnapshot(
    gridId: string,
    generation: number,
    currentUserId: string | null,
    grid: Grid | null,
  ): void {
    // Ignore snapshots from a superseded session (another grid has loaded).
    if (
      this.stores.session.sessionGeneration !== generation ||
      this.stores.session.currentGrid?.id !== gridId
    ) {
      return;
    }
    // Only react to a real ownership change away from us while we still own the
    // grid. Deletion (null) and ordinary content changes are ignored — this
    // listener never syncs content, so local unsaved edits are preserved.
    if (!grid || !this.stores.session.isOwner) return;
    if (!currentUserId || grid.userId === currentUserId) return;

    this.stores.session.markOwnershipRevoked(grid.userId);
    this.stores.preview.reset();
    // Close any open tile menus/editors so no edit affordance lingers.
    this.stores.ui.resetSessionState();
    this.stores.toast.addToast(
      "This grid was transferred to a new owner and is now read-only. Any unsaved changes weren't saved.",
      "info",
      8000,
    );
  }

  clearSessionIfGridDeleted(id: string): void {
    if (this.stores.session.currentGrid?.id === id) {
      this.clearSession();
    }
  }
}
