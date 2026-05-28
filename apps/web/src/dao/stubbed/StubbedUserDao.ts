import type { UserDao } from "@grids/contracts/dao";

export class StubbedUserDao implements UserDao {
  public getById(_userId: string): Promise<Record<string, unknown> | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public save(_userId: string, _data: Record<string, unknown>): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public update(_userId: string, _data: Record<string, unknown>): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public subscribe(
    _userId: string,
    _callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }
}
