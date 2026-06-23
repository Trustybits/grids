// Unit tests for StubbedBusinessStatsDao — aggregate/daily reads return cloned
// snapshots or null; getDailyRange filters by inclusive date bounds and returns
// results sorted ascending by date.
import { describe, it, expect, beforeEach } from "vitest";
import { StubbedBusinessStatsDao } from "../StubbedBusinessStatsDao";
import type {
  BusinessStats,
  DailyBusinessStats,
} from "@grids/contracts/types";
import { memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase } from "./memoryTestUtils";

function daily(date: string): DailyBusinessStats {
  return { date } as unknown as DailyBusinessStats;
}

let dao: StubbedBusinessStatsDao;

beforeEach(() => {
  resetMemoryDatabase();
  dao = new StubbedBusinessStatsDao();
});

describe("StubbedBusinessStatsDao.getAggregate", () => {
  it("returns null when no aggregate is stored", async () => {
    expect(await dao.getAggregate()).toBeNull();
  });

  it("returns a clone of the stored aggregate", async () => {
    const stats = { totalUsers: 5 } as unknown as BusinessStats;
    memoryDatabase.businessStats = stats;

    const result = await dao.getAggregate();
    expect(result).toEqual(stats);
    expect(result).not.toBe(stats);
  });
});

describe("StubbedBusinessStatsDao.getDaily", () => {
  it("returns null when no daily stats exist for the date", async () => {
    expect(await dao.getDaily("2024-01-01")).toBeNull();
  });

  it("returns a clone of the stored daily stats", async () => {
    const stats = daily("2024-01-01");
    memoryDatabase.businessDailyStats.set("2024-01-01", stats);

    const result = await dao.getDaily("2024-01-01");
    expect(result).toEqual(stats);
    expect(result).not.toBe(stats);
  });
});

describe("StubbedBusinessStatsDao.getDailyRange", () => {
  beforeEach(() => {
    for (const d of ["2024-01-03", "2024-01-01", "2024-01-05", "2024-01-02"]) {
      memoryDatabase.businessDailyStats.set(d, daily(d));
    }
  });

  it("returns dates within the inclusive range sorted ascending", async () => {
    const result = await dao.getDailyRange("2024-01-01", "2024-01-03");
    expect(result.map((s) => s.date)).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
    ]);
  });

  it("includes the boundary dates", async () => {
    const result = await dao.getDailyRange("2024-01-02", "2024-01-05");
    expect(result.map((s) => s.date)).toEqual([
      "2024-01-02",
      "2024-01-03",
      "2024-01-05",
    ]);
  });

  it("returns an empty array when nothing falls in range", async () => {
    expect(await dao.getDailyRange("2025-01-01", "2025-12-31")).toEqual([]);
  });

  it("returns clones of the stored entries", async () => {
    const stored = memoryDatabase.businessDailyStats.get("2024-01-01");
    const result = await dao.getDailyRange("2024-01-01", "2024-01-01");
    expect(result[0]).toEqual(stored);
    expect(result[0]).not.toBe(stored);
  });
});
