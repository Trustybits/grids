import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { Breakpoint, Grid } from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import { useGridViewportStore } from "../gridViewport";

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
    ...overrides,
  };
}

describe("gridViewport store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with desktop viewport defaults and no rendered positions", () => {
    const store = useGridViewportStore();

    expect(store.activeBreakpoint).toBe("lg");
    expect(store.viewportBreakpoint).toBe("lg");
    expect(store.forcedBreakpoint).toBeNull();
    expect(store.displayPositions).toEqual([]);
    expect(store.renderedBreakpoint).toBe("lg");
    expect(store.isForcedBreakpointViewOnly).toBe(false);
  });

  it("updates breakpoint and position state explicitly", () => {
    const store = useGridViewportStore();
    const positions: GridLayoutItem[] = [
      { i: "tile-1", x: 1, y: 2, w: 3, h: 4 },
    ];

    store.setActiveBreakpoint("md");
    expect(store.renderedBreakpoint).toBe("md");

    store.setViewportBreakpoint("sm");
    store.setForcedBreakpoint("lg");
    store.setDisplayPositions(positions);

    expect(store.activeBreakpoint).toBe("md");
    expect(store.viewportBreakpoint).toBe("sm");
    expect(store.forcedBreakpoint).toBe("lg");
    expect(store.displayPositions).toEqual(positions);
    expect(store.renderedBreakpoint).toBe("lg");
    expect(store.isForcedBreakpointViewOnly).toBe(true);
  });

  it.each<{
    forced: Breakpoint | null;
    viewport: Breakpoint;
    expected: boolean;
  }>([
    { forced: null, viewport: "sm", expected: false },
    { forced: "sm", viewport: "sm", expected: false },
    { forced: "sm", viewport: "lg", expected: false },
    { forced: "md", viewport: "md", expected: false },
    { forced: "lg", viewport: "lg", expected: false },
    { forced: "md", viewport: "lg", expected: false },
    { forced: "md", viewport: "sm", expected: true },
    { forced: "lg", viewport: "md", expected: true },
  ])(
    "reports view-only state for forced=$forced viewport=$viewport",
    ({ forced, viewport, expected }) => {
      const store = useGridViewportStore();
      store.setForcedBreakpoint(forced);
      store.setViewportBreakpoint(viewport);

      expect(store.isForcedBreakpointViewOnly).toBe(expected);
    },
  );

  it("reads breakpoint overrides without owning canonical grid state", () => {
    const store = useGridViewportStore();
    const positions = {
      "tile-1": { x: 0, y: 1, w: 2, h: 3 },
    };
    const grid = makeGrid({ overrides: { md: positions, sm: {} } });

    expect(store.getBreakpointPositions(grid, "md")).toBe(positions);
    expect(store.getBreakpointPositions(null, "md")).toBeUndefined();
    expect(store.hasBreakpointOverride(grid, "md")).toBe(true);
    expect(store.hasBreakpointOverride(grid, "sm")).toBe(false);
    expect(store.hasBreakpointOverride(grid, "lg")).toBe(false);
  });

  it("reset restores viewport defaults with a fresh positions array", () => {
    const store = useGridViewportStore();
    const initialPositions = store.displayPositions;

    store.setActiveBreakpoint("sm");
    store.setViewportBreakpoint("md");
    store.setForcedBreakpoint("sm");
    store.setDisplayPositions([{ i: "tile-1", x: 0, y: 0, w: 1, h: 1 }]);
    store.reset();

    expect(store.activeBreakpoint).toBe("lg");
    expect(store.viewportBreakpoint).toBe("lg");
    expect(store.forcedBreakpoint).toBeNull();
    expect(store.displayPositions).toEqual([]);
    expect(store.displayPositions).not.toBe(initialPositions);
  });
});
