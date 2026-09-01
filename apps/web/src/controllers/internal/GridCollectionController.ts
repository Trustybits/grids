import type {
  ConfirmedGridDuplicateStorage,
  CopyDepth,
  Grid,
} from "@grids/contracts/types";
import type {
  GridControllerDependencies,
  GridControllerStores,
} from "../GridControllerTypes";

export class GridCollectionController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
    private readonly clearSessionIfGridDeleted: (id: string) => void,
  ) {}

  /**
   * Load the current user's grids into the collection store.
   *
   * Returns `true` when the fetch completed and the collection reflects the
   * user's real grids, `false` when it could not (unauthenticated or the read
   * failed). Callers must not treat an empty collection as "new user" without
   * checking this flag — a swallowed read failure looks identical to a genuine
   * zero-grid account and would otherwise trigger spurious grid creation.
   */
  async fetchGrids(): Promise<boolean> {
    this.stores.collection.setLoading(true);
    this.stores.collection.setError(null);
    this.stores.collection.setGrids([]);

    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) {
      this.stores.collection.setError("User not authenticated");
      this.stores.collection.setLoading(false);
      return false;
    }

    try {
      const gridService = this.dependencies.getGridService();
      const grids = await gridService.fetchGridsByUserId(userId);
      // Hide the feature's hidden drafts (shadow docs of a published grid).
      // A draft carries `draftOf`; a net-new unpublished grid does not, so it
      // stays listed. This keeps drafts out of the dashboard, recents, and any
      // default-grid/slug resolution that reads from the collection.
      this.stores.collection.setGrids(
        grids.filter((grid) => grid.draftOf == null),
      );
      await this.loadRecents();
      return true;
    } catch (error) {
      this.stores.collection.setError("Failed to fetch grids.");
      console.error(error);
      return false;
    } finally {
      this.stores.collection.setLoading(false);
    }
  }

  async createGrid(name: string): Promise<string | null> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) {
      this.stores.collection.setError("User not authenticated");
      return null;
    }
    const resolvedName =
      name || `Grid ${this.stores.collection.grids.length + 1}`;
    try {
      const grid = await this.dependencies
        .getGridService()
        .createGridWithStarterTiles(userId, resolvedName);
      this.stores.collection.addGrid({ ...grid });
      return grid.id;
    } catch (error) {
      this.stores.collection.setError("Failed to create grid.");
      console.error(error);
      return null;
    }
  }

  async duplicateGrid(
    sourceGrid: Grid,
    copyDepth: CopyDepth = "full",
    storagePlan?: ConfirmedGridDuplicateStorage,
  ): Promise<string | null> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) {
      this.stores.collection.setError("User not authenticated");
      return null;
    }
    try {
      const gridService = this.dependencies.getGridService();
      const grid =
        storagePlan === undefined
          ? await gridService.cloneAndPersistGrid(userId, sourceGrid, copyDepth)
          : await gridService.cloneAndPersistGrid(
              userId,
              sourceGrid,
              copyDepth,
              storagePlan,
            );
      this.stores.collection.addGrid({ ...grid });
      return grid.id;
    } catch (error) {
      this.stores.collection.setError("Failed to duplicate grid.");
      console.error(error);
      return null;
    }
  }

  recordRecent(id: string): void {
    this.stores.collection.recordRecent(id);
    void this.saveRecents();
  }

  async loadRecents(): Promise<void> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) return;
    try {
      this.stores.collection.setRecentGridIds(
        await this.dependencies
          .getGridService()
          .loadRecentGridIds(userId),
      );
    } catch (error) {
      console.error("Failed to load recent grids:", error);
    }
  }

  async saveRecents(): Promise<void> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    if (!userId) return;
    try {
      await this.dependencies
        .getGridService()
        .saveRecentGridIds(
          userId,
          this.stores.collection.recentGridIds,
        );
    } catch (error) {
      console.error("Failed to save recent grids:", error);
    }
  }

  async renameGrid(
    id: string,
    newName: string,
    activeGrid: Grid | null = this.stores.session.currentGrid,
  ): Promise<void> {
    try {
      const grid = this.stores.collection.grids.find(
        (candidate) => candidate.id === id,
      );
      if (!grid) throw new Error("Grid not found");
      grid.name = newName;
      const savedGrid = await this.dependencies
        .getGridService()
        .updateGrid(grid);
      if (activeGrid?.id === id) {
        activeGrid.name = newName;
        activeGrid.rev = savedGrid.rev;
      }
    } catch (error) {
      this.stores.collection.setError("Failed to rename grid.");
      console.error(error);
      throw error;
    }
  }

  async deleteGrid(
    id: string,
    activeGrid: Grid | null = this.stores.session.currentGrid,
    clearActiveGrid?: () => void,
  ): Promise<void> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    const grid = this.stores.collection.grids.find(
      (candidate) => candidate.id === id,
    );
    if (!userId || !grid || grid.userId !== userId) return;

    try {
      await this.dependencies.getGridService().deleteGrid(id);
      this.stores.collection.removeGrid(id);
      if (activeGrid?.id === id && clearActiveGrid) {
        clearActiveGrid();
      } else {
        this.clearSessionIfGridDeleted(id);
      }
    } catch (error) {
      this.stores.collection.setError("Failed to delete grid.");
      console.error(error);
    }
  }
}
