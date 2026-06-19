import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGridStore,
  gridHarness,
  makeGrid,
  resetGridHarness,
} from "./gridTestHarness";

describe("grid store collection behavior", () => {
  let store: Awaited<ReturnType<typeof createGridStore>>;

  beforeEach(async () => {
    resetGridHarness();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    store = await createGridStore();
  });

  it("rejects collection fetches without an authenticated user", async () => {
    gridHarness.authProvider.getCurrentUserId.mockReturnValue(null);

    await store.fetchGrids();

    expect(store.grids).toEqual([]);
    expect(store.error).toBe("User not authenticated");
    expect(store.isLoading).toBe(false);
    expect(gridHarness.gridService.fetchGridsByUserId).not.toHaveBeenCalled();
  });

  it("fetches grids and recent IDs for the authenticated user", async () => {
    const grids = [makeGrid(), makeGrid({ id: "grid-2" })];
    gridHarness.gridService.fetchGridsByUserId.mockResolvedValueOnce(grids);
    gridHarness.gridService.loadRecentGridIds.mockResolvedValueOnce([
      "grid-2",
      "grid-1",
    ]);

    await store.fetchGrids();

    expect(gridHarness.gridService.fetchGridsByUserId).toHaveBeenCalledWith(
      "user-1",
    );
    expect(gridHarness.gridService.loadRecentGridIds).toHaveBeenCalledWith(
      "user-1",
    );
    expect(store.grids).toEqual(grids);
    expect(store.recentGridIds).toEqual(["grid-2", "grid-1"]);
    expect(store.error).toBeNull();
    expect(store.isLoading).toBe(false);
  });

  it("exposes a collection fetch failure and leaves loading state", async () => {
    gridHarness.gridService.fetchGridsByUserId.mockRejectedValueOnce(
      new Error("fetch failed"),
    );

    await store.fetchGrids();

    expect(store.grids).toEqual([]);
    expect(store.error).toBe("Failed to fetch grids.");
    expect(store.isLoading).toBe(false);
  });

  it("creates a grid with an explicit name and appends a copy", async () => {
    const created = makeGrid({ id: "created", name: "Portfolio" });
    gridHarness.gridService.createGridWithStarterTiles.mockResolvedValueOnce(
      created,
    );

    const id = await store.createGrid("Portfolio");

    expect(id).toBe("created");
    expect(
      gridHarness.gridService.createGridWithStarterTiles,
    ).toHaveBeenCalledWith("user-1", "Portfolio");
    expect(store.grids).toEqual([created]);
    expect(store.grids[0]).not.toBe(created);
  });

  it("generates the legacy default grid name from collection length", async () => {
    store.grids = [makeGrid({ id: "existing" })];

    await store.createGrid("");

    expect(
      gridHarness.gridService.createGridWithStarterTiles,
    ).toHaveBeenCalledWith("user-1", "Grid 2");
  });

  it("returns null when grid creation is unauthenticated or fails", async () => {
    gridHarness.authProvider.getCurrentUserId.mockReturnValue(null);

    await expect(store.createGrid("Nope")).resolves.toBeNull();
    expect(store.error).toBe("User not authenticated");

    gridHarness.authProvider.getCurrentUserId.mockReturnValue("user-1");
    gridHarness.gridService.createGridWithStarterTiles.mockRejectedValueOnce(
      new Error("create failed"),
    );

    await expect(store.createGrid("Nope")).resolves.toBeNull();
    expect(store.error).toBe("Failed to create grid.");
  });

  it.each(["full", "structure"] as const)(
    "duplicates a grid with %s copy depth and appends the result",
    async (copyDepth) => {
      const source = makeGrid({ id: "source" });
      const clone = makeGrid({ id: `clone-${copyDepth}` });
      gridHarness.gridService.cloneAndPersistGrid.mockResolvedValueOnce(clone);

      const id = await store.duplicateGrid(source, copyDepth);

      expect(id).toBe(clone.id);
      expect(
        gridHarness.gridService.cloneAndPersistGrid,
      ).toHaveBeenCalledWith("user-1", source, copyDepth);
      expect(store.grids).toEqual([clone]);
      expect(store.grids[0]).not.toBe(clone);
    },
  );

  it("returns null when duplication is unauthenticated or fails", async () => {
    const source = makeGrid();
    gridHarness.authProvider.getCurrentUserId.mockReturnValue(null);

    await expect(store.duplicateGrid(source)).resolves.toBeNull();
    expect(store.error).toBe("User not authenticated");

    gridHarness.authProvider.getCurrentUserId.mockReturnValue("user-1");
    gridHarness.gridService.cloneAndPersistGrid.mockRejectedValueOnce(
      new Error("clone failed"),
    );

    await expect(store.duplicateGrid(source)).resolves.toBeNull();
    expect(store.error).toBe("Failed to duplicate grid.");
  });

  it("deduplicates, prepends, and limits recent grids to three", async () => {
    store.recentGridIds = ["grid-2", "grid-1", "grid-3"];

    store.recordRecent("grid-1");
    await vi.waitFor(() => {
      expect(gridHarness.gridService.saveRecentGridIds).toHaveBeenCalled();
    });

    expect(store.recentGridIds).toEqual(["grid-1", "grid-2", "grid-3"]);
    expect(gridHarness.gridService.saveRecentGridIds).toHaveBeenCalledWith(
      "user-1",
      ["grid-1", "grid-2", "grid-3"],
    );
  });

  it("loads and saves recents only for authenticated users", async () => {
    gridHarness.gridService.loadRecentGridIds.mockResolvedValueOnce([
      "grid-3",
    ]);

    await store.loadRecents();
    expect(store.recentGridIds).toEqual(["grid-3"]);

    await store.saveRecents();
    expect(gridHarness.gridService.saveRecentGridIds).toHaveBeenCalledWith(
      "user-1",
      ["grid-3"],
    );

    gridHarness.authProvider.getCurrentUserId.mockReturnValue(null);
    gridHarness.gridService.loadRecentGridIds.mockClear();
    gridHarness.gridService.saveRecentGridIds.mockClear();

    await store.loadRecents();
    await store.saveRecents();

    expect(gridHarness.gridService.loadRecentGridIds).not.toHaveBeenCalled();
    expect(gridHarness.gridService.saveRecentGridIds).not.toHaveBeenCalled();
  });

  it("logs recent-grid failures without replacing existing state", async () => {
    store.recentGridIds = ["existing"];
    gridHarness.gridService.loadRecentGridIds.mockRejectedValueOnce(
      new Error("load recents failed"),
    );
    gridHarness.gridService.saveRecentGridIds.mockRejectedValueOnce(
      new Error("save recents failed"),
    );

    await store.loadRecents();
    await store.saveRecents();

    expect(store.recentGridIds).toEqual(["existing"]);
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it("deletes an owned grid and clears a matching active grid", async () => {
    const owned = makeGrid({ id: "owned" });
    const other = makeGrid({ id: "other" });
    store.grids = [owned, other];
    store.currentGrid = owned;

    await store.deleteGrid("owned");

    expect(gridHarness.gridService.deleteGrid).toHaveBeenCalledWith("owned");
    expect(store.grids).toEqual([other]);
    expect(store.currentGrid).toBeNull();
  });

  it("does not delete a missing, unauthenticated, or foreign grid", async () => {
    store.grids = [makeGrid({ id: "foreign", userId: "other-user" })];

    await store.deleteGrid("missing");
    await store.deleteGrid("foreign");
    gridHarness.authProvider.getCurrentUserId.mockReturnValue(null);
    await store.deleteGrid("foreign");

    expect(gridHarness.gridService.deleteGrid).not.toHaveBeenCalled();
  });

  it("exposes deletion failures without changing collection state", async () => {
    const grid = makeGrid({ id: "owned" });
    store.grids = [grid];
    gridHarness.gridService.deleteGrid.mockRejectedValueOnce(
      new Error("delete failed"),
    );

    await store.deleteGrid("owned");

    expect(store.grids).toEqual([grid]);
    expect(store.error).toBe("Failed to delete grid.");
  });

  it("renames the collection entry and matching active grid after persistence", async () => {
    const collectionGrid = makeGrid({ id: "grid-1", name: "Old" });
    store.grids = [collectionGrid];
    store.currentGrid = makeGrid({ id: "grid-1", name: "Old" });

    await store.renameGrid("grid-1", "New");

    expect(collectionGrid.name).toBe("New");
    expect(gridHarness.gridService.updateGrid).toHaveBeenCalledWith(
      collectionGrid,
    );
    expect(store.currentGrid.name).toBe("New");
  });

  it("rethrows rename failures after exposing the store error", async () => {
    store.grids = [makeGrid()];
    gridHarness.gridService.updateGrid.mockRejectedValueOnce(
      new Error("rename failed"),
    );

    await expect(store.renameGrid("grid-1", "New")).rejects.toThrow(
      "rename failed",
    );
    expect(store.error).toBe("Failed to rename grid.");

    await expect(store.renameGrid("missing", "New")).rejects.toThrow(
      "Grid not found",
    );
  });
});
