import type {
  GridControllerDependencies,
  GridControllerStores,
} from "../GridControllerTypes";

export class GridSessionController {
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
    this.stores.history.reset();
    this.stores.viewport.reset();
    this.stores.uploads.reset();
    this.stores.ui.resetSessionState();
    this.stores.session.reset();
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
      this.stores.session.setOwner(
        !!(userId && grid.userId && userId === grid.userId),
      );
      this.stores.session.setDemoGrid(false);

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

  clearSessionIfGridDeleted(id: string): void {
    if (this.stores.session.currentGrid?.id === id) {
      this.clearSession();
    }
  }
}
