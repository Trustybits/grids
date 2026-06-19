import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGridStore,
  createLoadedGridStore,
  gridHarness,
  makeGrid,
  makeTile,
  resetGridHarness,
} from "./gridTestHarness";

describe("grid store viewport and breakpoint behavior", () => {
  beforeEach(() => {
    resetGridHarness();
  });

  it("sets active, viewport, forced breakpoint, and rendered positions", async () => {
    const store = await createLoadedGridStore();
    const positions = [{ i: "tile-1", x: 1, y: 2, w: 3, h: 4 }];

    store.setActiveBreakpoint("md");
    store.setViewportBreakpoint("sm");
    store.setForcedBreakpoint("md");
    store.setDisplayPositions(positions);

    expect(store.activeBreakpoint).toBe("md");
    expect(store.viewportBreakpoint).toBe("sm");
    expect(store.forcedBreakpoint).toBe("md");
    expect(store.displayPositions).toEqual(positions);
  });

  it("reports breakpoint positions and whether an override has entries", async () => {
    const store = await createLoadedGridStore(
      makeGrid({
        overrides: {
          md: {
            "tile-1": { x: 1, y: 2, w: 3, h: 4 },
          },
          sm: {},
        },
      }),
    );

    expect(store.getBreakpointPositions("md")).toEqual({
      "tile-1": { x: 1, y: 2, w: 3, h: 4 },
    });
    expect(store.hasBreakpointOverride("md")).toBe(true);
    expect(store.hasBreakpointOverride("sm")).toBe(false);
    expect(store.getBreakpointPositions("lg")).toBeUndefined();

    store.currentGrid = null;
    expect(store.getBreakpointPositions("md")).toBeUndefined();
  });

  it("returns zero viewport row when the grid element is absent", async () => {
    const store = await createGridStore();
    vi.spyOn(document, "querySelector").mockReturnValue(null);

    expect(store.getViewportGridY()).toBe(0);
  });

  it("converts viewport center to a non-negative grid row", async () => {
    const store = await createGridStore();
    vi.spyOn(document, "querySelector").mockReturnValue({
      getBoundingClientRect: () => ({ top: -200 }),
    } as HTMLElement);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);

    expect(store.getViewportGridY()).toBe(4);

    vi.mocked(document.querySelector).mockReturnValue({
      getBoundingClientRect: () => ({ top: 500 }),
    } as HTMLElement);
    expect(store.getViewportGridY()).toBe(0);
  });

  it("resizes the canonical desktop tile and matching rendered position", async () => {
    const store = await createLoadedGridStore();
    store.activeBreakpoint = "lg";
    store.setDisplayPositions([
      { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
    ]);

    store.resizeTile("tile-1", 5, 6);

    expect(store.currentGrid?.tiles[0]).toEqual(
      expect.objectContaining({ w: 5, h: 6 }),
    );
    expect(gridHarness.adjustTilePosition).toHaveBeenCalledWith(
      store.currentGrid?.tiles[0],
      12,
    );
    expect(store.displayPositions[0]).toEqual({
      i: "tile-1",
      x: 0,
      y: 0,
      w: 5,
      h: 6,
    });
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("seeds and clamps a medium breakpoint resize without changing base size", async () => {
    const tile = makeTile({ x: 7, y: 4, w: 2, h: 2 });
    const store = await createLoadedGridStore(
      makeGrid({ tiles: [tile], overrides: undefined }),
    );
    store.activeBreakpoint = "md";
    store.setDisplayPositions([
      { i: "tile-1", x: 7, y: 4, w: 2, h: 2 },
      { i: "tile-2", x: 0, y: 0, w: 3, h: 3 },
    ]);

    store.resizeTile("tile-1", 10, 6);

    expect(store.currentGrid?.tiles[0]).toEqual(
      expect.objectContaining({ x: 7, y: 4, w: 2, h: 2 }),
    );
    expect(store.currentGrid?.overrides?.md).toEqual({
      "tile-1": { x: 0, y: 4, w: 8, h: 6 },
      "tile-2": { x: 0, y: 0, w: 3, h: 3 },
    });
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("preserves existing override position while clamping a small resize", async () => {
    const store = await createLoadedGridStore(
      makeGrid({
        overrides: {
          sm: {
            "tile-1": { x: 3, y: 9, w: 1, h: 2 },
          },
        },
      }),
    );
    store.activeBreakpoint = "sm";

    store.resizeTile("tile-1", 3, 7);

    expect(store.currentGrid?.overrides?.sm?.["tile-1"]).toEqual({
      x: 1,
      y: 9,
      w: 3,
      h: 7,
    });
  });

  it("ignores resize requests for missing grids or tiles", async () => {
    const store = await createLoadedGridStore();

    store.resizeTile("missing", 3, 3);
    store.currentGrid = null;
    store.resizeTile("tile-1", 3, 3);

    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();
  });

  it("captures every rendered position into the active non-desktop override", async () => {
    const store = await createLoadedGridStore();
    store.activeBreakpoint = "md";
    store.setDisplayPositions([
      { i: "tile-1", x: 1, y: 2, w: 3, h: 4 },
      { i: "tile-2", x: 4, y: 5, w: 2, h: 2 },
    ]);

    store.updateBreakpointOverride();

    expect(store.currentGrid?.overrides?.md).toEqual({
      "tile-1": { x: 1, y: 2, w: 3, h: 4 },
      "tile-2": { x: 4, y: 5, w: 2, h: 2 },
    });
    expect(store.skipOverrideRebuild).toBe(true);
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("does not create breakpoint overrides at desktop or without a grid", async () => {
    const store = await createLoadedGridStore();
    store.activeBreakpoint = "lg";

    store.updateBreakpointOverride();
    store.currentGrid = null;
    store.activeBreakpoint = "md";
    store.updateBreakpointOverride();

    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();
  });

  it("saves supplied non-desktop positions as the complete override", async () => {
    const store = await createLoadedGridStore(
      makeGrid({
        overrides: {
          md: {
            stale: { x: 0, y: 0, w: 1, h: 1 },
          },
        },
      }),
    );

    store.saveBreakpointPositions("md", [
      { i: "tile-1", x: 2, y: 3, w: 4, h: 5 },
    ]);

    expect(store.currentGrid?.overrides?.md).toEqual({
      "tile-1": { x: 2, y: 3, w: 4, h: 5 },
    });
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("ignores explicit breakpoint saves for desktop or missing grids", async () => {
    const store = await createLoadedGridStore();

    store.saveBreakpointPositions("lg", []);
    store.currentGrid = null;
    store.saveBreakpointPositions("md", []);

    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();
  });

  it("captures history and removes a non-desktop override on reset", async () => {
    const store = await createLoadedGridStore(
      makeGrid({
        overrides: {
          md: {
            "tile-1": { x: 1, y: 2, w: 3, h: 4 },
          },
        },
      }),
    );

    store.resetBreakpoint("md");

    expect(store.currentGrid?.overrides?.md).toBeUndefined();
    expect(gridHarness.undoManagers[0]?.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ actionLabel: "Reset breakpoint grid" }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("ignores desktop or missing-grid breakpoint resets", async () => {
    const store = await createLoadedGridStore();

    store.resetBreakpoint("lg");
    store.currentGrid = null;
    store.resetBreakpoint("md");

    expect(gridHarness.undoManagers[0]?.pushSnapshot).not.toHaveBeenCalled();
    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();
  });
});
