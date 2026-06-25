import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import { getDbUtils } from "@/dao/DbUtilsSingleton";
import type { DbUtils } from "@grids/contracts/dao";
import type { SlugDao } from "@grids/contracts/dao";
import type { UserDao } from "@grids/contracts/dao";
import type {
  SlugAvailabilityResponse,
  SlugClaimResponse,
  SlugData,
  UserProfile,
} from "@grids/contracts/types";
import type { UserServiceInterface } from "./interfaces/UserServiceInterface";

export class UserService implements UserServiceInterface {
  private userDao: UserDao;
  private slugDao: SlugDao;
  private dbUtils: DbUtils;

  constructor() {
    const factory = getDaoFactory();
    this.userDao = factory.getUserDao();
    this.slugDao = factory.getSlugDao();
    this.dbUtils = getDbUtils();
  }

  // ── Profile ─────────────────────────────────────────────────────────

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const data = await this.userDao.getById(userId);
      if (!data) return null;
      return data as UserProfile;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw error;
    }
  }

  async updateUserProfile(
    userId: string,
    data: Partial<UserProfile>,
  ): Promise<void> {
    try {
      await this.userDao.save(userId, data as Record<string, unknown>);
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  }

  subscribeToUserProfile(
    userId: string,
    callback: (profile: UserProfile | null) => void,
  ): () => void {
    return this.userDao.subscribe(userId, (data) => {
      callback(data ? (data as UserProfile) : null);
    });
  }

  async recordLogin(userId: string, email: string | null): Promise<void> {
    try {
      await this.userDao.save(userId, {
        email,
        lastLogin: this.dbUtils.serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to record login:", error);
      throw error;
    }
  }

  // ── Slug ────────────────────────────────────────────────────────────

  async getUserIdBySlug(slug: string): Promise<string | null> {
    const data = await this.getSlugData(slug);
    return data?.userId ?? null;
  }

  async getSlugData(slug: string): Promise<SlugData | null> {
    try {
      const data = await this.slugDao.getBySlug(slug);
      if (!data) return null;
      const userId = data.userId;
      if (typeof userId !== "string") return null;
      const rawGridId = data.defaultGridId;
      const defaultGridId =
        typeof rawGridId === "string" || rawGridId === null
          ? rawGridId
          : undefined;
      return { userId, defaultGridId };
    } catch (error) {
      console.error("Error fetching slug data:", error);
      throw error;
    }
  }

  async checkSlugAvailability(slug: string): Promise<SlugAvailabilityResponse> {
    try {
      return await this.slugDao.checkAvailability(slug);
    } catch (error: unknown) {
      console.error("Error checking slug availability:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to check slug availability";
      throw new Error(message);
    }
  }

  async claimSlug(slug: string): Promise<SlugClaimResponse> {
    try {
      return await this.slugDao.claim(slug);
    } catch (error: unknown) {
      console.error("Error claiming slug:", error);
      const message =
        error instanceof Error ? error.message : "Failed to claim slug";
      throw new Error(message);
    }
  }

  async setDefaultGrid(_userId: string, gridId: string | null): Promise<void> {
    try {
      await this.slugDao.updateDefaultGrid(gridId);
    } catch (error) {
      console.error("Error setting default grid:", error);
      throw error;
    }
  }
}
