// Unit tests for GameDataService — the UserGameDataDao is mocked via the DAO
// factory singleton, and the NameGenerator + PassiveBoostCalculator utils are
// mocked so the unit is exercised in isolation. System time is faked where the
// service derives "today" or timestamps.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GameDataService } from "@/services/GameDataService";
import type { UserGameDataDao } from "@grids/contracts/dao";
import type { UserGameData, LeaderboardEntry } from "@grids/contracts/types";
import {
  mockConsoleError,
  mockConsoleWarn,
  registerTestDaoFactory,
} from "./testHelpers";

// ── Mock utils ───────────────────────────────────────────────────────────

vi.mock("@/utils/NameGenerator", () => ({
  generateSeededDisplayName: vi.fn((seed: string) => `Name(${seed})`),
}));

const calculatePassiveClicks = vi.fn();
vi.mock("@/utils/PassiveBoostCalculator", () => ({
  calculatePassiveClicks: (...args: unknown[]) =>
    calculatePassiveClicks(...args),
}));

let mockDao: Record<string, ReturnType<typeof vi.fn>>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockDao = {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    incrementFields: vi.fn(),
    incrementClicksTransaction: vi.fn(),
    subscribe: vi.fn(),
    getLeaderboard: vi.fn(),
    subscribeToLeaderboard: vi.fn(),
  };

  registerTestDaoFactory({
    getUserGameDataDao: () => mockDao as unknown as UserGameDataDao,
  });

  calculatePassiveClicks.mockReset();
  consoleErrorSpy = mockConsoleError();
  consoleWarnSpy = mockConsoleWarn();
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  vi.useRealTimers();
});

// ── getOrCreateUserGameData ──────────────────────────────────────────────

describe("getOrCreateUserGameData", () => {
  it("returns the existing document when present", async () => {
    const existing = { userId: "u1", totalClicks: 5 } as UserGameData;
    mockDao.getById.mockResolvedValueOnce(existing);

    const service = new GameDataService();
    const result = await service.getOrCreateUserGameData("u1");

    expect(result).toBe(existing);
    expect(mockDao.create).not.toHaveBeenCalled();
  });

  it("creates a new document with a seeded display name when none exists", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T10:00:00.000Z"));
    mockDao.getById.mockResolvedValueOnce(null);
    mockDao.create.mockResolvedValueOnce(undefined);

    const service = new GameDataService();
    const result = await service.getOrCreateUserGameData("u1");

    expect(mockDao.create).toHaveBeenCalledWith("u1", {
      displayName: "Name(u1)",
      totalClicks: 0,
      dailyClicks: 0,
      lastClickDate: "2026-06-16",
      passiveBoost: 0,
      totalPassiveClicks: 0,
    });
    expect(result).toMatchObject({
      userId: "u1",
      displayName: "Name(u1)",
      totalClicks: 0,
    });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it("propagates errors from the DAO create", async () => {
    mockDao.getById.mockResolvedValueOnce(null);
    mockDao.create.mockRejectedValueOnce(new Error("create failed"));

    const service = new GameDataService();
    await expect(service.getOrCreateUserGameData("u1")).rejects.toThrow(
      "create failed",
    );
  });
});

// ── checkDailyClickLimit ─────────────────────────────────────────────────

describe("checkDailyClickLimit", () => {
  it("allows clicks with a full cap when no document exists", async () => {
    mockDao.getById.mockResolvedValueOnce(null);

    const service = new GameDataService();
    const result = await service.checkDailyClickLimit("u1");

    expect(result).toEqual({ canClick: true, remaining: 100, dailyClicks: 0 });
  });

  it("resets the limit when lastClickDate is not today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T00:00:00.000Z"));
    mockDao.getById.mockResolvedValueOnce({
      lastClickDate: "2026-06-15",
      dailyClicks: 80,
    } as UserGameData);

    const service = new GameDataService();
    const result = await service.checkDailyClickLimit("u1");

    expect(result).toEqual({ canClick: true, remaining: 100, dailyClicks: 0 });
  });

  it("computes remaining for a partially-used day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T00:00:00.000Z"));
    mockDao.getById.mockResolvedValueOnce({
      lastClickDate: "2026-06-16",
      dailyClicks: 30,
    } as UserGameData);

    const service = new GameDataService();
    const result = await service.checkDailyClickLimit("u1");

    expect(result).toEqual({ canClick: true, remaining: 70, dailyClicks: 30 });
  });

  it("blocks clicks and clamps remaining to 0 when the cap is reached", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T00:00:00.000Z"));
    mockDao.getById.mockResolvedValueOnce({
      lastClickDate: "2026-06-16",
      dailyClicks: 100,
    } as UserGameData);

    const service = new GameDataService();
    const result = await service.checkDailyClickLimit("u1");

    expect(result).toEqual({ canClick: false, remaining: 0, dailyClicks: 100 });
  });

  it("clamps remaining to 0 when dailyClicks exceeds the cap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T00:00:00.000Z"));
    mockDao.getById.mockResolvedValueOnce({
      lastClickDate: "2026-06-16",
      dailyClicks: 120,
    } as UserGameData);

    const service = new GameDataService();
    const result = await service.checkDailyClickLimit("u1");

    expect(result).toEqual({ canClick: false, remaining: 0, dailyClicks: 120 });
  });

  it("treats a missing dailyClicks as 0 for a document dated today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T00:00:00.000Z"));
    mockDao.getById.mockResolvedValueOnce({
      lastClickDate: "2026-06-16",
    } as UserGameData);

    const service = new GameDataService();
    const result = await service.checkDailyClickLimit("u1");

    expect(result).toEqual({ canClick: true, remaining: 100, dailyClicks: 0 });
  });
});

