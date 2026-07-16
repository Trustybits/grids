import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import {
  ContentType,
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  type Breakpoint,
  type Grid,
  type LinkContent,
  type Tile,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import type { GridLayoutReadinessAdapter } from "@/controllers/GridController";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const gridTileHooks = vi.hoisted(() => ({
  handleGridShortClick: vi.fn(),
}));
const griddleHooks = vi.hoisted(() => ({
  loadJSON: vi.fn(),
  loadJSONFailuresRemaining: 0,
  reflow: vi.fn(),
}));

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => storeHolder.current,
}));

// Use the REAL Griddle engine (useGriddle) so loadJSON / compactAll behave for
// real; only stub the visual GriddleGrid component so it renders every tile via
// the #tile slot (no virtualization/pointer handling) and lets tests drive the
// grid-level drag/resize events.
vi.mock("@griddle/vue", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@griddle/vue")>();
  const { defineComponent, h } = await import("vue");
  return {
    ...actual,
    useGriddle: (...args: Parameters<typeof actual.useGriddle>) => {
      const api = actual.useGriddle(...args);
      const loadJSON = api.loadJSON;
      const reflow = api.reflow;
      return {
        ...api,
        loadJSON: (snapshot: Parameters<typeof loadJSON>[0]) => {
          griddleHooks.loadJSON(snapshot);
          if (griddleHooks.loadJSONFailuresRemaining > 0) {
            griddleHooks.loadJSONFailuresRemaining -= 1;
            throw new RangeError("injected Griddle load rejection");
          }
          return loadJSON(snapshot);
        },
        reflow: (options: Parameters<typeof reflow>[0]) => {
          griddleHooks.reflow(options);
          return reflow(options);
        },
      };
    },
    GriddleGrid: defineComponent({
      name: "GriddleGridStub",
      props: {
        api: { type: Object, required: true },
        height: { type: String, required: false },
        selection: { type: Object, required: false },
      },
      emits: ["dragStart", "dragEnd", "resizeStart", "resizeEnd"],
      setup(props, { slots }) {
        return () =>
          h(
            "div",
            { "data-test": "griddle-grid" },
            (
              props.api as {
                tiles: { value: { id: string }[] };
              }
            ).tiles.value.map((tile) =>
              h(
                "div",
                {
                  key: tile.id,
                  class: "griddle-tile",
                  "data-griddle-tile": tile.id,
                },
                slots.tile?.({ tile, selected: false }),
              ),
            ),
          );
      },
    }),
  };
});

vi.mock("@/components/grid/Tile.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      name: "GridTileStub",
      props: {
        tile: { type: Object, required: true },
        layout: { type: Object, required: true },
      },
      setup(props, { expose }) {
        expose({
          handleGridShortClick: gridTileHooks.handleGridShortClick,
        });
        return () =>
          h("div", {
            "data-test": "grid-tile",
            "data-tile-id": (props.tile as Tile).i,
            "data-layout-x": (props.layout as GridLayoutItem).x,
          });
      },
    }),
  };
});

function makeTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    borderEnabled: true,
    caption: "",
    content: {
      type: ContentType.LINK,
      link: "https://example.com",
      metaTitle: "Initial",
    },
    ...overrides,
  } as Tile;
}

function makeGrid(tile = makeTile()): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [tile],
    overrides: {},
  };
}

function makeStore(grid = makeGrid()) {
  const disposeLayoutReadiness = vi.fn();
  const registerLayoutReadinessAdapter = vi.fn(
    (_adapter: GridLayoutReadinessAdapter) => disposeLayoutReadiness,
  );
  const store = reactive({
    isLoading: false,
    grid,
    currentGrid: grid,
    forcedBreakpoint: null as "lg" | "md" | "sm" | null,
    undoRedoVersion: 0,
    canEdit: true,
    verticalCompact: true,
    setActiveBreakpoint: vi.fn(),
    setViewportBreakpoint: vi.fn(),
    setDisplayPositions: vi.fn(),
    commitCompactedLayout: vi.fn(),
    beginMove: vi.fn(),
    commitMove: vi.fn(),
    beginResize: vi.fn(),
    commitResize: vi.fn(),
    removeTile: vi.fn(),
    updateGrid: vi.fn(),
    registerLayoutReadinessAdapter,
  });
  return {
    store,
    disposeLayoutReadiness,
    registerLayoutReadinessAdapter,
  };
}

