// Unit tests for StubbedRoadmapDao — both methods return fixed in-memory sample
// data regardless of arguments (no Notion integration in stub mode).
import { describe, it, expect, beforeEach } from "vitest";
import { StubbedRoadmapDao } from "../StubbedRoadmapDao";

let dao: StubbedRoadmapDao;

beforeEach(() => {
  dao = new StubbedRoadmapDao();
});

describe("StubbedRoadmapDao.listDatabases", () => {
  it("returns a single stubbed database descriptor", async () => {
    const result = await dao.listDatabases("grid-1", "tile-1");
    expect(result).toEqual([
      { id: "stubbed-roadmap-database", title: "Stubbed roadmap" },
    ]);
  });
});

describe("StubbedRoadmapDao.fetchRoadmap", () => {
  it("returns the fixed sample roadmap items", async () => {
    const result = await dao.fetchRoadmap("grid-1", "tile-1");

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.status)).toEqual([
      "backlog",
      "in_progress",
    ]);
    expect(result.items.every((i) => i.upvoteCount === 0)).toBe(true);
  });

  it("returns the fixed status property options", async () => {
    const result = await dao.fetchRoadmap("grid-1", "tile-1");

    expect(result.propertyOptions).toEqual([
      {
        name: "Status",
        type: "status",
        selectOptions: ["Backlog", "In Progress", "Done"],
      },
    ]);
  });

  it("ignores query filters and database override and still returns the stub", async () => {
    const result = await dao.fetchRoadmap(
      "grid-1",
      "tile-1",
      [{ property: "Status", value: "Done" } as never],
      "some-other-db",
    );
    expect(result.items).toHaveLength(2);
  });
});
