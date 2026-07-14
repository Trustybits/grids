import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import {
  ContentType,
  type Grid,
  type LinkContent,
  type Tile,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import type { GridLayoutReadinessAdapter } from "@/controllers/GridController";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
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
                { key: tile.id },
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
      setup(props) {
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

describe("Grid canvas characterization", () => {
  beforeEach(() => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1800);
    class ResizeObserverStub {
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("publishes the projected positions and reports the active breakpoint", async () => {
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

    wrapper.unmount();
  });

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

  it("compacts the active breakpoint's override layout when gravity is enabled", async () => {
    const first = makeTile({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 });
    const second = makeTile({ i: "tile-2", x: 0, y: 0, w: 2, h: 2 });
    const grid = makeGrid(first);
    grid.tiles = [first, second];
    grid.overrides = {
      md: {
        "tile-1": { x: 0, y: 0, w: 2, h: 2 },
        "tile-2": { x: 0, y: 5, w: 2, h: 2 },
      },
    };
    const { store } = makeStore(grid);
    store.forcedBreakpoint = "md";
    store.verticalCompact = false;
    storeHolder.current = store;
    const wrapper = await mountGrid();
    await flushPromises();

    store.verticalCompact = true;
    await nextTick();
    await flushPromises();

    expect(store.commitCompactedLayout).toHaveBeenCalledWith([
      expect.objectContaining({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 }),
      expect.objectContaining({ i: "tile-2", x: 0, y: 2, w: 2, h: 2 }),
    ]);

    wrapper.unmount();
  });

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
