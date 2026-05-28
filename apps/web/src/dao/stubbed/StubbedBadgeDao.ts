import type { BadgeDao } from "@grids/contracts/dao";
import type { UserBadges } from "@grids/contracts/types";

export class StubbedBadgeDao implements BadgeDao {
  public getById(_userId: string): Promise<UserBadges | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public subscribe(
    _userId: string,
    _callback: (data: UserBadges | null) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }
}
