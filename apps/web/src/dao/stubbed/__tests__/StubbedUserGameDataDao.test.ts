// Unit tests for StubbedUserGameDataDao — game-state CRUD plus the daily-capped
// click transaction and leaderboard reads. Covers create/update defaulting,
// field increments (including the requireData guard), the daily reset + 100/day
// cap, and leaderboard ordering.
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { StubbedUserGameDataDao } from "../StubbedUserGameDataDao";
import type { UserGameData } from "@grids/contracts/types";
import { memoryDatabase, todayIsoDate } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase, flushMicrotasks } from "./memoryTestUtils";

let dao: StubbedUserGameDataDao;

beforeEach(() => {
  resetMemoryDatabase();
  dao = new StubbedUserGameDataDao();
});

afterEach(() => {
  vi.useRealTimers();
});

function seed(userId: string, overrides: Partial<UserGameData> = {}): void {
  memoryDatabase.userGameData.set(userId, {
    userId,
    displayName: "Player",
    totalClicks: 0,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  });
}

describe("StubbedUserGameDataDao.getById", () => {
  it("returns null when there is no game data", async () => {
    expect(await dao.getById("missing")).toBeNull();
  });

  it("returns a clone of the stored data", async () => {
    seed("user-1");
    const stored = memoryDatabase.userGameData.get("user-1");
    const result = await dao.getById("user-1");

    expect(result).toEqual(stored);
    expect(result).not.toBe(stored);
  });
});

describe("StubbedUserGameDataDao.create", () => {
  it("creates a record with defaults for absent fields", async () => {
    await dao.create("user-1", {});
    const stored = memoryDatabase.userGameData.get("user-1");

    expect(stored).toMatchObject({
      userId: "user-1",
      displayName: "",
      totalClicks: 0,
    });
    expect(stored?.createdAt).toBeInstanceOf(Date);
    expect(stored?.updatedAt).toBeInstanceOf(Date);
  });

  it("uses the provided field values", async () => {
    await dao.create("user-1", {
      displayName: "Ada",
      totalClicks: 7,
      dailyClicks: 3,
      passiveBoost: 1.5,
    });

    expect(memoryDatabase.userGameData.get("user-1")).toMatchObject({
      displayName: "Ada",
      totalClicks: 7,
      dailyClicks: 3,
      passiveBoost: 1.5,
    });
  });
});

describe("StubbedUserGameDataDao.update", () => {
  it("preserves createdAt and refreshes updatedAt", async () => {
    const created = new Date("2024-01-01T00:00:00.000Z");
    seed("user-1", { createdAt: created, updatedAt: created });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T00:00:00.000Z"));
    await dao.update("user-1", { totalClicks: 5 });

    const stored = memoryDatabase.userGameData.get("user-1");
    expect(stored?.createdAt.getTime()).toBe(created.getTime());
    expect(stored?.updatedAt.getTime()).toBe(
      new Date("2026-06-18T00:00:00.000Z").getTime(),
    );
    expect(stored?.totalClicks).toBe(5);
  });

  it("falls back to existing values for fields not provided", async () => {
    seed("user-1", { displayName: "Ada", totalClicks: 9 });
    await dao.update("user-1", { totalClicks: 12 });

    const stored = memoryDatabase.userGameData.get("user-1");
    expect(stored?.displayName).toBe("Ada");
    expect(stored?.totalClicks).toBe(12);
  });

  it("defaults displayName and totalClicks when neither input nor existing has them", async () => {
    await dao.update("user-1", {});
    expect(memoryDatabase.userGameData.get("user-1")).toMatchObject({
      displayName: "",
      totalClicks: 0,
    });
  });
});

describe("StubbedUserGameDataDao.incrementFields", () => {
  it("adds the given amounts to numeric fields", async () => {
    seed("user-1", { totalClicks: 10, totalPassiveClicks: 2 });
    await dao.incrementFields("user-1", {
      totalClicks: 5,
      totalPassiveClicks: 3,
    });

    const stored = memoryDatabase.userGameData.get("user-1");
    expect(stored?.totalClicks).toBe(15);
    expect(stored?.totalPassiveClicks).toBe(5);
  });

  it("treats a missing numeric field as zero before incrementing", async () => {
    seed("user-1");
    await dao.incrementFields("user-1", { totalPassiveClicks: 4 });

    expect(
      memoryDatabase.userGameData.get("user-1")?.totalPassiveClicks,
    ).toBe(4);
  });

  it("throws DOCUMENT_NOT_FOUND when the user has no game data", async () => {
    await expect(
      dao.incrementFields("missing", { totalClicks: 1 }),
    ).rejects.toThrow("DOCUMENT_NOT_FOUND");
  });
});

