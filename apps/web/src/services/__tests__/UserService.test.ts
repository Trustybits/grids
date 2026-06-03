// Unit tests for UserService — all DAOs and DbUtils are mocked via singletons.
// console.error / console.warn are spied on so error-path logging is silenced
// during the test run and can be asserted on.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerDaoFactory } from "@/dao/DaoFactorySingleton";
import { registerDbUtils } from "@/dao/DbUtilsSingleton";
import { UserService } from "@/services/UserService";
import type { UserDao } from "@grids/contracts/dao";
import type { SlugDao } from "@grids/contracts/dao";
import type { DbUtils } from "@grids/contracts/dao";
import type { DaoFactory } from "@grids/contracts/dao";
import type { UserProfile } from "@grids/contracts/types";

// ── Mock DAOs ─────────────────────────────────────────────────────────────

let mockUserDao: Record<string, ReturnType<typeof vi.fn>>;
let mockSlugDao: Record<string, ReturnType<typeof vi.fn>>;
let mockDbUtils: Record<string, ReturnType<typeof vi.fn>>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Suppress logged errors so the rethrow tests don't pollute test output.
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  mockUserDao = {
    getById: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    subscribe: vi.fn(),
  };

  mockSlugDao = {
    getBySlug: vi.fn(),
    checkAvailability: vi.fn(),
    claim: vi.fn(),
    updateDefaultGrid: vi.fn(),
  };

  mockDbUtils = {
    sanitizeValue: vi.fn((v) => v),
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  };

  registerDaoFactory({
    getUserDao: () => mockUserDao as unknown as UserDao,
    getSlugDao: () => mockSlugDao as unknown as SlugDao,
    getBadgeDao: () => null,
    getGridDao: () => null,
    getUserGameDataDao: () => null,
    getChatDao: () => null,
    getUpvoteDao: () => null,
    getCustomerDao: () => null,
    getStorageDao: () => null,
  } as unknown as DaoFactory);

  registerDbUtils(mockDbUtils as unknown as DbUtils);

  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ── getUserProfile ────────────────────────────────────────────────────────

describe("getUserProfile", () => {
  it("returns the user profile when the document exists", async () => {
    const profile: UserProfile = {
      email: "test@example.com",
      slug: "testuser",
      defaultGridId: "grid-123",
      storageUsed: 0,
    };
    mockUserDao.getById.mockResolvedValueOnce(profile);

    const service = new UserService();
    const result = await service.getUserProfile("uid-abc");

    expect(result).toEqual(profile);
    expect(mockUserDao.getById).toHaveBeenCalledWith("uid-abc");
  });

  it("returns a profile with all optional fields populated", async () => {
    const profile: UserProfile = {
      email: "full@example.com",
      slug: "fulluser",
      defaultGridId: "grid-999",
      storageUsed: 1024,
      recentGridIds: ["l1", "l2"],
      starredGridIds: ["l3"],
      profilePhotoUrl: "https://example.com/photo.jpg",
    };
    mockUserDao.getById.mockResolvedValueOnce(profile);

    const service = new UserService();
    const result = await service.getUserProfile("uid-full");

    expect(result).toEqual(profile);
  });

  it("returns null when no document exists for the user", async () => {
    mockUserDao.getById.mockResolvedValueOnce(null);

    const service = new UserService();
    const result = await service.getUserProfile("uid-unknown");

    expect(result).toBeNull();
  });

  it("throws when the DAO throws an error", async () => {
    mockUserDao.getById.mockRejectedValueOnce(
      new Error("Database unavailable"),
    );

    const service = new UserService();
    await expect(service.getUserProfile("uid-abc")).rejects.toThrow(
      "Database unavailable",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error fetching user profile:",
      expect.any(Error),
    );
  });

  it("does not log on the happy path", async () => {
    mockUserDao.getById.mockResolvedValueOnce(null);

    const service = new UserService();
    await service.getUserProfile("uid-abc");

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});

// ── updateUserProfile ─────────────────────────────────────────────────────

describe("updateUserProfile", () => {
  it("calls userDao.save with the partial data", async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined);

    const service = new UserService();
    await service.updateUserProfile("uid-abc", { email: "new@example.com" });

    expect(mockUserDao.save).toHaveBeenCalledWith("uid-abc", {
      email: "new@example.com",
    });
  });

  it("passes through multiple fields", async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined);

    const service = new UserService();
    const data: Partial<UserProfile> = {
      slug: "newslug",
      profilePhotoUrl: "https://example.com/pic.png",
      storageUsed: 512,
    };
    await service.updateUserProfile("uid-abc", data);

    expect(mockUserDao.save).toHaveBeenCalledWith("uid-abc", data);
  });

  it("handles an empty partial update", async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined);

    const service = new UserService();
    await service.updateUserProfile("uid-abc", {});

    expect(mockUserDao.save).toHaveBeenCalledWith("uid-abc", {});
  });

  it("throws when the DAO write fails", async () => {
    mockUserDao.save.mockRejectedValueOnce(new Error("Permission denied"));

    const service = new UserService();
    await expect(
      service.updateUserProfile("uid-abc", { email: "new@example.com" }),
    ).rejects.toThrow("Permission denied");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error updating user profile:",
      expect.any(Error),
    );
  });
});

