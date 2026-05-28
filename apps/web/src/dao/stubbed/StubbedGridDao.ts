import type { Grid } from "@grids/contracts/types";
import type { GridDao } from "@grids/contracts/dao";
import {
  cloneValue,
  createId,
  memoryDatabase,
  mergeRecord,
  toGrid,
} from "./StubbedMemoryDatabase";

export class StubbedGridDao implements GridDao {
  public async getById(id: string): Promise<Grid | null> {
    const grid = memoryDatabase.grids.get(id);
    return grid ? cloneValue(grid) : null;
  }

  public async findByUserId(userId: string): Promise<Grid[]> {
    return Array.from(memoryDatabase.grids.values())
      .filter((grid) => grid.userId === userId)
      .map((grid) => cloneValue(grid));
  }

  public generateId(): string {
    return createId("grid");
  }

  public async save(id: string, data: Record<string, unknown>): Promise<void> {
    const existing = memoryDatabase.grids.get(id) as unknown as
      | Record<string, unknown>
      | undefined;
    memoryDatabase.grids.set(id, toGrid(id, mergeRecord(existing, data)));
  }

  public async update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const existing = memoryDatabase.grids.get(id) as unknown as
      | Record<string, unknown>
      | undefined;
    memoryDatabase.grids.set(id, toGrid(id, mergeRecord(existing, data)));
  }

  public async updateLastOpenedAt(id: string): Promise<void> {
    const existing = memoryDatabase.grids.get(id);
    if (!existing) return;
    memoryDatabase.grids.set(id, {
      ...cloneValue(existing),
      lastOpenedAt: new Date(),
    });
  }

  public async delete(id: string): Promise<void> {
    memoryDatabase.grids.delete(id);
  }
}
