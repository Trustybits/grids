import type { Grid } from "@grids/contracts/types";
import {
  GridRevisionConflictError,
  type GridDao,
  type GridSubscription,
} from "@grids/contracts/dao";
import {
  channel,
  cloneValue,
  createId,
  emit,
  memoryDatabase,
  mergeRecord,
  subscribeToValue,
  toGrid,
} from "./StubbedMemoryDatabase";

const GRID_CHANNEL_PREFIX = "grid";

/** Notify subscribers that a single grid document changed. */
export function emitGridChanged(id: string): void {
  emit(channel(GRID_CHANNEL_PREFIX, id));
}

export class StubbedGridDao implements GridDao {
  public async getById(id: string): Promise<Grid | null> {
    const grid = memoryDatabase.grids.get(id);
    return grid ? cloneValue(grid) : null;
  }

  public subscribeToGrid(
    id: string,
    callback: GridSubscription,
  ): () => void {
    return subscribeToValue(
      channel(GRID_CHANNEL_PREFIX, id),
      () => memoryDatabase.grids.get(id) ?? null,
      callback,
    );
  }

  public async findByUserId(userId: string): Promise<Grid[]> {
    return Array.from(memoryDatabase.grids.values())
      .filter((grid) => grid.userId === userId)
      .map((grid) => cloneValue(grid));
  }

  public generateId(): string {
    return createId("grid");
  }

  public async save(
    id: string,
    data: Record<string, unknown>,
    expectedRev?: number,
  ): Promise<void> {
    const existing = memoryDatabase.grids.get(id) as unknown as
      | Record<string, unknown>
      | undefined;
    this.assertExpectedRev(id, existing, expectedRev);
    memoryDatabase.grids.set(id, toGrid(id, mergeRecord(existing, data)));
    emitGridChanged(id);
  }

  public async update(
    id: string,
    data: Record<string, unknown>,
    expectedRev?: number,
  ): Promise<void> {
    const existing = memoryDatabase.grids.get(id) as unknown as
      | Record<string, unknown>
      | undefined;
    this.assertExpectedRev(id, existing, expectedRev);
    memoryDatabase.grids.set(id, toGrid(id, mergeRecord(existing, data)));
    emitGridChanged(id);
  }

  public async updateLastOpenedAt(id: string): Promise<void> {
    const existing = memoryDatabase.grids.get(id);
    if (!existing) return;
    memoryDatabase.grids.set(id, {
      ...cloneValue(existing),
      lastOpenedAt: new Date(),
    });
    emitGridChanged(id);
  }

  public async delete(id: string): Promise<void> {
    memoryDatabase.grids.delete(id);
    emitGridChanged(id);
  }

  private assertExpectedRev(
    id: string,
    existing: Record<string, unknown> | undefined,
    expectedRev: number | undefined,
  ): void {
    if (expectedRev === undefined) return;
    const actualRev =
      typeof existing?.rev === "number" && Number.isFinite(existing.rev)
        ? existing.rev
        : 0;
    if (actualRev !== expectedRev) {
      throw new GridRevisionConflictError(
        id,
        expectedRev,
        actualRev,
        existing ? toGrid(id, existing) : null,
      );
    }
  }
}
