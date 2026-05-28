import type { BadgeDao } from "@grids/contracts/dao";
import type { UserBadges } from "@grids/contracts/types";
import {
  channel,
  cloneValue,
  memoryDatabase,
  subscribeToValue,
} from "./StubbedMemoryDatabase";

export class StubbedBadgeDao implements BadgeDao {
  public async getById(userId: string): Promise<UserBadges | null> {
    const badges = memoryDatabase.badges.get(userId);
    return badges ? cloneValue(badges) : null;
  }

  public subscribe(
    userId: string,
    callback: (data: UserBadges | null) => void,
  ): () => void {
    return subscribeToValue(
      channel("badges", userId),
      () => memoryDatabase.badges.get(userId) ?? null,
      callback,
    );
  }
}
