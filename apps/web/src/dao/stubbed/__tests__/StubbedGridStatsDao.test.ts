// Unit tests for StubbedGridStatsDao — per-grid aggregate/daily reads return
// cloned snapshots or null; getDailyRange filters by gridId and inclusive date
// bounds, sorted ascending by date.
import { describe, it, expect, beforeEach } from "vitest";
import { StubbedGridStatsDao } from "../StubbedGridStatsDao";
import type { DailyGridStats, GridStats } from "@grids/contracts/types";
import { memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase } from "./memoryTestUtils";

function daily(gridId: string, date: string): DailyGridStats {
  return { gridId, date } as unknown as DailyGridStats;
}

let dao: StubbedGridStatsDao;

beforeEach(() => {
  resetMemoryDatabase();
  dao = new StubbedGridStatsDao();
});

describe("StubbedGridStatsDao.getAggregate", () => {
  it("returns null when no aggregate exists for the grid", async () => {
    expect(await dao.getAggregate("grid-1")).toBeNull();
  });

  it("returns a clone of the stored aggregate", async () => {
    const stats = { views: 10 } as unknown as GridStats;
    memoryDatabase.gridStats.set("grid-1", stats);

    const result = await dao.getAggregate("grid-1");
    expect(result).toEqual(stats);
    expect(result).not.toBe(stats);
  });
});

describe("StubbedGridStatsDao.getDaily", () => {
  it("returns null when no daily stats exist", async () => {
    expect(await dao.getDaily("grid-1", "2024-01-01")).toBeNull();
  });

  it("keys daily stats by gridId and date", async () => {
    const stats = daily("grid-1", "2024-01-01");
    memoryDatabase.gridDailyStats.set("grid-1__2024-01-01", stats);

    expect(await dao.getDaily("grid-1", "2024-01-01")).toEqual(stats);
    // A different grid with the same date must not collide.
    expect(await dao.getDaily("grid-2", "2024-01-01")).toBeNull();
  });

  it("returns a clone of the stored daily stats", async () => {
    const stats = daily("grid-1", "2024-01-01");
    memoryDatabase.gridDailyStats.set("grid-1__2024-01-01", stats);

    const result = await dao.getDaily("grid-1", "2024-01-01");
    expect(result).not.toBe(stats);
  });
});

describe("StubbedGridStatsDao.getDailyRange", () => {
  beforeEach(() => {
    memoryDatabase.gridDailyStats.set(
      "grid-1__2024-01-03",
      daily("grid-1", "2024-01-03"),
    );
    memoryDatabase.gridDailyStats.set(
      "grid-1__2024-01-01",
      daily("grid-1", "2024-01-01"),
    );
    memoryDatabase.gridDailyStats.set(
      "grid-1__2024-01-05",
      daily("grid-1", "2024-01-05"),
    );
    memoryDatabase.gridDailyStats.set(
      "grid-2__2024-01-02",
      daily("grid-2", "2024-01-02"),
    );
  });

  it("filters by gridId and inclusive date range, sorted ascending", async () => {
    const result = await dao.getDailyRange("grid-1", "2024-01-01", "2024-01-03");
    expect(result.map((s) => s.date)).toEqual(["2024-01-01", "2024-01-03"]);
  });

  it("excludes other grids' stats even within the date range", async () => {
    const result = await dao.getDailyRange("grid-2", "2024-01-01", "2024-01-05");
    expect(result.map((s) => s.gridId)).toEqual(["grid-2"]);
  });

  it("returns an empty array when nothing matches", async () => {
    expect(
      await dao.getDailyRange("grid-1", "2025-01-01", "2025-12-31"),
    ).toEqual([]);
  });

  it("returns clones of the stored entries", async () => {
    const stored = memoryDatabase.gridDailyStats.get("grid-1__2024-01-01");
    const result = await dao.getDailyRange("grid-1", "2024-01-01", "2024-01-01");
    expect(result[0]).not.toBe(stored);
  });
});
