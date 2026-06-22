import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { Grid } from "@grids/contracts/types";
import { useGridCollectionStore } from "../gridCollection";

function makeGrid(id: string, name = id): Grid {
  return {
    id,
    userId: "user-1",
    name,
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
  };
}

describe("gridCollection store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with independent empty collection state", () => {
    const store = useGridCollectionStore();

    expect(store.grids).toEqual([]);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.recentGridIds).toEqual([]);
  });

  it("replaces, adds, updates, and removes collection entries", () => {
    const store = useGridCollectionStore();
    const first = makeGrid("grid-1", "First");
    const second = makeGrid("grid-2", "Second");

    store.setGrids([first]);
    store.addGrid(second);
    store.updateGrid("grid-1", { name: "Renamed" });
    store.updateGrid("missing", { name: "Ignored" });
    store.removeGrid("grid-2");

    expect(store.grids).toEqual([{ ...first, name: "Renamed" }]);
  });

  it("updates loading and error state explicitly", () => {
    const store = useGridCollectionStore();

    store.setLoading(true);
    store.setError("Failed to fetch grids.");

    expect(store.isLoading).toBe(true);
    expect(store.error).toBe("Failed to fetch grids.");

    store.setLoading(false);
    store.setError(null);

    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("replaces recent IDs and records at most three unique recents", () => {
    const store = useGridCollectionStore();

    store.setRecentGridIds(["grid-3", "grid-2", "grid-1"]);
    store.recordRecent("grid-2");
    store.recordRecent("grid-4");

    expect(store.recentGridIds).toEqual(["grid-4", "grid-2", "grid-3"]);
  });

  it("reset restores fresh defaults without retaining collection references", () => {
    const store = useGridCollectionStore();
    const previousGrids = store.grids;
    const previousRecents = store.recentGridIds;

    store.addGrid(makeGrid("grid-1"));
    store.setLoading(true);
    store.setError("error");
    store.recordRecent("grid-1");
    store.reset();

    expect(store.grids).toEqual([]);
    expect(store.grids).not.toBe(previousGrids);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.recentGridIds).toEqual([]);
    expect(store.recentGridIds).not.toBe(previousRecents);
  });
});
