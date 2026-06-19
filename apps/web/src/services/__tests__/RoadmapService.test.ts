// Unit tests for RoadmapService — RoadmapDao is mocked via the DAO factory
// singleton. This service is a thin pass-through to the DAO.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoadmapService } from "@/services/RoadmapService";
import type { RoadmapDao } from "@grids/contracts/dao";
import type { RoadmapQueryFilter } from "@grids/contracts/types";
import { registerTestDaoFactory } from "./testHelpers";

let mockRoadmapDao: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  mockRoadmapDao = {
    listDatabases: vi.fn(),
    fetchRoadmap: vi.fn(),
  };

  registerTestDaoFactory({
    getRoadmapDao: () => mockRoadmapDao as unknown as RoadmapDao,
  });
});

describe("constructor", () => {
  it("resolves the RoadmapDao from the factory", () => {
    const getRoadmapDao = vi.fn(
      () => mockRoadmapDao as unknown as RoadmapDao,
    );
    registerTestDaoFactory({
      getRoadmapDao,
    });

    new RoadmapService();

    expect(getRoadmapDao).toHaveBeenCalledTimes(1);
  });
});

describe("listDatabases", () => {
  it("delegates to roadmapDao.listDatabases and returns the result", async () => {
    const databases = [{ id: "db1", title: "Roadmap" }];
    mockRoadmapDao.listDatabases.mockResolvedValueOnce(databases);

    const service = new RoadmapService();
    const result = await service.listDatabases("g1", "t1");

    expect(mockRoadmapDao.listDatabases).toHaveBeenCalledWith("g1", "t1");
    expect(result).toBe(databases);
  });

  it("propagates errors from the DAO", async () => {
    mockRoadmapDao.listDatabases.mockRejectedValueOnce(new Error("notion 500"));

    const service = new RoadmapService();
    await expect(service.listDatabases("g1", "t1")).rejects.toThrow(
      "notion 500",
    );
  });
});

describe("fetchRoadmap", () => {
  it("delegates with all arguments including filters and db override", async () => {
    const result = { items: [], options: [] };
    mockRoadmapDao.fetchRoadmap.mockResolvedValueOnce(result);
    const filters: RoadmapQueryFilter[] = [
      { property: "Status", value: "Done" } as unknown as RoadmapQueryFilter,
    ];

    const service = new RoadmapService();
    const out = await service.fetchRoadmap("g1", "t1", filters, "db-override");

    expect(mockRoadmapDao.fetchRoadmap).toHaveBeenCalledWith(
      "g1",
      "t1",
      filters,
      "db-override",
    );
    expect(out).toBe(result);
  });

  it("passes undefined for optional filters and override when omitted", async () => {
    mockRoadmapDao.fetchRoadmap.mockResolvedValueOnce({ items: [] });

    const service = new RoadmapService();
    await service.fetchRoadmap("g1", "t1");

    expect(mockRoadmapDao.fetchRoadmap).toHaveBeenCalledWith(
      "g1",
      "t1",
      undefined,
      undefined,
    );
  });

  it("propagates errors from the DAO", async () => {
    mockRoadmapDao.fetchRoadmap.mockRejectedValueOnce(new Error("fetch failed"));

    const service = new RoadmapService();
    await expect(service.fetchRoadmap("g1", "t1")).rejects.toThrow(
      "fetch failed",
    );
  });
});
