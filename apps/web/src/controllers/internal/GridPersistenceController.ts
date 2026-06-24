import type { GridPersistenceScope } from "@/services/interfaces/IGridPersistenceScheduler";
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
    const scope = this.enqueueSave(
      resolvedUrls,
      resolvedDocumentItemUrls,
    );
    if (!scope) return;
    try {
      await this.flushPersistenceScope(scope);
    } catch {
      // Legacy callers observe save failures through store state.
    }
  }

  private enqueueSave(
    resolvedUrls: Record<string, string>,
    resolvedDocumentItemUrls: Record<string, Record<string, string>>,
  ): GridPersistenceScope | null {
    const grid = this.stores.session.currentGrid;
    if (!grid) {
      console.warn("No grid to save.");
      return null;
    }
    if (!this.canSaveCurrentGrid()) {
      return null;
    }

    const scope = this.stores.session.getPersistenceScope();
    if (!scope) return null;

    try {
      const snapshot = createPersistableGridSnapshot(
        grid,
        resolvedUrls,
        resolvedDocumentItemUrls,
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
      await this.dependencies.persistenceScheduler.flush(scope);
      if (!this.stores.session.matchesPersistenceScope(scope)) return;
      this.stores.session.setPersistenceStatus("idle");
      this.stores.session.setPersistenceError(null);
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

  private reportPersistenceError(error: unknown): void {
    this.stores.session.setPersistenceError("Failed to save grid.");
    console.error(error);
  }
}