async function mountGrid() {
  const { default: GridComponent } = await import(
    "@/components/grid/Grid.vue"
  );
  return mount(GridComponent);
}

function griddle(wrapper: ReturnType<typeof mount>) {
  return wrapper.findComponent({ name: "GriddleGridStub" });
}

function gridItemsOverlap(
  left: Pick<GridLayoutItem, "x" | "y" | "w" | "h">,
  right: Pick<GridLayoutItem, "x" | "y" | "w" | "h">,
): boolean {
  return (
    left.x < right.x + right.w &&
    left.x + left.w > right.x &&
    left.y < right.y + right.h &&
    left.y + left.h > right.y
  );
}

describe("Grid canvas characterization", () => {
  beforeEach(() => {
    gridTileHooks.handleGridShortClick.mockReset();
    griddleHooks.loadJSON.mockReset();
    griddleHooks.loadJSONFailuresRemaining = 0;
    griddleHooks.reflow.mockReset();
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1800);
    class ResizeObserverStub {
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("publishes settled positions and reports the active breakpoint", async () => {
    const { store } = makeStore();
    storeHolder.current = store;

    const wrapper = await mountGrid();
    await flushPromises();

    expect(store.setActiveBreakpoint).toHaveBeenCalledWith("lg");
    expect(store.setViewportBreakpoint).toHaveBeenCalledWith("lg");
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
    ]);
    // Griddle 0.1.1 needs a CSS length on its root because its internal
    // numeric content height is dropped by the browser's style parser. The
    // 2x2 tile plus Griddle's two-row virtualization buffer is 4 * (75 + 48),
    // with one full outer margin restored by the app wrapper.
    expect(griddle(wrapper).props("height")).toBe("540px");
    expect(griddle(wrapper).props("selection")).toEqual(new Set());
    expect(griddleHooks.reflow).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("routes griddle-v1 through explicit reflow with converted breakpoint placements", async () => {
    const grid = makeGrid();
    grid.responsiveLayoutVersion = GRIDDLE_RESPONSIVE_LAYOUT_VERSION;
    grid.overrides = {
      md: {
        "tile-1": { x: 3, y: 4, w: 5, h: 6 },
      },
    };
    const { store } = makeStore(grid);
    store.forcedBreakpoint = "md";
    store.verticalCompact = false;
    storeHolder.current = store;

    const wrapper = await mountGrid();
    await flushPromises();

    expect(griddleHooks.reflow).toHaveBeenCalledWith({
      cols: 8,
      strategy: "griddle-v1",
      placements: {
        "tile-1": { col: 3, row: 4, w: 5, h: 6 },
      },
    });
    expect(griddleHooks.loadJSON).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ cols: 12 }),
      }),
    );
    expect(store.setDisplayPositions).toHaveBeenCalledTimes(1);
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 3, y: 4, w: 5, h: 6 },
    ]);
    expect(store.currentGrid.tiles[0]).toEqual(
      expect.objectContaining({ x: 0, y: 0, w: 2, h: 2 }),
    );
    expect(store.currentGrid.overrides?.md?.["tile-1"]).toEqual({
      x: 3,
      y: 4,
      w: 5,
      h: 6,
    });

    wrapper.unmount();
  });

  it("reflows canonical desktop tiles across live lg, md, and sm transitions", async () => {
    const first = makeTile({ i: "tile-1", x: 0, y: 0, w: 4, h: 2 });
    const second = makeTile({ i: "tile-2", x: 8, y: 0, w: 4, h: 2 });
    const grid = makeGrid(first);
    grid.tiles = [first, second];
    grid.responsiveLayoutVersion = GRIDDLE_RESPONSIVE_LAYOUT_VERSION;
    const { store } = makeStore(grid);
    store.verticalCompact = false;
    storeHolder.current = store;

    const wrapper = await mountGrid();
    await flushPromises();
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 4, h: 2 },
      { i: "tile-2", x: 8, y: 0, w: 4, h: 2 },
    ]);

    store.forcedBreakpoint = "md";
    await flushPromises();
    expect(griddleHooks.reflow).toHaveBeenCalledTimes(1);
    expect(griddleHooks.reflow).toHaveBeenLastCalledWith({
      cols: 8,
      strategy: "griddle-v1",
    });
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 4, h: 2 },
      { i: "tile-2", x: 4, y: 0, w: 4, h: 2 },
    ]);

    store.forcedBreakpoint = "sm";
    await flushPromises();
    expect(griddleHooks.reflow).toHaveBeenCalledTimes(2);
    expect(griddleHooks.reflow).toHaveBeenLastCalledWith({
      cols: 4,
      strategy: "griddle-v1",
    });
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 4, h: 2 },
      { i: "tile-2", x: 0, y: 2, w: 4, h: 2 },
    ]);

    expect(store.currentGrid.tiles).toEqual([
      expect.objectContaining({ i: "tile-1", x: 0, y: 0, w: 4, h: 2 }),
      expect.objectContaining({ i: "tile-2", x: 8, y: 0, w: 4, h: 2 }),
    ]);
    wrapper.unmount();
  });

  it.each<Breakpoint>(["md", "sm"])(
    "runs and persists gravity after switching to %s placements",
    async (breakpoint) => {
      const first = makeTile({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 });
      const second = makeTile({ i: "tile-2", x: 2, y: 0, w: 2, h: 2 });
      const grid = makeGrid(first);
      grid.tiles = [first, second];
      grid.overrides = {
        [breakpoint]: {
          "tile-1": { x: 0, y: 0, w: 2, h: 2 },
          "tile-2": { x: 0, y: 5, w: 2, h: 2 },
        },
      };
      const { store } = makeStore(grid);
      store.verticalCompact = true;
      storeHolder.current = store;
      const wrapper = await mountGrid();
      await flushPromises();
      store.commitCompactedLayout.mockClear();

      store.forcedBreakpoint = breakpoint;
      await flushPromises();

      const expected = [
        { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
        { i: "tile-2", x: 0, y: 2, w: 2, h: 2 },
      ];
      expect(store.setDisplayPositions).toHaveBeenLastCalledWith(expected);
      expect(store.commitCompactedLayout).toHaveBeenCalledWith(expected);

      wrapper.unmount();
    },
  );

  it("recovers invalid saved placements through automatic Griddle reflow", async () => {
    const first = makeTile({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 });
    const second = makeTile({ i: "tile-2", x: 2, y: 0, w: 2, h: 2 });
    const grid = makeGrid(first);
    grid.tiles = [first, second];
    grid.overrides = {
      sm: {
        "tile-1": { x: 3, y: -1, w: 2, h: 2 },
        "tile-2": { x: 3, y: -1, w: 2, h: 2 },
      },
    };
    const { store } = makeStore(grid);
    store.forcedBreakpoint = "sm";
    store.verticalCompact = false;
    storeHolder.current = store;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const wrapper = await mountGrid();
    await flushPromises();

    expect(griddleHooks.reflow).toHaveBeenLastCalledWith({
      cols: 4,
      strategy: "griddle-v1",
    });
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
      { i: "tile-2", x: 2, y: 0, w: 2, h: 2 },
    ]);
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
    wrapper.unmount();
  });

  it("repairs invalid canonical geometry with Griddle before loading", async () => {
    const first = makeTile({ i: "tile-1", x: 0, y: -1, w: 2, h: 2 });
    const second = makeTile({ i: "tile-2", x: 0, y: -1, w: 2, h: 2 });
    const grid = makeGrid(first);
    grid.tiles = [first, second];
    const { store } = makeStore(grid);
    store.verticalCompact = false;
    storeHolder.current = store;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const wrapper = await mountGrid();
    await flushPromises();

    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
      { i: "tile-2", x: 2, y: 0, w: 2, h: 2 },
    ]);
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
    wrapper.unmount();
  });

  it("bounds recovery to one attempt and restores the last legal engine state", async () => {
    const { store, registerLayoutReadinessAdapter } = makeStore();
    storeHolder.current = store;
    griddleHooks.loadJSONFailuresRemaining = 2;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = await mountGrid();
    await flushPromises();

    expect(griddleHooks.loadJSON).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledOnce();
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([]);
    const adapter = registerLayoutReadinessAdapter.mock.calls[0]![0];
    await expect(adapter.waitForLayoutReady("lg")).resolves.toBeUndefined();

    error.mockRestore();
    wrapper.unmount();
  });

  it("keeps a canonical target unreflowed even when its breakpoint label is md", async () => {
    const grid = makeGrid();
    grid.colNum = 6;
    const { store } = makeStore(grid);
    store.forcedBreakpoint = "md";
    store.verticalCompact = false;
    storeHolder.current = store;

    const wrapper = await mountGrid();
    await flushPromises();

    expect(griddleHooks.loadJSON).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ cols: 6 }),
      }),
    );
    expect(griddleHooks.reflow).not.toHaveBeenCalled();
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
    ]);

    wrapper.unmount();
  });

  it("routes an unknown raw stamp through griddle-v1 without mutating persisted data", async () => {
    const grid = makeGrid();
    grid.responsiveLayoutVersion = "griddle-v2" as never;
    const { store } = makeStore(grid);
    store.forcedBreakpoint = "md";
    store.verticalCompact = false;
    storeHolder.current = store;

    const wrapper = await mountGrid();
    await flushPromises();

    expect(griddleHooks.reflow).toHaveBeenCalledWith({
      cols: 8,
      strategy: "griddle-v1",
    });
    expect(store.currentGrid.responsiveLayoutVersion).toBe(
      "griddle-v2",
    );
    expect(store.currentGrid.tiles[0]).toEqual(
      expect.objectContaining({ x: 0, y: 0, w: 2, h: 2 }),
    );

    wrapper.unmount();
  });

  it("renders missing, malformed, future, and current stamps through the same Griddle path", async () => {
    const renderVersion = async (
      responsiveLayoutVersion: unknown,
    ) => {
      const first = makeTile({
        i: "tile-1",
        x: 0,
        y: 0,
        w: 3,
        h: 2,
      });
      const second = makeTile({
        i: "tile-2",
        x: 6,
        y: 0,
        w: 2,
        h: 2,
      });
      const grid = makeGrid(first);
      grid.tiles = [first, second];
      grid.responsiveLayoutVersion = responsiveLayoutVersion as never;
      const { store } = makeStore(grid);
      store.forcedBreakpoint = "md";
      store.verticalCompact = false;
      storeHolder.current = store;

      const wrapper = await mountGrid();
      await flushPromises();
      const rendered = store.setDisplayPositions.mock.lastCall?.[0];
      wrapper.unmount();
      return rendered;
    };

    const missing = await renderVersion(undefined);
    const malformed = await renderVersion("invalid");
    const future = await renderVersion("griddle-v2");
    const griddle = await renderVersion(
      GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    );

    expect(missing).toEqual(griddle);
    expect(malformed).toEqual(griddle);
    expect(future).toEqual(griddle);
  });

  const responsiveVersionMatrix: Array<
    [Breakpoint, boolean, "none" | "partial" | "full"]
  > = (["lg", "md", "sm"] as const).flatMap((breakpoint) =>
    [false, true].flatMap((verticalCompact) =>
      (["none", "partial", "full"] as const).map(
        (overrideMode): [Breakpoint, boolean, "none" | "partial" | "full"] =>
          [breakpoint, verticalCompact, overrideMode],
      ),
    ),
  );

  it.each(responsiveVersionMatrix)(
    "routes versions at %s with gravity=%s and %s overrides",
    async (breakpoint, verticalCompact, overrideMode) => {
      const columns = breakpoint === "lg" ? 12 : breakpoint === "md" ? 8 : 4;
      const tiles = [
        makeTile({ i: "tile-a", x: 0, y: 0, w: 4, h: 2 }),
        makeTile({ i: "tile-b", x: 4, y: 0, w: 4, h: 2 }),
        makeTile({ i: "tile-c", x: 8, y: 3, w: 4, h: 2 }),
      ];
      const overrides: Grid["overrides"] = {};

      if (overrideMode === "partial") {
        overrides[breakpoint] = {
          "tile-a": { x: 0, y: 3, w: Math.min(4, columns), h: 2 },
        };
      } else if (overrideMode === "full") {
        overrides[breakpoint] = {
          "tile-a": { x: 0, y: 3, w: 2, h: 2 },
          "tile-b": { x: 2, y: 3, w: 2, h: 2 },
          "tile-c": { x: 0, y: 5, w: Math.min(4, columns), h: 2 },
        };
      }

      const renderState = async (
        persistedVersion: unknown,
      ): Promise<GridLayoutItem[]> => {
        const grid = makeGrid(tiles[0]);
        grid.tiles = structuredClone(tiles);
        grid.overrides = structuredClone(overrides);
        grid.verticalCompact = verticalCompact;
        grid.responsiveLayoutVersion = persistedVersion as never;
        const originalGrid = structuredClone(grid);
        const { store } = makeStore(grid);
        store.forcedBreakpoint = breakpoint;
        store.verticalCompact = verticalCompact;
        storeHolder.current = store;

        const wrapper = await mountGrid();
        await flushPromises();
        const rendered = structuredClone(
          (store.setDisplayPositions.mock.lastCall?.[0] ?? []) as GridLayoutItem[],
        );

        expect(grid).toEqual(originalGrid);
        expect(rendered.map(({ i }) => i).sort()).toEqual([
          "tile-a",
          "tile-b",
          "tile-c",
        ]);
        for (const tile of rendered) {
          expect(tile.x).toBeGreaterThanOrEqual(0);
          expect(tile.y).toBeGreaterThanOrEqual(0);
          expect(tile.x + tile.w).toBeLessThanOrEqual(columns);
        }
        for (let index = 0; index < rendered.length; index += 1) {
          for (let other = index + 1; other < rendered.length; other += 1) {
            expect(gridItemsOverlap(rendered[index]!, rendered[other]!)).toBe(
              false,
            );
          }
        }
        wrapper.unmount();
        return rendered;
      };

      const missing = await renderState(undefined);
      const malformed = await renderState("invalid");
      const future = await renderState("griddle-v2");
      const explicitGriddle = await renderState(
        GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
      );

      expect(malformed).toEqual(missing);
      expect(future).toEqual(missing);
      expect(explicitGriddle).toEqual(missing);

      if (breakpoint !== "lg" && overrideMode !== "none") {
        for (const [id, placement] of Object.entries(
          overrides[breakpoint]!,
        )) {
          expect(explicitGriddle.find((tile) => tile.i === id)).toEqual({
            i: id,
            ...placement,
          });
        }
      }

      if (overrideMode === "full" && breakpoint !== "lg") {
        expect(explicitGriddle).toEqual(
          tiles.map(({ i }) => ({ i, ...overrides[breakpoint]![i]! })),
        );
      }
    },
  );

  it("passes canonical tile data separately from non-desktop layout geometry", async () => {
    const canonicalTile = makeTile();
    const grid = makeGrid(canonicalTile);
    grid.overrides = {
      md: {
        "tile-1": { x: 3, y: 4, w: 5, h: 6 },
      },
    };
    const { store } = makeStore(grid);
    store.forcedBreakpoint = "md";
    // Gravity off so the override geometry passes through uncompacted.
    store.verticalCompact = false;
    storeHolder.current = store;

    const wrapper = await mountGrid();
    await flushPromises();

    const gridTile = wrapper.findComponent({ name: "GridTileStub" });
    const renderedTile = gridTile.props("tile") as Tile;
    const renderedLayout = gridTile.props("layout") as GridLayoutItem;

    expect(renderedTile).toBe(store.currentGrid.tiles[0]);
    expect(renderedTile).toEqual(
      expect.objectContaining({ x: 0, y: 0, w: 2, h: 2 }),
    );
    expect(renderedLayout).toEqual({ i: "tile-1", x: 3, y: 4, w: 5, h: 6 });
    expect(renderedLayout).not.toHaveProperty("content");

    wrapper.unmount();
  });

  it("reads asynchronously replaced content directly from the canonical tile", async () => {
    const grid = makeGrid();
    grid.overrides = { md: { "tile-1": { x: 3, y: 4, w: 5, h: 6 } } };
    const { store } = makeStore(grid);
    store.forcedBreakpoint = "md";
    store.verticalCompact = false;
    storeHolder.current = store;

    const wrapper = await mountGrid();
    await flushPromises();

    const fetchedContent = {
      type: ContentType.LINK,
      link: "https://example.com",
      metaTitle: "Fetched title",
      metaDescription: "Fetched description",
    } as LinkContent;
    store.currentGrid.tiles[0]!.content = fetchedContent;
    await nextTick();

    const gridTile = wrapper.findComponent({ name: "GridTileStub" });
    const renderedTile = gridTile.props("tile") as Tile;
    const renderedLayout = gridTile.props("layout") as GridLayoutItem;
    expect(renderedTile).toBe(store.currentGrid.tiles[0]);
    expect(renderedTile.content).toBe(store.currentGrid.tiles[0]!.content);
    expect(renderedTile.content).toEqual(
      expect.objectContaining({
        metaTitle: "Fetched title",
        metaDescription: "Fetched description",
      }),
    );
    expect(renderedLayout).toEqual({ i: "tile-1", x: 3, y: 4, w: 5, h: 6 });
    expect(renderedLayout).not.toHaveProperty("content");

    wrapper.unmount();
  });

  it("registers layout readiness, resolves it after render, and disposes on unmount", async () => {
    const {
      store,
      disposeLayoutReadiness,
      registerLayoutReadinessAdapter,
    } = makeStore();
    storeHolder.current = store;

    const wrapper = await mountGrid();
    await flushPromises();

    expect(registerLayoutReadinessAdapter).toHaveBeenCalledTimes(1);
    const adapter = registerLayoutReadinessAdapter.mock.calls[0]![0];
    await expect(adapter.waitForLayoutReady("lg")).resolves.toBeUndefined();

    wrapper.unmount();
    expect(disposeLayoutReadiness).toHaveBeenCalledTimes(1);
  });

  it("begins and commits a move on a committed drag gesture", async () => {
    const { store } = makeStore();
    storeHolder.current = store;
    const wrapper = await mountGrid();
    await flushPromises();
    store.setDisplayPositions.mockClear();

    griddle(wrapper).vm.$emit("dragStart", "tile-1");
    griddle(wrapper).vm.$emit("dragEnd", "tile-1", true);
    await flushPromises();

    expect(store.beginMove).toHaveBeenCalledTimes(1);
    expect(store.commitMove).toHaveBeenCalledTimes(1);
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
    ]);

    wrapper.unmount();
  });

  it("uses the full Griddle tile wrapper as the mouse click hitbox", async () => {
    const { store } = makeStore();
    storeHolder.current = store;
    const wrapper = await mountGrid();
    await flushPromises();
    const tileWrapper = wrapper.find('[data-griddle-tile="tile-1"]');

    const pointerDown = Object.assign(
      new MouseEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: 100,
        clientY: 200,
      }),
      { pointerId: 7, pointerType: "mouse" },
    );
    tileWrapper.element.dispatchEvent(pointerDown);
    window.dispatchEvent(
      Object.assign(
        new MouseEvent("pointerup", {
          button: 0,
          clientX: 104,
          clientY: 203,
        }),
        { pointerId: 7, pointerType: "mouse" },
      ),
    );

    expect(gridTileHooks.handleGridShortClick).toHaveBeenCalledOnce();
    expect(gridTileHooks.handleGridShortClick).toHaveBeenCalledWith(
      pointerDown,
    );

    tileWrapper.element.dispatchEvent(
      Object.assign(
        new MouseEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 100,
          clientY: 200,
        }),
        { pointerId: 8, pointerType: "mouse" },
      ),
    );
    window.dispatchEvent(
      Object.assign(
        new MouseEvent("pointerup", {
          button: 0,
          clientX: 140,
          clientY: 200,
        }),
        { pointerId: 8, pointerType: "mouse" },
      ),
    );
    expect(gridTileHooks.handleGridShortClick).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("does not commit a move when the drag is not committed", async () => {
    const { store } = makeStore();
    storeHolder.current = store;
    const wrapper = await mountGrid();
    await flushPromises();

    griddle(wrapper).vm.$emit("dragStart", "tile-1");
    griddle(wrapper).vm.$emit("dragEnd", "tile-1", false);
    await flushPromises();

    expect(store.beginMove).toHaveBeenCalledTimes(1);
    expect(store.commitMove).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("begins and commits a resize on a committed resize gesture", async () => {
    const { store } = makeStore();
    storeHolder.current = store;
    const wrapper = await mountGrid();
    await flushPromises();

    griddle(wrapper).vm.$emit("resizeStart", "tile-1");
    griddle(wrapper).vm.$emit("resizeEnd", "tile-1", true);
    await flushPromises();

    expect(store.beginResize).toHaveBeenCalledTimes(1);
    expect(store.commitResize).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it("resolves toolbar resize collisions through Griddle before committing", async () => {
    const first = makeTile({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 });
    const second = makeTile({ i: "tile-2", x: 2, y: 0, w: 2, h: 2 });
    const grid = makeGrid(first);
    grid.tiles = [first, second];
    const { store } = makeStore(grid);
    store.verticalCompact = false;
    storeHolder.current = store;
    const wrapper = await mountGrid();
    await flushPromises();
    store.setDisplayPositions.mockClear();

    (
      wrapper.vm as unknown as {
        resizeTileThroughEngine: (
          id: string,
          width: number,
          height: number,
        ) => void;
      }
    ).resizeTileThroughEngine("tile-1", 4, 2);
    await flushPromises();

    const lastDisplayCall =
      store.setDisplayPositions.mock.calls[
        store.setDisplayPositions.mock.calls.length - 1
      ];
    const resolved = lastDisplayCall?.[0] as
      | GridLayoutItem[]
      | undefined;
    expect(resolved).toBeDefined();
    const resized = resolved?.find((tile) => tile.i === "tile-1");
    const displaced = resolved?.find((tile) => tile.i === "tile-2");
    expect(resized).toEqual(
      expect.objectContaining({ x: 0, y: 0, w: 4, h: 2 }),
    );
    expect(displaced).toBeDefined();
    expect(
      resized!.x < displaced!.x + displaced!.w &&
        resized!.x + resized!.w > displaced!.x &&
        resized!.y < displaced!.y + displaced!.h &&
        resized!.y + resized!.h > displaced!.y,
    ).toBe(false);
    expect(store.beginResize).toHaveBeenCalledTimes(1);
    expect(store.commitResize).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it("trims a toolbar resize at the right edge without moving the tile", async () => {
    const edge = makeTile({ i: "tile-1", x: 9, y: 0, w: 1, h: 2 });
    const { store } = makeStore(makeGrid(edge));
    store.verticalCompact = false;
    storeHolder.current = store;
    const wrapper = await mountGrid();
    await flushPromises();
    store.setDisplayPositions.mockClear();

    (
      wrapper.vm as unknown as {
        resizeTileThroughEngine: (
          id: string,
          width: number,
          height: number,
        ) => void;
      }
    ).resizeTileThroughEngine("tile-1", 3, 2);
    await flushPromises();

    const resolved = store.setDisplayPositions.mock.lastCall?.[0] as
      | GridLayoutItem[]
      | undefined;
    expect(resolved?.find((tile) => tile.i === "tile-1")).toEqual(
      expect.objectContaining({ x: 9, y: 0, w: 3, h: 2 }),
    );
    expect(store.beginResize).toHaveBeenCalledTimes(1);
    expect(store.commitResize).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it.each<Breakpoint>(["md", "sm"])(
    "applies and persists gravity after deleting a tile from %s placements",
    async (breakpoint) => {
      const first = makeTile({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 });
      const second = makeTile({ i: "tile-2", x: 0, y: 2, w: 2, h: 2 });
      const third = makeTile({ i: "tile-3", x: 0, y: 4, w: 2, h: 2 });
      const grid = makeGrid(first);
      grid.tiles = [first, second, third];
      grid.overrides = {
        [breakpoint]: {
          "tile-1": { x: 0, y: 0, w: 2, h: 2 },
          "tile-2": { x: 0, y: 2, w: 2, h: 2 },
          "tile-3": { x: 0, y: 4, w: 2, h: 2 },
        },
      };
      const { store } = makeStore(grid);
      store.forcedBreakpoint = breakpoint;
      store.verticalCompact = true;
      storeHolder.current = store;
      const wrapper = await mountGrid();
      await flushPromises();

      (
        wrapper.vm as unknown as {
          removeTileThroughEngine: (id: string) => void;
        }
      ).removeTileThroughEngine("tile-1");
      await flushPromises();

      const expected = [
        { i: "tile-2", x: 0, y: 0, w: 2, h: 2 },
        { i: "tile-3", x: 0, y: 2, w: 2, h: 2 },
      ];
      expect(store.removeTile).toHaveBeenCalledWith("tile-1", expected);
      expect(store.setDisplayPositions).toHaveBeenLastCalledWith(expected);

      wrapper.unmount();
    },
  );

  it("compacts through the engine and commits when gravity is enabled (desktop)", async () => {
    // tile-2 sits below an empty gap; enabling gravity pulls it up beneath
    // tile-1 (which is h:2 at y:0 → tile-2 lands at y:2).
    const first = makeTile({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 });
    const second = makeTile({ i: "tile-2", x: 0, y: 5, w: 2, h: 2 });
    const { store } = makeStore(makeGrid(first));
    store.currentGrid.tiles = [first, second];
    store.verticalCompact = false;
    storeHolder.current = store;
    const wrapper = await mountGrid();
    await flushPromises();

    store.verticalCompact = true;
    await nextTick();
    await flushPromises();

    // Canonical tiles are untouched (commitCompactedLayout is where the write
    // would happen, and it is mocked here).
    expect(store.currentGrid.tiles).toEqual([
      expect.objectContaining({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 }),
      expect.objectContaining({ i: "tile-2", x: 0, y: 5, w: 2, h: 2 }),
    ]);
    expect(store.commitCompactedLayout).toHaveBeenCalledWith([
      expect.objectContaining({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 }),
      expect.objectContaining({ i: "tile-2", x: 0, y: 2, w: 2, h: 2 }),
    ]);
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
      { i: "tile-2", x: 0, y: 2, w: 2, h: 2 },
    ]);

    wrapper.unmount();
  });

  it.each<Breakpoint>(["md", "sm"])(
    "enables gravity and persists compaction for %s breakpoint placements",
    async (breakpoint) => {
      const first = makeTile({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 });
      const second = makeTile({ i: "tile-2", x: 2, y: 0, w: 2, h: 2 });
      const grid = makeGrid(first);
      grid.tiles = [first, second];
      grid.overrides = {
        [breakpoint]: {
          "tile-1": { x: 0, y: 0, w: 2, h: 2 },
          "tile-2": { x: 0, y: 5, w: 2, h: 2 },
        },
      };
      const { store } = makeStore(grid);
      store.forcedBreakpoint = breakpoint;
      store.verticalCompact = false;
      storeHolder.current = store;
      const wrapper = await mountGrid();
      await flushPromises();

      store.verticalCompact = true;
      await nextTick();
      await flushPromises();

      expect(griddleHooks.loadJSON).toHaveBeenLastCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ gravity: "top" }),
        }),
      );
      expect(store.commitCompactedLayout).toHaveBeenCalledWith([
        expect.objectContaining({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 }),
        expect.objectContaining({ i: "tile-2", x: 0, y: 2, w: 2, h: 2 }),
      ]);

      wrapper.unmount();
    },
  );

  it("reports an empty grid as ready and renders no GriddleGrid", async () => {
    const grid = makeGrid();
    grid.tiles = [];
    const { store, registerLayoutReadinessAdapter } = makeStore(grid);
    storeHolder.current = store;

    const wrapper = await mountGrid();
    await flushPromises();
    const adapter = registerLayoutReadinessAdapter.mock.calls[0]![0];

    await expect(
      adapter.waitForLayoutReady("lg"),
    ).resolves.toBeUndefined();
    expect(griddle(wrapper).exists()).toBe(false);

    wrapper.unmount();
  });
});
