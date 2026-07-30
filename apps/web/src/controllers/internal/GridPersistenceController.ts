import { isGridRevisionConflictError } from "@grids/contracts/dao";
import type {
  GridPersistenceFlushResult,
  GridPersistenceScope,
} from "@/services/interfaces/GridPersistenceSchedulerInterface";
import { createPersistableGridSnapshot } from "@/utils/GridPersistenceUtils";
import type {
  GridControllerDependencies,
  GridControllerStores,
} from "../GridControllerTypes";

export class GridPersistenceController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
    private readonly canSaveCurrentGrid: () => boolean,
    private readonly flushChatCleanup: () => void,
  ) {}

  scheduleSave(
    resolvedUrls: Record<string, string> =
      this.stores.uploads.resolvedUrls,
    resolvedDocumentItemUrls: Record<
      string,
      Record<string, string>
    > = this.stores.uploads.resolvedDocumentItemUrls,
  ): void {
    const scope = this.enqueueSave(
      resolvedUrls,
      resolvedDocumentItemUrls,
    );
    if (scope) {
      this.observeScheduledSave(scope);
    }
  }

  private currentResolvedHashes(): Record<string, string> {
    return this.stores.uploads.resolvedHashes;
  }

  private currentResolvedDocumentItemHashes(): Record<
    string,
    Record<string, string>
  > {
    return this.stores.uploads.resolvedDocumentItemHashes;
  }

  async flushSaves(): Promise<void> {
    const scope = this.stores.session.getPersistenceScope();
    if (!scope) return;

    await this.flushPersistenceScope(scope);
  }

  async saveGrid(
    resolvedUrls: Record<string, string> =
      this.stores.uploads.resolvedUrls,
    resolvedDocumentItemUrls: Record<
      string,
      Record<string, string>
    > = this.stores.uploads.resolvedDocumentItemUrls,
  ): Promise<void> {
    try {
      await this.saveCurrentGridOrThrow(
        resolvedUrls,
        resolvedDocumentItemUrls,
      );
    } catch {
      // Legacy callers observe save failures through store state.
    }
  }

  async saveCurrentGridOrThrow(
    resolvedUrls: Record<string, string> =
      this.stores.uploads.resolvedUrls,
    resolvedDocumentItemUrls: Record<
      string,
      Record<string, string>
    > = this.stores.uploads.resolvedDocumentItemUrls,
    bypassEditPermission = false,
  ): Promise<void> {
    const scope = this.enqueueSave(
      resolvedUrls,
      resolvedDocumentItemUrls,
      bypassEditPermission,
    );
    if (!scope) {
      throw new Error("The grid could not be scheduled for saving.");
    }

    try {
      await this.flushPersistenceScope(scope);
    } catch (error) {
      // GridPersistenceScheduler retains a drained failed lane so a later
      // generic flush can observe it. This command already observed the
      // failure, so consume that retained result and leave an immediate retry
      // with a fresh lane.
      await this.dependencies.persistenceScheduler
        .flush(scope)
        .catch(() => undefined);
      throw error;
    }
  }

  private enqueueSave(
    resolvedUrls: Record<string, string>,
    resolvedDocumentItemUrls: Record<string, Record<string, string>>,
    bypassEditPermission = false,
  ): GridPersistenceScope | null {
    const grid = this.stores.session.currentGrid;
    if (!grid) {
      console.warn("No grid to save.");
      return null;
    }
    if (!bypassEditPermission && !this.canSaveCurrentGrid()) {
      return null;
    }

    const scope = this.stores.session.getPersistenceScope();
    if (!scope) return null;

    try {
      const snapshot = createPersistableGridSnapshot(
        grid,
        resolvedUrls,
        resolvedDocumentItemUrls,
        this.currentResolvedHashes(),
        this.currentResolvedDocumentItemHashes(),
      );
      this.stores.session.setPersistenceStatus("pending");
      this.dependencies.persistenceScheduler.schedule(scope, snapshot);
      if (this.stores.session.matchesPersistenceScope(scope)) {
        this.stores.session.setPersistenceStatus("saving");
      }
      return scope;
    } catch (error) {
      this.reportPersistenceError(error);
      return null;
    }
  }

  private async flushPersistenceScope(
    scope: GridPersistenceScope,
  ): Promise<void> {
    try {
      const savedSnapshot =
        await this.dependencies.persistenceScheduler.flush(scope);
      if (!this.stores.session.matchesPersistenceScope(scope)) return;
      this.updateCurrentGridRev(savedSnapshot);
      this.stores.session.setPersistenceStatus("idle");
      this.stores.session.setPersistenceError(null);
      // Periodic GC tick: reclaim removed chat tiles that have fallen out of
      // undo/redo reach now that this save has committed.
      this.flushChatCleanup();
    } catch (error) {
      if (this.stores.session.matchesPersistenceScope(scope)) {
        this.reportPersistenceError(error);
      }
      throw error;
    }
  }

  private observeScheduledSave(scope: GridPersistenceScope): void {
    void this.flushPersistenceScope(scope).catch(() => undefined);
  }

  private updateCurrentGridRev(
    savedSnapshot: GridPersistenceFlushResult,
  ): void {
    const currentGrid = this.stores.session.currentGrid;
    if (
      currentGrid &&
      savedSnapshot &&
      currentGrid.id === savedSnapshot.id &&
      typeof savedSnapshot.rev === "number"
    ) {
      currentGrid.rev = savedSnapshot.rev;
    }
  }

  private reportPersistenceError(error: unknown): void {
    const message = isGridRevisionConflictError(error)
      ? "This grid has newer saved changes elsewhere. Refresh the grid before saving again."
      : "Failed to save grid.";
    // Toast only on the transition into a failed episode. A rev conflict
    // persists until the grid is refreshed, so every subsequent save would
    // otherwise re-toast; the store status resets to null on the next
    // successful save, re-arming the toast for a genuinely new failure.
    const wasAlreadyFailing = this.stores.session.persistenceError !== null;
    this.stores.session.setPersistenceError(message);
    if (!wasAlreadyFailing) {
      this.stores.toast.addToast(message, "error");
    }
    console.error(error);
  }
}
