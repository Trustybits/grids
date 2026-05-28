import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { BadgeDao } from "@grids/contracts/dao";
import type { UserBadges } from "@grids/contracts/types";
import type { IBadgeService } from "./interfaces/IBadgeService";

export class BadgeService implements IBadgeService {
  private badgeDao: BadgeDao;

  constructor() {
    this.badgeDao = getDaoFactory().getBadgeDao();
  }

  async getBadges(userId: string): Promise<UserBadges | null> {
    try {
      return await this.badgeDao.getById(userId);
    } catch (error) {
      console.error("Error fetching user badges:", error);
      throw error;
    }
  }

  subscribeToBadges(
    userId: string,
    callback: (badges: UserBadges | null) => void,
  ): () => void {
    return this.badgeDao.subscribe(userId, callback);
  }
}