// ── recordLogin ───────────────────────────────────────────────────────────

describe("recordLogin", () => {
  it("saves email and server timestamp", async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined);

    const service = new UserService();
    await service.recordLogin("uid-abc", "test@example.com");

    expect(mockUserDao.save).toHaveBeenCalledWith("uid-abc", {
      email: "test@example.com",
      lastLogin: "SERVER_TIMESTAMP",
    });
    expect(mockDbUtils.serverTimestamp).toHaveBeenCalled();
  });

  it("saves null email when the user has no email", async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined);

    const service = new UserService();
    await service.recordLogin("uid-abc", null);

    expect(mockUserDao.save).toHaveBeenCalledWith("uid-abc", {
      email: null,
      lastLogin: "SERVER_TIMESTAMP",
    });
  });

  it("throws when the DAO write fails", async () => {
    mockUserDao.save.mockRejectedValueOnce(new Error("Write failed"));

    const service = new UserService();
    await expect(service.recordLogin("uid-abc", "a@b.com")).rejects.toThrow(
      "Write failed",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to record login:",
      expect.any(Error),
    );
  });
});

// ── getUserIdBySlug ───────────────────────────────────────────────────────

describe("getUserIdBySlug", () => {
  it("returns userId when slug exists", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({ userId: "uid-xyz" });

    const service = new UserService();
    const result = await service.getUserIdBySlug("testuser");

    expect(result).toBe("uid-xyz");
  });

  it("returns null when slug document does not exist", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce(null);

    const service = new UserService();
    const result = await service.getUserIdBySlug("nonexistent");

    expect(result).toBeNull();
  });

  it("returns null when slug document has no userId field", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({});

    const service = new UserService();
    const result = await service.getUserIdBySlug("someSlug");

    expect(result).toBeNull();
  });

  it("returns null when userId is a non-string type", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({ userId: 42 });

    const service = new UserService();
    const result = await service.getUserIdBySlug("baddata");

    expect(result).toBeNull();
  });

  it("throws when the DAO throws an error", async () => {
    mockSlugDao.getBySlug.mockRejectedValueOnce(new Error("Network error"));

    const service = new UserService();
    await expect(service.getUserIdBySlug("testuser")).rejects.toThrow(
      "Network error",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error fetching slug data:",
      expect.any(Error),
    );
  });
});

// ── getSlugData ───────────────────────────────────────────────────────────

