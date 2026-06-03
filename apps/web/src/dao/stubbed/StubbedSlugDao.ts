import type { SlugDao } from "@grids/contracts/dao";
import type {
  SlugAvailabilityResponse,
  SlugClaimResponse,
} from "@grids/contracts/types";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import {
  STUBBED_USER_ID,
  channel,
  emit,
  memoryDatabase,
  mergeRecord,
} from "./StubbedMemoryDatabase";

const RESERVED_SLUGS = new Set(["admin", "api", "auth", "dashboard", "login"]);

export class StubbedSlugDao implements SlugDao {
  public async getBySlug(
    slug: string,
  ): Promise<Record<string, unknown> | null> {
    return memoryDatabase.slugs.get(this.normalize(slug)) ?? null;
  }

  public async checkAvailability(
    slug: string,
  ): Promise<SlugAvailabilityResponse> {
    const normalized = this.normalize(slug);
    if (!this.isValid(normalized)) {
      return {
        available: false,
        reason: "invalid-format",
        message: "Use 3-30 lowercase letters, numbers, or hyphens.",
      };
    }
    if (RESERVED_SLUGS.has(normalized)) {
      return {
        available: false,
        reason: "reserved",
        message: "This handle is reserved.",
      };
    }
    const existing = memoryDatabase.slugs.get(normalized);
    const userId = this.currentUserId();
    if (existing?.userId === userId) {
      return {
        available: true,
        reason: "own-slug",
        message: "This handle is already yours.",
      };
    }
    if (existing) {
      return {
        available: false,
        reason: "taken",
        message: "This handle is already taken.",
      };
    }
    return {
      available: true,
      reason: "available",
      message: "This handle is available.",
    };
  }

  public async claim(slug: string): Promise<SlugClaimResponse> {
    const availability = await this.checkAvailability(slug);
    if (!availability.available && availability.reason !== "own-slug") {
      return { success: false, message: availability.message };
    }

    const userId = this.currentUserId();
    const normalized = this.normalize(slug);
    for (const [existingSlug, data] of memoryDatabase.slugs.entries()) {
      if (data.userId === userId && existingSlug !== normalized) {
        memoryDatabase.slugs.delete(existingSlug);
      }
    }
    memoryDatabase.slugs.set(normalized, { userId, defaultGridId: null });
    memoryDatabase.users.set(
      userId,
      mergeRecord(memoryDatabase.users.get(userId), { slug: normalized }),
    );
    emit(channel("user", userId));
    return { success: true, message: "Handle claimed locally." };
  }

  public async updateDefaultGrid(
    gridId: string | null,
  ): Promise<{ success: boolean }> {
    const userId = this.currentUserId();
    const user = memoryDatabase.users.get(userId);
    const slug = typeof user?.slug === "string" ? user.slug : null;
    if (slug) {
      memoryDatabase.slugs.set(slug, { userId, defaultGridId: gridId });
    }
    memoryDatabase.users.set(
      userId,
      mergeRecord(user, { defaultGridId: gridId }),
    );
    emit(channel("user", userId));
    return { success: true };
  }

  private currentUserId(): string {
    return getAuthProvider().getCurrentUserId() ?? STUBBED_USER_ID;
  }

  private normalize(slug: string): string {
    return slug.trim().toLowerCase();
  }

  private isValid(slug: string): boolean {
    return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(slug);
  }
}
