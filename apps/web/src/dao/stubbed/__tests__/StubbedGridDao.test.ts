// Unit tests for StubbedGridDao — CRUD against the in-memory grid map. Reads
// return normalized, cloned Grid objects; save/update normalize via toGrid and
// merge over any existing record; updateLastOpenedAt only touches existing grids.
import { describe, it, expect, beforeEach } from "vitest";
import { GridRevisionConflictError } from "@grids/contracts/dao";
import { StubbedGridDao } from "../StubbedGridDao";
import { memoryDatabase, toGrid } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase } from "./memoryTestUtils";

let dao: StubbedGridDao;

beforeEach(() => {
  resetMemoryDatabase();
  dao = new StubbedGridDao();
});

describe("StubbedGridDao.getById", () => {
  it("returns null when the grid does not exist", async () => {
    expect(await dao.getById("missing")).toBeNull();
  });

  it("returns a clone of the stored grid", async () => {
    const grid = toGrid("grid-1", { userId: "user-1" });
    memoryDatabase.grids.set("grid-1", grid);

    const result = await dao.getById("grid-1");
    expect(result).toEqual(grid);
    expect(result).not.toBe(grid);
  });
});

describe("StubbedGridDao.findByUserId", () => {
  beforeEach(() => {
    memoryDatabase.grids.set("g1", toGrid("g1", { userId: "user-1" }));
    memoryDatabase.grids.set("g2", toGrid("g2", { userId: "user-2" }));
    memoryDatabase.grids.set("g3", toGrid("g3", { userId: "user-1" }));
  });

  it("returns only grids owned by the user", async () => {
    const result = await dao.findByUserId("user-1");
    expect(result.map((g) => g.id).sort()).toEqual(["g1", "g3"]);
  });

  it("returns an empty array when the user owns no grids", async () => {
    expect(await dao.findByUserId("nobody")).toEqual([]);
  });

  it("returns clones, not stored references", async () => {
    const stored = memoryDatabase.grids.get("g1");
    const [result] = await dao.findByUserId("user-1");
    expect(result).not.toBe(stored);
  });
});

describe("StubbedGridDao.generateId", () => {
  it("returns a grid-prefixed id", () => {
    expect(dao.generateId()).toMatch(/^grid_/);
  });

  it("returns unique ids", () => {
    expect(dao.generateId()).not.toBe(dao.generateId());
  });
});

describe("StubbedGridDao.save", () => {
  it("creates a normalized grid from partial data", async () => {
    await dao.save("grid-1", { userId: "user-1", name: "My Grid" });

    const stored = memoryDatabase.grids.get("grid-1");
    expect(stored).toMatchObject({
      id: "grid-1",
      userId: "user-1",
      rev: 0,
      name: "My Grid",
      colNum: 12,
      duplicatable: false,
    });
  });

  it("merges new data over an existing grid", async () => {
    await dao.save("grid-1", { userId: "user-1", name: "Original" });
    await dao.save("grid-1", { name: "Renamed" });

    const stored = memoryDatabase.grids.get("grid-1");
    expect(stored?.name).toBe("Renamed");
    expect(stored?.userId).toBe("user-1");
  });

  it("checks the expected rev and writes the next rev", async () => {
    await dao.save("grid-1", { userId: "user-1", name: "Original", rev: 0 });
    await dao.save("grid-1", { name: "Renamed", rev: 1 }, 0);

    expect(memoryDatabase.grids.get("grid-1")?.rev).toBe(1);
  });

  it("rejects stale expected revs", async () => {
    await dao.save("grid-1", { userId: "user-1", name: "Original", rev: 2 });

    await expect(
      dao.save("grid-1", { name: "Stale", rev: 3 }, 1),
    ).rejects.toBeInstanceOf(GridRevisionConflictError);
    expect(memoryDatabase.grids.get("grid-1")?.name).toBe("Original");
  });
});

describe("StubbedGridDao.update", () => {
  it("merges new data over an existing grid", async () => {
    await dao.save("grid-1", { userId: "user-1", name: "Original" });
    await dao.update("grid-1", { name: "Updated" });

    const stored = memoryDatabase.grids.get("grid-1");
    expect(stored?.name).toBe("Updated");
    expect(stored?.userId).toBe("user-1");
  });

  it("creates the grid when it does not yet exist", async () => {
    await dao.update("grid-1", { userId: "user-1" });
    expect(memoryDatabase.grids.get("grid-1")?.userId).toBe("user-1");
  });

  it("treats missing existing rev as 0 for updates", async () => {
    await dao.save("grid-1", { userId: "user-1", name: "Original" });
    await dao.update("grid-1", { name: "Updated", rev: 1 }, 0);

    expect(memoryDatabase.grids.get("grid-1")?.rev).toBe(1);
  });
});

describe("StubbedGridDao.updateLastOpenedAt", () => {
  it("sets lastOpenedAt to a Date on an existing grid", async () => {
    memoryDatabase.grids.set("grid-1", toGrid("grid-1", { userId: "user-1" }));
    await dao.updateLastOpenedAt("grid-1");

    expect(memoryDatabase.grids.get("grid-1")?.lastOpenedAt).toBeInstanceOf(
      Date,
    );
  });

  it("preserves other fields when stamping lastOpenedAt", async () => {
    memoryDatabase.grids.set(
      "grid-1",
      toGrid("grid-1", { userId: "user-1", name: "Keep" }),
    );
    await dao.updateLastOpenedAt("grid-1");

    expect(memoryDatabase.grids.get("grid-1")?.name).toBe("Keep");
  });

  it("is a no-op when the grid does not exist", async () => {
    await dao.updateLastOpenedAt("missing");
    expect(memoryDatabase.grids.has("missing")).toBe(false);
  });
});

describe("StubbedGridDao.delete", () => {
  it("removes the grid", async () => {
    memoryDatabase.grids.set("grid-1", toGrid("grid-1", {}));
    await dao.delete("grid-1");
    expect(memoryDatabase.grids.has("grid-1")).toBe(false);
  });

  it("is a no-op for an unknown grid", async () => {
    await expect(dao.delete("missing")).resolves.toBeUndefined();
  });
});