describe("getSlugData", () => {
  it("returns full slug data when document exists with string defaultGridId", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({
      userId: "uid-xyz",
      defaultGridId: "grid-1",
    });

    const service = new UserService();
    const result = await service.getSlugData("testuser");

    expect(result).toEqual({ userId: "uid-xyz", defaultGridId: "grid-1" });
  });

  it("returns slug data with null defaultGridId", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({
      userId: "uid-xyz",
      defaultGridId: null,
    });

    const service = new UserService();
    const result = await service.getSlugData("testuser");

    expect(result).toEqual({ userId: "uid-xyz", defaultGridId: null });
  });

  it("returns slug data with undefined defaultGridId when field is missing", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({ userId: "uid-xyz" });

    const service = new UserService();
    const result = await service.getSlugData("testuser");

    expect(result).toEqual({ userId: "uid-xyz", defaultGridId: undefined });
  });

  it("coerces non-string/non-null defaultGridId to undefined", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({
      userId: "uid-xyz",
      defaultGridId: 123,
    });

    const service = new UserService();
    const result = await service.getSlugData("testuser");

    expect(result).toEqual({ userId: "uid-xyz", defaultGridId: undefined });
  });

  it("returns null when slug does not exist", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce(null);

    const service = new UserService();
    const result = await service.getSlugData("nonexistent");

    expect(result).toBeNull();
  });

  it("returns null when userId is not a string", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({ userId: 123 });

    const service = new UserService();
    const result = await service.getSlugData("baddata");

    expect(result).toBeNull();
  });

  it("returns null when userId is missing entirely", async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({ defaultGridId: "grid-1" });

    const service = new UserService();
    const result = await service.getSlugData("nouserid");

    expect(result).toBeNull();
  });

  it("throws when the DAO throws an error", async () => {
    mockSlugDao.getBySlug.mockRejectedValueOnce(new Error("Firestore error"));

    const service = new UserService();
    await expect(service.getSlugData("testuser")).rejects.toThrow(
      "Firestore error",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error fetching slug data:",
      expect.any(Error),
    );
  });
});

// ── checkSlugAvailability ─────────────────────────────────────────────────

describe("checkSlugAvailability", () => {
  it("returns available response", async () => {
    const response = {
      available: true,
      reason: "available" as const,
      message: "Slug is available",
    };
    mockSlugDao.checkAvailability.mockResolvedValueOnce(response);

    const service = new UserService();
    const result = await service.checkSlugAvailability("newslug");

    expect(result).toEqual(response);
    expect(mockSlugDao.checkAvailability).toHaveBeenCalledWith("newslug");
  });

  it("returns taken response", async () => {
    const response = {
      available: false,
      reason: "taken" as const,
      message: "Already taken",
    };
    mockSlugDao.checkAvailability.mockResolvedValueOnce(response);

    const service = new UserService();
    const result = await service.checkSlugAvailability("takenslug");

    expect(result).toEqual({
      available: false,
      reason: "taken",
      message: "Already taken",
    });
  });

  it("returns reserved response for protected slugs", async () => {
    const response = {
      available: false,
      reason: "reserved" as const,
      message: "This slug is reserved",
    };
    mockSlugDao.checkAvailability.mockResolvedValueOnce(response);

    const service = new UserService();
    const result = await service.checkSlugAvailability("admin");

    expect(result).toEqual({
      available: false,
      reason: "reserved",
      message: "This slug is reserved",
    });
  });

  it("returns invalid-format response", async () => {
    const response = {
      available: false,
      reason: "invalid-format" as const,
      message: "Invalid slug format",
    };
    mockSlugDao.checkAvailability.mockResolvedValueOnce(response);

    const service = new UserService();
    const result = await service.checkSlugAvailability("BAD SLUG!");

    expect(result).toEqual(response);
  });

  it("returns own-slug response", async () => {
    const response = {
      available: false,
      reason: "own-slug" as const,
      message: "This is your current slug",
    };
    mockSlugDao.checkAvailability.mockResolvedValueOnce(response);

    const service = new UserService();
    const result = await service.checkSlugAvailability("myslug");

    expect(result).toEqual(response);
  });

  it("throws with the Error message when the DAO rejects with an Error", async () => {
    mockSlugDao.checkAvailability.mockRejectedValueOnce(
      new Error("Functions error"),
    );

    const service = new UserService();
    await expect(service.checkSlugAvailability("slug")).rejects.toThrow(
      "Functions error",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error checking slug availability:",
      expect.any(Error),
    );
  });

  it("throws a generic message when the DAO rejects with a non-Error", async () => {
    mockSlugDao.checkAvailability.mockRejectedValueOnce("string error");

    const service = new UserService();
    await expect(service.checkSlugAvailability("slug")).rejects.toThrow(
      "Failed to check slug availability",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error checking slug availability:",
      "string error",
    );
  });
});

// ── claimSlug ────────────────────────────────────────────────────────────

