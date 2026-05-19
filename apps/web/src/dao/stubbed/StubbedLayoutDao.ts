import type { Layout } from "@/types/Layout";
import type { LayoutDao } from "@/dao/interfaces/LayoutDao";

export class StubbedLayoutDao implements LayoutDao {
  public getById(_id: string): Promise<Layout | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public findByUserId(_userId: string): Promise<Layout[]> {
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
