import type { BadgeDao } from "@/dao/interfaces/BadgeDao";

export class StubbedBadgeDao implements BadgeDao {
  public getById(_userId: string): Promise<Record<string, unknown> | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public subscribe(
    _userId: string,
    _callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }
}