describe("claimSlug", () => {
  it("returns success response", async () => {
    const response = { success: true, message: "Slug claimed successfully" };
    mockSlugDao.claim.mockResolvedValueOnce(response);

    const service = new UserService();
    const result = await service.claimSlug("myslug");

    expect(result).toEqual(response);
    expect(mockSlugDao.claim).toHaveBeenCalledWith("myslug");
  });

  it("returns failure response when claim is unsuccessful", async () => {
    const response = { success: false, message: "Slug already taken" };
    mockSlugDao.claim.mockResolvedValueOnce(response);

    const service = new UserService();
    const result = await service.claimSlug("takenslug");

    expect(result).toEqual({ success: false, message: "Slug already taken" });
  });

  it("throws with the Error message when the DAO rejects with an Error", async () => {
    mockSlugDao.claim.mockRejectedValueOnce(new Error("Slug already taken"));

    const service = new UserService();
    await expect(service.claimSlug("takenslug")).rejects.toThrow(
      "Slug already taken",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error claiming slug:",
      expect.any(Error),
    );
  });

  it("throws a generic message when the DAO rejects with a non-Error", async () => {
    mockSlugDao.claim.mockRejectedValueOnce(42);

    const service = new UserService();
    await expect(service.claimSlug("slug")).rejects.toThrow(
      "Failed to claim slug",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error claiming slug:", 42);
  });
});

// ── setDefaultGrid ────────────────────────────────────────────────────────

describe("setDefaultGrid", () => {
  it("calls slugDao.updateDefaultGrid with gridId", async () => {
    mockSlugDao.updateDefaultGrid.mockResolvedValueOnce({ success: true });

    const service = new UserService();
    await service.setDefaultGrid("uid-abc", "grid-123");

    expect(mockSlugDao.updateDefaultGrid).toHaveBeenCalledWith("grid-123");
  });

  it("accepts null to clear the default grid", async () => {
    mockSlugDao.updateDefaultGrid.mockResolvedValueOnce({ success: true });

    const service = new UserService();
    await service.setDefaultGrid("uid-abc", null);

    expect(mockSlugDao.updateDefaultGrid).toHaveBeenCalledWith(null);
  });

  it("does not pass userId to the DAO (cloud function infers it from auth)", async () => {
    mockSlugDao.updateDefaultGrid.mockResolvedValueOnce({ success: true });

    const service = new UserService();
    await service.setDefaultGrid("uid-abc", "grid-123");

    expect(mockSlugDao.updateDefaultGrid).toHaveBeenCalledTimes(1);
    expect(mockSlugDao.updateDefaultGrid).toHaveBeenCalledWith("grid-123");
  });

  it("throws when the DAO call fails", async () => {
    mockSlugDao.updateDefaultGrid.mockRejectedValueOnce(
      new Error("Unauthorized"),
    );

    const service = new UserService();
    await expect(service.setDefaultGrid("uid-abc", "grid-123")).rejects.toThrow(
      "Unauthorized",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error setting default grid:",
      expect.any(Error),
    );
  });
});

// ── subscribeToUserProfile ────────────────────────────────────────────────

describe("subscribeToUserProfile", () => {
  it("delegates to userDao.subscribe and forwards profile data", () => {
    const profile = { email: "test@example.com", slug: "testuser" };
    const unsubFn = vi.fn();

    mockUserDao.subscribe.mockImplementation(
      (_id: string, cb: (...args: unknown[]) => void) => {
        cb(profile);
        return unsubFn;
      },
    );

    const callback = vi.fn();
    const service = new UserService();
    const unsub = service.subscribeToUserProfile("uid-abc", callback);

    expect(mockUserDao.subscribe).toHaveBeenCalledWith(
      "uid-abc",
      expect.any(Function),
    );
    expect(callback).toHaveBeenCalledWith(profile);
    expect(unsub).toBe(unsubFn);
  });

  it("forwards null when the document does not exist", () => {
    mockUserDao.subscribe.mockImplementation(
      (_id: string, cb: (...args: unknown[]) => void) => {
        cb(null);
        return vi.fn();
      },
    );

    const callback = vi.fn();
    const service = new UserService();
    service.subscribeToUserProfile("uid-abc", callback);

    expect(callback).toHaveBeenCalledWith(null);
  });

  it("returns a callable unsubscribe function", () => {
    const unsubFn = vi.fn();
    mockUserDao.subscribe.mockReturnValue(unsubFn);

    const service = new UserService();
    const unsub = service.subscribeToUserProfile("uid-abc", vi.fn());

    unsub();
    expect(unsubFn).toHaveBeenCalledOnce();
  });
});
