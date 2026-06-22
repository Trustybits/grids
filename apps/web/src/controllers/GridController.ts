import type { AuthProvider } from "@grids/contracts/auth";
import type { Grid } from "@grids/contracts/types";
import type { IAnalyticsService } from "@/services/interfaces/IAnalyticsService";
import type { IGridService } from "@/services/interfaces/IGridService";
import { GridSnapshotCodec } from "@/undo/GridSnapshotCodec";
import type { useGridCollectionStore } from "@/stores/grid/gridCollection";
import type { useGridHistoryStore } from "@/stores/grid/gridHistory";
import type { useGridSessionStore } from "@/stores/grid/gridSession";
import type { useGridUiStore } from "@/stores/grid/gridUi";
import type { useGridUploadsStore } from "@/stores/grid/gridUploads";
import type { useGridViewportStore } from "@/stores/grid/gridViewport";
import type { useThemeStore } from "@/stores/theme";
import type { useToastStore } from "@/stores/toast";

export interface GridControllerStores {
  collection: ReturnType<typeof useGridCollectionStore>;
  history: ReturnType<typeof useGridHistoryStore>;
  session: ReturnType<typeof useGridSessionStore>;
  ui: ReturnType<typeof useGridUiStore>;
  uploads: ReturnType<typeof useGridUploadsStore>;
  viewport: ReturnType<typeof useGridViewportStore>;
  theme: ReturnType<typeof useThemeStore>;
  toast: ReturnType<typeof useToastStore>;
}

export interface GridMetadataPreferences {
  showMetaData: boolean;
  showMetaDataVerbose: boolean;
}

export interface GridControllerDependencies {
  getGridService(): IGridService;
  getAuthProvider(): AuthProvider;
  getAnalyticsService(): IAnalyticsService;
  generateUuid(): string;
  delay(milliseconds: number): Promise<void>;
  now(): Date;
  measureViewportGridRow(): number;
  waitForLayoutReady(): Promise<void>;
  readMetadataPreferences(): GridMetadataPreferences;
  snapshotCodec: GridSnapshotCodec;
}

export class GridController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
  ) {}

  resetSessionDependents(): void {
    this.stores.history.reset();
    this.stores.viewport.reset();
    this.stores.uploads.reset();
    this.stores.ui.resetSessionState();
    this.stores.session.reset();
  }

  async loadGrid(id: string): Promise<void> {
    this.resetSessionDependents();
    this.stores.history.initializeManager();
    this.stores.session.setLoading(true);

    try {
      const gridService = this.dependencies.getGridService();
      const grid = await gridService.fetchGrid(id);
      const userId =
        this.dependencies.getAuthProvider().getCurrentUserId();

      this.stores.session.setCurrentGrid(grid);
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
          .saveRecentGridIds(userId, this.stores.collection.recentGridIds)
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
      this.stores.session.setLoadError("Failed to load grid.");
      console.error(error);
    } finally {
      this.stores.session.setLoading(false);
    }
  }

  loadDemoGrid(grid: Grid): void {
    this.resetSessionDependents();
    this.stores.session.setCurrentGrid(grid);
    this.stores.session.setOwner(false);
    this.stores.session.setDemoGrid(true);
  }

  clearSession(): void {
    this.resetSessionDependents();
  }

  async deleteGrid(id: string): Promise<void> {
    const userId =
      this.dependencies.getAuthProvider().getCurrentUserId();
    const grid = this.stores.collection.grids.find(
      (candidate) => candidate.id === id,
    );
    if (!userId || !grid || grid.userId !== userId) return;

    try {
      await this.dependencies.getGridService().deleteGrid(id);
      this.stores.collection.removeGrid(id);
      this.clearSessionIfGridDeleted(id);
    } catch (error) {
      this.stores.collection.setError("Failed to delete grid.");
      console.error(error);
    }
  }

  clearSessionIfGridDeleted(id: string): void {
    if (this.stores.session.currentGrid?.id === id) {
      this.clearSession();
    }
  }

  private refreshStableSnapshot(): void {
    const grid = this.stores.session.currentGrid;
    if (!grid) {
      this.stores.history.setStableSnapshot(null);
      return;
    }

    this.stores.history.setStableSnapshot(
      this.dependencies.snapshotCodec.capture({
        grid,
        breakpoint:
          this.stores.viewport.forcedBreakpoint ??
          this.stores.viewport.activeBreakpoint,
        actionLabel: "",
        resolvedUrls: this.stores.uploads.resolvedUrls,
        resolvedDocumentItemUrls:
          this.stores.uploads.resolvedDocumentItemUrls,
      }),
    );
  }
}
