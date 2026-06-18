// Unit tests for BadgeService — the BadgeDao is mocked via the DAO factory singleton.
// console.error is spied on so the error-path logging is silenced and asserted on.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BadgeService } from "@/services/BadgeService";
import type { BadgeDao } from "@grids/contracts/dao";
import type { UserBadges } from "@grids/contracts/types";
import { mockConsoleError, registerTestDaoFactory } from "./testHelpers";

let mockBadgeDao: Record<string, ReturnType<typeof vi.fn>>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockBadgeDao = {
    getById: vi.fn(),
    subscribe: vi.fn(),
  };

  registerTestDaoFactory({
    getBadgeDao: () => mockBadgeDao as unknown as BadgeDao,
  });

  consoleErrorSpy = mockConsoleError();
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ── constructor ────────────────────────────────────────────────────────────

describe("constructor", () => {
  it("resolves the BadgeDao from the factory at construction time", () => {
    const getBadgeDao = vi.fn(() => mockBadgeDao as unknown as BadgeDao);
    registerTestDaoFactory({
      getBadgeDao,
    });

    new BadgeService();

    expect(getBadgeDao).toHaveBeenCalledTimes(1);
  });
});

// ── getBadges ────────────────────────────────────────────────────────────

describe("getBadges", () => {
  it("returns the user badges when the document exists", async () => {
    const badges = { userId: "u1", badges: ["supporter"] } as unknown as UserBadges;
    mockBadgeDao.getById.mockResolvedValueOnce(badges);

    const service = new BadgeService();
    const result = await service.getBadges("u1");

    expect(result).toBe(badges);
    expect(mockBadgeDao.getById).toHaveBeenCalledWith("u1");
  });

  it("returns null when the document does not exist", async () => {
    mockBadgeDao.getById.mockResolvedValueOnce(null);

    const service = new BadgeService();
    const result = await service.getBadges("u1");

    expect(result).toBeNull();
  });

  it("rethrows and logs when the DAO throws", async () => {
    mockBadgeDao.getById.mockRejectedValueOnce(new Error("DB down"));

    const service = new BadgeService();
    await expect(service.getBadges("u1")).rejects.toThrow("DB down");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error fetching user badges:",
      expect.any(Error),
    );
  });

  it("does not log on the happy path", async () => {
    mockBadgeDao.getById.mockResolvedValueOnce(null);

    const service = new BadgeService();
    await service.getBadges("u1");

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// ── subscribeToBadges ──────────────────────────────────────────────────────

describe("subscribeToBadges", () => {
  it("delegates to badgeDao.subscribe and returns its unsubscribe fn", () => {
    const unsub = vi.fn();
    mockBadgeDao.subscribe.mockReturnValueOnce(unsub);
    const callback = vi.fn();

    const service = new BadgeService();
    const result = service.subscribeToBadges("u1", callback);

    expect(mockBadgeDao.subscribe).toHaveBeenCalledWith("u1", callback);
    expect(result).toBe(unsub);
  });

  it("forwards the same callback reference (no wrapping)", () => {
    mockBadgeDao.subscribe.mockReturnValueOnce(vi.fn());
    const callback = vi.fn();

    const service = new BadgeService();
    service.subscribeToBadges("u1", callback);

    const passedCallback = mockBadgeDao.subscribe.mock.calls[0][1];
    expect(passedCallback).toBe(callback);
  });
});
