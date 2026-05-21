import type { Grid } from "@/types/Grid";
import type { GridDao } from "@/dao/interfaces/GridDao";

export class StubbedGridDao implements GridDao {
  public getById(_id: string): Promise<Grid | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public findByUserId(_userId: string): Promise<Grid[]> {
    throw new Error("Stubbed DAO implementation");
  }

  public generateId(): string {
    throw new Error("Stubbed DAO implementation");
  }

  public save(_id: string, _data: Record<string, unknown>): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public update(_id: string, _data: Record<string, unknown>): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public updateLastOpenedAt(_id: string): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public delete(_id: string): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }
}