describe("StubbedUserGameDataDao.incrementClicksTransaction", () => {
  it("throws DOCUMENT_NOT_FOUND when the user has no game data", async () => {
    await expect(
      dao.incrementClicksTransaction("missing", 1),
    ).rejects.toThrow("DOCUMENT_NOT_FOUND");
  });

  it("increments total and daily clicks within the cap", async () => {
    seed("user-1", {
      totalClicks: 10,
      dailyClicks: 5,
      lastClickDate: todayIsoDate(),
    });

    const result = await dao.incrementClicksTransaction("user-1", 3);

    expect(result).toBe(true);
    const stored = memoryDatabase.userGameData.get("user-1");
    expect(stored?.totalClicks).toBe(13);
    expect(stored?.dailyClicks).toBe(8);
    expect(stored?.lastClickDate).toBe(todayIsoDate());
  });

  it("treats a same-day record with no dailyClicks as zero", async () => {
    seed("user-1", { totalClicks: 4, lastClickDate: todayIsoDate() });

    const result = await dao.incrementClicksTransaction("user-1", 3);

    expect(result).toBe(true);
    expect(memoryDatabase.userGameData.get("user-1")?.dailyClicks).toBe(3);
  });

  it("resets the daily count when the last click was on a previous day", async () => {
    seed("user-1", {
      totalClicks: 100,
      dailyClicks: 90,
      lastClickDate: "2020-01-01",
    });

    const result = await dao.incrementClicksTransaction("user-1", 10);

    expect(result).toBe(true);
    const stored = memoryDatabase.userGameData.get("user-1");
    expect(stored?.dailyClicks).toBe(10);
    expect(stored?.lastClickDate).toBe(todayIsoDate());
  });

  it("allows reaching exactly the 100/day cap", async () => {
    seed("user-1", { dailyClicks: 99, lastClickDate: todayIsoDate() });
    expect(await dao.incrementClicksTransaction("user-1", 1)).toBe(true);
    expect(memoryDatabase.userGameData.get("user-1")?.dailyClicks).toBe(100);
  });

  it("rejects an over-cap amount on a fresh day even after the daily reset", async () => {
    seed("user-1", { dailyClicks: 90, lastClickDate: "2020-01-01" });

    // New day resets dailyClicks to 0, but 101 still exceeds the cap.
    const result = await dao.incrementClicksTransaction("user-1", 101);

    expect(result).toBe(false);
    expect(memoryDatabase.userGameData.get("user-1")?.dailyClicks).toBe(90);
  });

  it("rejects an increment that would exceed the 100/day cap", async () => {
    seed("user-1", { dailyClicks: 99, lastClickDate: todayIsoDate() });

    const result = await dao.incrementClicksTransaction("user-1", 2);

    expect(result).toBe(false);
    // State must be unchanged when the cap is exceeded.
    expect(memoryDatabase.userGameData.get("user-1")?.dailyClicks).toBe(99);
  });
});

describe("StubbedUserGameDataDao.getLeaderboard", () => {
  it("returns entries ordered by totalClicks descending, limited to topN", async () => {
    seed("a", { totalClicks: 5 });
    seed("b", { totalClicks: 30 });
    seed("c", { totalClicks: 15 });

    const result = await dao.getLeaderboard(2);
    expect(result.map((e) => e.userId)).toEqual(["b", "c"]);
  });

  it("returns an empty array when there is no game data", async () => {
    expect(await dao.getLeaderboard(10)).toEqual([]);
  });
});

describe("StubbedUserGameDataDao.subscribe", () => {
  it("delivers the current data and live updates", async () => {
    const callback = vi.fn();
    dao.subscribe("user-1", callback);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledWith(null);

    await dao.create("user-1", { displayName: "Ada" });
    await flushMicrotasks();

    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({ displayName: "Ada" }),
    );
  });
});

describe("StubbedUserGameDataDao.subscribeToLeaderboard", () => {
  it("delivers the current leaderboard and updates on change", async () => {
    const callback = vi.fn();
    dao.subscribeToLeaderboard(10, callback);
    await flushMicrotasks();
    expect(callback).toHaveBeenLastCalledWith([]);

    await dao.create("user-1", { displayName: "Ada", totalClicks: 5 });
    await flushMicrotasks();

    expect(callback).toHaveBeenLastCalledWith([
      { userId: "user-1", displayName: "Ada", totalClicks: 5 },
    ]);
  });
});
