import type { Grid } from "@grids/contracts/types";
import type {
  GridControllerDependencies,
  GridControllerStores,
} from "../GridControllerTypes";

export class GridSessionController {
  // Realtime listener on the open grid document; used only to detect ownership
  // changes (e.g. an accepted transfer) so we can flip the previous owner to
  // read-only without waiting for a reload. It never syncs grid content.
  private gridSubscription: (() => void) | null = null;

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