// ── incrementUserClicks ──────────────────────────────────────────────────

describe("incrementUserClicks", () => {
  it("delegates to the transaction with a default amount of 1", async () => {
    mockDao.incrementClicksTransaction.mockResolvedValueOnce(true);

    const service = new GameDataService();
    const result = await service.incrementUserClicks("u1");

    expect(mockDao.incrementClicksTransaction).toHaveBeenCalledWith("u1", 1);
    expect(result).toBe(true);
  });

  it("passes a custom amount through", async () => {
    mockDao.incrementClicksTransaction.mockResolvedValueOnce(true);

    const service = new GameDataService();
    await service.incrementUserClicks("u1", 5);

    expect(mockDao.incrementClicksTransaction).toHaveBeenCalledWith("u1", 5);
  });

  it("returns false when the transaction returns false (cap reached)", async () => {
    mockDao.incrementClicksTransaction.mockResolvedValueOnce(false);

    const service = new GameDataService();
    expect(await service.incrementUserClicks("u1")).toBe(false);
  });

  it("creates the document and retries on DOCUMENT_NOT_FOUND", async () => {
    mockDao.incrementClicksTransaction
      .mockRejectedValueOnce(new Error("DOCUMENT_NOT_FOUND"))
      .mockResolvedValueOnce(true);
    mockDao.getById.mockResolvedValueOnce(null);
    mockDao.create.mockResolvedValueOnce(undefined);

    const service = new GameDataService();
    const result = await service.incrementUserClicks("u1", 2);

    expect(mockDao.create).toHaveBeenCalledTimes(1);
    expect(mockDao.incrementClicksTransaction).toHaveBeenCalledTimes(2);
    expect(mockDao.incrementClicksTransaction).toHaveBeenLastCalledWith("u1", 2);
    expect(result).toBe(true);
  });

  it("does not keep retrying when DOCUMENT_NOT_FOUND persists after recovery", async () => {
    mockDao.incrementClicksTransaction
      .mockRejectedValueOnce(new Error("DOCUMENT_NOT_FOUND"))
      .mockRejectedValueOnce(new Error("DOCUMENT_NOT_FOUND"));
    mockDao.getById.mockResolvedValue(null);
    mockDao.create.mockResolvedValue(undefined);

    const service = new GameDataService();
    const result = await service.incrementUserClicks("u1");

    expect(mockDao.create).toHaveBeenCalledTimes(1);
    expect(mockDao.incrementClicksTransaction).toHaveBeenCalledTimes(2);
    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error incrementing user clicks:",
      expect.any(Error),
    );
  });

  it("stops recursing when the post-create retry hits a different error", async () => {
    // After recovering the document, a non-NOT_FOUND error must NOT recurse
    // again — it falls through to the permission-denied / generic handling.
    mockDao.incrementClicksTransaction
      .mockRejectedValueOnce(new Error("DOCUMENT_NOT_FOUND"))
      .mockRejectedValueOnce({ code: "permission-denied" });
    mockDao.getById.mockResolvedValueOnce(null);
    mockDao.create.mockResolvedValueOnce(undefined);

    const service = new GameDataService();
    const result = await service.incrementUserClicks("u1");

    expect(mockDao.create).toHaveBeenCalledTimes(1);
    expect(mockDao.incrementClicksTransaction).toHaveBeenCalledTimes(2);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("returns false and warns when rejected by permission-denied", async () => {
    mockDao.incrementClicksTransaction.mockRejectedValueOnce({
      code: "permission-denied",
    });

    const service = new GameDataService();
    const result = await service.incrementUserClicks("u1");

    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("returns false and logs on an unexpected error", async () => {
    mockDao.incrementClicksTransaction.mockRejectedValueOnce(
      new Error("network blip"),
    );

    const service = new GameDataService();
    const result = await service.incrementUserClicks("u1");

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error incrementing user clicks:",
      expect.any(Error),
    );
  });
});

// ── subscribeToUserGameData ──────────────────────────────────────────────

describe("subscribeToUserGameData", () => {
  it("delegates to dao.subscribe and returns the unsubscribe fn", () => {
    const unsub = vi.fn();
    mockDao.subscribe.mockReturnValueOnce(unsub);

    const service = new GameDataService();
    const result = service.subscribeToUserGameData("u1", vi.fn());

    expect(mockDao.subscribe).toHaveBeenCalledWith("u1", expect.any(Function));
    expect(result).toBe(unsub);
  });

  it("forwards data to the callback when present", () => {
    const data = { userId: "u1" } as UserGameData;
    mockDao.subscribe.mockImplementation(
      (_id, cb: (d: UserGameData | null) => void) => {
        cb(data);
        return vi.fn();
      },
    );
    const callback = vi.fn();

    const service = new GameDataService();
    service.subscribeToUserGameData("u1", callback);

    expect(callback).toHaveBeenCalledWith(data);
  });

  it("does not invoke the callback when the document is null", () => {
    mockDao.subscribe.mockImplementation(
      (_id, cb: (d: UserGameData | null) => void) => {
        cb(null);
        return vi.fn();
      },
    );
    const callback = vi.fn();

    const service = new GameDataService();
    service.subscribeToUserGameData("u1", callback);

    expect(callback).not.toHaveBeenCalled();
  });
});

// ── getLeaderboard ───────────────────────────────────────────────────────

describe("getLeaderboard", () => {
  it("fetches the top N and assigns 1-based ranks", async () => {
    const entries = [
      { userId: "a", totalClicks: 30 },
      { userId: "b", totalClicks: 20 },
      { userId: "c", totalClicks: 10 },
    ] as LeaderboardEntry[];
    mockDao.getLeaderboard.mockResolvedValueOnce(entries);

    const service = new GameDataService();
    const result = await service.getLeaderboard(3);

    expect(mockDao.getLeaderboard).toHaveBeenCalledWith(3);
    expect(result.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(result[0]).toMatchObject({ userId: "a", rank: 1 });
  });

  it("defaults topN to 10", async () => {
    mockDao.getLeaderboard.mockResolvedValueOnce([]);

    const service = new GameDataService();
    await service.getLeaderboard();

    expect(mockDao.getLeaderboard).toHaveBeenCalledWith(10);
  });

  it("returns an empty list when there are no entries", async () => {
    mockDao.getLeaderboard.mockResolvedValueOnce([]);

    const service = new GameDataService();
    expect(await service.getLeaderboard()).toEqual([]);
  });
});

// ── subscribeToLeaderboard ───────────────────────────────────────────────

describe("subscribeToLeaderboard", () => {
  it("delegates to dao.subscribeToLeaderboard and returns the unsubscribe fn", () => {
    const unsub = vi.fn();
    mockDao.subscribeToLeaderboard.mockReturnValueOnce(unsub);

    const service = new GameDataService();
    const result = service.subscribeToLeaderboard(5, vi.fn());

    expect(mockDao.subscribeToLeaderboard).toHaveBeenCalledWith(
      5,
      expect.any(Function),
    );
    expect(result).toBe(unsub);
  });

  it("assigns ranks to entries before passing them to the callback", () => {
    const entries = [{ userId: "a" }, { userId: "b" }] as LeaderboardEntry[];
    mockDao.subscribeToLeaderboard.mockImplementation(
      (_n, cb: (e: LeaderboardEntry[]) => void) => {
        cb(entries);
        return vi.fn();
      },
    );
    const callback = vi.fn();

    const service = new GameDataService();
    service.subscribeToLeaderboard(2, callback);

    expect(callback).toHaveBeenCalledWith([
      { userId: "a", rank: 1 },
      { userId: "b", rank: 2 },
    ]);
  });

  it("defaults topN to 10", () => {
    mockDao.subscribeToLeaderboard.mockReturnValueOnce(vi.fn());

    const service = new GameDataService();
    service.subscribeToLeaderboard(undefined as unknown as number, vi.fn());

    expect(mockDao.subscribeToLeaderboard).toHaveBeenCalledWith(
      10,
      expect.any(Function),
    );
  });
});

// ── updateDisplayName ────────────────────────────────────────────────────

describe("updateDisplayName", () => {
  it("delegates to dao.update with the new display name", async () => {
    mockDao.update.mockResolvedValueOnce(undefined);

    const service = new GameDataService();
    await service.updateDisplayName("u1", "Cool Name");

    expect(mockDao.update).toHaveBeenCalledWith("u1", {
      displayName: "Cool Name",
    });
  });

  it("propagates errors from the DAO", async () => {
    mockDao.update.mockRejectedValueOnce(new Error("update failed"));

    const service = new GameDataService();
    await expect(service.updateDisplayName("u1", "x")).rejects.toThrow(
      "update failed",
    );
  });
});

// ── increasePassiveBoost ─────────────────────────────────────────────────

describe("increasePassiveBoost", () => {
  it("increments the passiveBoost field by the given amount", async () => {
    mockDao.incrementFields.mockResolvedValueOnce(undefined);

    const service = new GameDataService();
    await service.increasePassiveBoost("u1", 3);

    expect(mockDao.incrementFields).toHaveBeenCalledWith("u1", {
      passiveBoost: 3,
    });
  });
});

// ── addPassiveClicks ─────────────────────────────────────────────────────

describe("addPassiveClicks", () => {
  it("increments both totalClicks and totalPassiveClicks", async () => {
    mockDao.incrementFields.mockResolvedValueOnce(undefined);

    const service = new GameDataService();
    await service.addPassiveClicks("u1", 7);

    expect(mockDao.incrementFields).toHaveBeenCalledWith("u1", {
      totalClicks: 7,
      totalPassiveClicks: 7,
    });
  });
});

// ── getDailyClickCap ─────────────────────────────────────────────────────

describe("getDailyClickCap", () => {
  it("returns the daily click cap constant", () => {
    const service = new GameDataService();
    expect(service.getDailyClickCap()).toBe(100);
  });
});

// ── claimPassiveClicks ───────────────────────────────────────────────────

describe("claimPassiveClicks", () => {
  it("returns 0 when no document exists", async () => {
    mockDao.getById.mockResolvedValueOnce(null);

    const service = new GameDataService();
    expect(await service.claimPassiveClicks("u1")).toBe(0);
    expect(mockDao.incrementFields).not.toHaveBeenCalled();
  });

  it("credits computed passive clicks and returns the amount", async () => {
    const data = {
      userId: "u1",
      totalClicks: 200,
      updatedAt: new Date("2026-06-16T00:00:00.000Z"),
    } as UserGameData;
    mockDao.getById.mockResolvedValueOnce(data);
    calculatePassiveClicks.mockReturnValueOnce(42);
    mockDao.incrementFields.mockResolvedValueOnce(undefined);

    const service = new GameDataService();
    const result = await service.claimPassiveClicks("u1");

    expect(calculatePassiveClicks).toHaveBeenCalledWith(200, data.updatedAt);
    expect(mockDao.incrementFields).toHaveBeenCalledWith("u1", {
      totalClicks: 42,
      totalPassiveClicks: 42,
    });
    expect(result).toBe(42);
  });

  it("does not write when there are no passive clicks to claim", async () => {
    mockDao.getById.mockResolvedValueOnce({
      userId: "u1",
      totalClicks: 0,
      updatedAt: new Date(),
    } as UserGameData);
    calculatePassiveClicks.mockReturnValueOnce(0);

    const service = new GameDataService();
    const result = await service.claimPassiveClicks("u1");

    expect(mockDao.incrementFields).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});
