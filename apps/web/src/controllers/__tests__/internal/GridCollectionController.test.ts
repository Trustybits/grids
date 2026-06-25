import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { GridCollectionController } from "../../internal/GridCollectionController";
import { createHarness, makeGrid, type InternalHarness } from "./harness";

/**
 * Tests for GridCollectionController — CRUD over the user's grid collection
 * (fetch/create/duplicate/rename/delete) and the recents list, including the
 * authentication guards and error-to-store reporting on each path.
 */

describe("GridCollectionController", () => {
  let h: InternalHarness;
  let clearSessionIfGridDeleted: Mock<(id: string) => void>;
  let controller: GridCollectionController;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    h = createHarness();
    clearSessionIfGridDeleted = vi.fn<(id: string) => void>();
    controller = new GridCollectionController(
      h.stores,
      h.dependencies,
      clearSessionIfGridDeleted,
    );
  });

  describe("fetchGrids", () => {
    it("errors and stops loading when unauthenticated", async () => {
      h.getCurrentUserId.mockReturnValue(null);

      await controller.fetchGrids();

      expect(h.stores.collection.error).toBe("User not authenticated");
      expect(h.stores.collection.isLoading).toBe(false);
      expect(h.gridService.fetchGridsByUserId).not.toHaveBeenCalled();
    });

    it("loads grids and recents on success", async () => {
      const grids = [makeGrid({ id: "g1" }), makeGrid({ id: "g2" })];
      vi.mocked(h.gridService.fetchGridsByUserId).mockResolvedValue(grids);
      vi.mocked(h.gridService.loadRecentGridIds).mockResolvedValue(["g2"]);

      await controller.fetchGrids();

      expect(h.stores.collection.grids).toEqual(grids);
      expect(h.stores.collection.recentGridIds).toEqual(["g2"]);
      expect(h.stores.collection.isLoading).toBe(false);
      expect(h.stores.collection.error).toBeNull();
    });

    it("records an error and clears loading when fetching throws", async () => {
      vi.mocked(h.gridService.fetchGridsByUserId).mockRejectedValue(
        new Error("boom"),
      );

      await controller.fetchGrids();

      expect(h.stores.collection.error).toBe("Failed to fetch grids.");
      expect(h.stores.collection.isLoading).toBe(false);
    });

    it("clears prior grids and error before fetching", async () => {
      // Seed stale state from a previous fetch.
      h.stores.collection.setGrids([makeGrid({ id: "stale" })]);
      h.stores.collection.setError("Old error");
      h.getCurrentUserId.mockReturnValue(null);

      await controller.fetchGrids();

      // The unauthenticated guard runs after the reset, so grids are emptied
      // and the prior error is replaced with the auth error.
      expect(h.stores.collection.grids).toEqual([]);
      expect(h.stores.collection.error).toBe("User not authenticated");
    });
  });

  describe("createGrid", () => {
    it("returns null and errors when unauthenticated", async () => {
      h.getCurrentUserId.mockReturnValue(null);
      expect(await controller.createGrid("My Grid")).toBeNull();
      expect(h.stores.collection.error).toBe("User not authenticated");
    });

    it("creates a grid with the provided name and adds it to the collection", async () => {
      const grid = makeGrid({ id: "new", name: "My Grid" });
      vi.mocked(h.gridService.createGridWithStarterTiles).mockResolvedValue(
        grid,
      );

      const id = await controller.createGrid("My Grid");

      expect(id).toBe("new");
      expect(h.gridService.createGridWithStarterTiles).toHaveBeenCalledWith(
        "user-1",
        "My Grid",
      );
      expect(h.stores.collection.grids).toHaveLength(1);
    });

    it("derives a default name from the collection size when name is blank", async () => {
      h.stores.collection.setGrids([makeGrid({ id: "a" })]);
      vi.mocked(h.gridService.createGridWithStarterTiles).mockResolvedValue(
        makeGrid({ id: "new" }),
      );

      await controller.createGrid("");

      expect(h.gridService.createGridWithStarterTiles).toHaveBeenCalledWith(
        "user-1",
        "Grid 2",
      );
    });

    it("returns null and errors when creation throws", async () => {
      vi.mocked(h.gridService.createGridWithStarterTiles).mockRejectedValue(
        new Error("boom"),
      );
      expect(await controller.createGrid("x")).toBeNull();
      expect(h.stores.collection.error).toBe("Failed to create grid.");
    });
  });

  describe("duplicateGrid", () => {
    it("returns null when unauthenticated", async () => {
      h.getCurrentUserId.mockReturnValue(null);
      expect(await controller.duplicateGrid(makeGrid())).toBeNull();
      expect(h.stores.collection.error).toBe("User not authenticated");
    });

    it("clones with the default full copy depth and adds the result", async () => {
      const source = makeGrid({ id: "src" });
      const clone = makeGrid({ id: "clone" });
      vi.mocked(h.gridService.cloneAndPersistGrid).mockResolvedValue(clone);

      const id = await controller.duplicateGrid(source);

      expect(id).toBe("clone");
      expect(h.gridService.cloneAndPersistGrid).toHaveBeenCalledWith(
        "user-1",
        source,
        "full",
      );
      expect(h.stores.collection.grids).toContainEqual(clone);
    });

    it("forwards an explicit copy depth", async () => {
      vi.mocked(h.gridService.cloneAndPersistGrid).mockResolvedValue(
        makeGrid({ id: "clone" }),
      );
      await controller.duplicateGrid(makeGrid(), "structure");
      expect(h.gridService.cloneAndPersistGrid).toHaveBeenCalledWith(
        "user-1",
        expect.anything(),
        "structure",
      );
    });

    it("returns null and errors when cloning throws", async () => {
      vi.mocked(h.gridService.cloneAndPersistGrid).mockRejectedValue(
        new Error("boom"),
      );
      expect(await controller.duplicateGrid(makeGrid())).toBeNull();
      expect(h.stores.collection.error).toBe("Failed to duplicate grid.");
    });
  });

  describe("recents", () => {
    it("recordRecent updates the store and triggers a save", async () => {
      vi.mocked(h.gridService.saveRecentGridIds).mockResolvedValue(undefined);

      controller.recordRecent("g1");

      expect(h.stores.collection.recentGridIds).toEqual(["g1"]);
      await Promise.resolve();
      expect(h.gridService.saveRecentGridIds).toHaveBeenCalledWith("user-1", [
        "g1",
      ]);
    });

    it("recordRecent dedupes an existing id to the front", () => {
      h.stores.collection.setRecentGridIds(["a", "b", "c"]);

      controller.recordRecent("c");

      expect(h.stores.collection.recentGridIds).toEqual(["c", "a", "b"]);
    });

    it("recordRecent caps the recents list to three entries", () => {
      h.stores.collection.setRecentGridIds(["a", "b", "c"]);

      controller.recordRecent("d");

      expect(h.stores.collection.recentGridIds).toEqual(["d", "a", "b"]);
    });

    it("loadRecents is a no-op when unauthenticated", async () => {
      h.getCurrentUserId.mockReturnValue(null);
      await controller.loadRecents();
      expect(h.gridService.loadRecentGridIds).not.toHaveBeenCalled();
    });

    it("loadRecents populates the store on success", async () => {
      vi.mocked(h.gridService.loadRecentGridIds).mockResolvedValue([
        "a",
        "b",
      ]);
      await controller.loadRecents();
      expect(h.stores.collection.recentGridIds).toEqual(["a", "b"]);
    });

    it("loadRecents swallows errors", async () => {
      vi.mocked(h.gridService.loadRecentGridIds).mockRejectedValue(
        new Error("boom"),
      );
      await expect(controller.loadRecents()).resolves.toBeUndefined();
    });

    it("saveRecents is a no-op when unauthenticated", async () => {
      h.getCurrentUserId.mockReturnValue(null);
      await controller.saveRecents();
      expect(h.gridService.saveRecentGridIds).not.toHaveBeenCalled();
    });

    it("saveRecents swallows errors", async () => {
      vi.mocked(h.gridService.saveRecentGridIds).mockRejectedValue(
        new Error("boom"),
      );
      await expect(controller.saveRecents()).resolves.toBeUndefined();
    });
  });

  describe("renameGrid", () => {
    it("throws when the grid is not in the collection", async () => {
      await expect(controller.renameGrid("missing", "X")).rejects.toThrow(
        "Grid not found",
      );
      expect(h.stores.collection.error).toBe("Failed to rename grid.");
    });

    it("renames the collection grid and persists it", async () => {
      const grid = makeGrid({ id: "g1", name: "Old" });
      h.stores.collection.setGrids([grid]);
      vi.mocked(h.gridService.updateGrid).mockResolvedValue(undefined);

      await controller.renameGrid("g1", "New", null);

      expect(h.stores.collection.grids[0]?.name).toBe("New");
      expect(h.gridService.updateGrid).toHaveBeenCalledWith(
        expect.objectContaining({ id: "g1", name: "New" }),
      );
    });

    it("also renames the active grid when it matches", async () => {
      const collectionGrid = makeGrid({ id: "g1", name: "Old" });
      const activeGrid = makeGrid({ id: "g1", name: "Old" });
      h.stores.collection.setGrids([collectionGrid]);
      vi.mocked(h.gridService.updateGrid).mockResolvedValue(undefined);

      await controller.renameGrid("g1", "New", activeGrid);

      expect(activeGrid.name).toBe("New");
    });

    it("leaves a non-matching active grid's name untouched", async () => {
      const collectionGrid = makeGrid({ id: "g1", name: "Old" });
      const activeGrid = makeGrid({ id: "other", name: "Active" });
      h.stores.collection.setGrids([collectionGrid]);
      vi.mocked(h.gridService.updateGrid).mockResolvedValue(undefined);

      await controller.renameGrid("g1", "New", activeGrid);

      expect(collectionGrid.name).toBe("New");
      expect(activeGrid.name).toBe("Active");
    });

    it("re-throws and records an error when persistence fails", async () => {
      h.stores.collection.setGrids([makeGrid({ id: "g1" })]);
      vi.mocked(h.gridService.updateGrid).mockRejectedValue(
        new Error("boom"),
      );

      await expect(controller.renameGrid("g1", "New")).rejects.toThrow(
        "boom",
      );
      expect(h.stores.collection.error).toBe("Failed to rename grid.");
    });
  });

  describe("deleteGrid", () => {
    it("does nothing when unauthenticated", async () => {
      h.getCurrentUserId.mockReturnValue(null);
      h.stores.collection.setGrids([makeGrid({ id: "g1" })]);
      await controller.deleteGrid("g1");
      expect(h.gridService.deleteGrid).not.toHaveBeenCalled();
    });

    it("does nothing for an unknown grid id", async () => {
      await controller.deleteGrid("missing");
      expect(h.gridService.deleteGrid).not.toHaveBeenCalled();
    });

    it("does nothing for a grid owned by someone else", async () => {
      h.stores.collection.setGrids([
        makeGrid({ id: "g1", userId: "other" }),
      ]);
      await controller.deleteGrid("g1");
      expect(h.gridService.deleteGrid).not.toHaveBeenCalled();
    });

    it("deletes an owned grid and removes it from the collection", async () => {
      h.stores.collection.setGrids([
        makeGrid({ id: "g1" }),
        makeGrid({ id: "g2" }),
      ]);
      vi.mocked(h.gridService.deleteGrid).mockResolvedValue(undefined);

      await controller.deleteGrid("g1");

      expect(h.gridService.deleteGrid).toHaveBeenCalledWith("g1");
      expect(h.stores.collection.grids.map((g) => g.id)).toEqual(["g2"]);
    });

    it("invokes the explicit clearActiveGrid callback when deleting the active grid", async () => {
      const active = makeGrid({ id: "g1" });
      h.stores.collection.setGrids([active]);
      vi.mocked(h.gridService.deleteGrid).mockResolvedValue(undefined);
      const clearActiveGrid = vi.fn();

      await controller.deleteGrid("g1", active, clearActiveGrid);

      expect(clearActiveGrid).toHaveBeenCalledTimes(1);
      expect(clearSessionIfGridDeleted).not.toHaveBeenCalled();
    });

    it("falls back to clearSessionIfGridDeleted when no active match/callback", async () => {
      h.stores.collection.setGrids([makeGrid({ id: "g1" })]);
      vi.mocked(h.gridService.deleteGrid).mockResolvedValue(undefined);

      await controller.deleteGrid("g1", null);

      expect(clearSessionIfGridDeleted).toHaveBeenCalledWith("g1");
    });

    it("records an error and keeps the grid when deletion throws", async () => {
      const grid = makeGrid({ id: "g1" });
      h.stores.collection.setGrids([grid]);
      vi.mocked(h.gridService.deleteGrid).mockRejectedValue(
        new Error("boom"),
      );

      await controller.deleteGrid("g1");

      expect(h.stores.collection.grids).toEqual([grid]);
      expect(h.stores.collection.error).toBe("Failed to delete grid.");
    });
  });
});
