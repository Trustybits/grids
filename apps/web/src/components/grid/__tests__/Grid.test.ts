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

vi.mock("@/grid-view/useGridViewContext", () => ({
  useGridViewContext: () => storeHolder.current,
}));

vi.mock("vue3-grid-layout", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    GridLayout: defineComponent({
      name: "GridLayoutStub",
      props: {
        layout: { type: Array, required: true },
      },
      setup(_props, { slots }) {
        return () =>
          h("div", { "data-test": "grid-layout" }, slots.default?.());
      },
    }),
    GridItem: defineComponent({
      name: "GridItemStub",
      setup(_props, { slots }) {
        return () => h("div", slots.default?.());
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
    (_adapter: GridLayoutReadinessAdapter) =>
      disposeLayoutReadiness,
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
    updateGrid: vi.fn(),
    registerLayoutReadinessAdapter,
  });
  return {
    store,
    disposeLayoutReadiness,
    registerLayoutReadinessAdapter,
  };
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

  it("publishes the initial rendered positions and subsequent deep mutations", async () => {
    const { store } = makeStore();
    storeHolder.current = store;
    const { default: GridComponent } = await import(
      "@/components/grid/Grid.vue"
    );

    const wrapper = mount(GridComponent);
    await flushPromises();

    expect(store.setActiveBreakpoint).toHaveBeenCalledWith("lg");
    expect(store.setViewportBreakpoint).toHaveBeenCalledWith("lg");
    expect(store.setDisplayPositions).toHaveBeenCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
    ]);

    const layout = wrapper
      .findComponent({ name: "GridLayoutStub" })
      .props("layout") as Tile[];
    layout[0]!.x = 5;
    layout[0]!.y = 6;
    await nextTick();

    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 5, y: 6, w: 2, h: 2 },
    ]);
    expect(store.currentGrid.tiles[0]).toEqual(
      expect.objectContaining({ x: 0, y: 0, w: 2, h: 2 }),
    );

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
    storeHolder.current = store;
    const { default: GridComponent } = await import(
      "@/components/grid/Grid.vue"
    );

    const wrapper = mount(GridComponent);
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
    const canonicalTile = makeTile();
    const grid = makeGrid(canonicalTile);
    grid.overrides = {
      md: {
        "tile-1": { x: 3, y: 4, w: 5, h: 6 },
      },
    };
    const { store } = makeStore(grid);
    store.forcedBreakpoint = "md";
    storeHolder.current = store;
    const { default: GridComponent } = await import(
      "@/components/grid/Grid.vue"
    );
    const wrapper = mount(GridComponent);
    await flushPromises();
    const beforeLayout = wrapper
      .findComponent({ name: "GridLayoutStub" })
      .props("layout") as GridLayoutItem[];

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
    const afterLayout = wrapper
      .findComponent({ name: "GridLayoutStub" })
      .props("layout") as GridLayoutItem[];
    expect(renderedTile).toBe(store.currentGrid.tiles[0]);
    expect(renderedTile.content).toBe(store.currentGrid.tiles[0]!.content);
    expect(renderedTile.content).toEqual(
      expect.objectContaining({
        metaTitle: "Fetched title",
        metaDescription: "Fetched description",
      }),
    );
    expect(afterLayout[0]).toBe(beforeLayout[0]);
    expect(renderedLayout).toEqual({ i: "tile-1", x: 3, y: 4, w: 5, h: 6 });
    expect(renderedLayout).not.toHaveProperty("content");

    wrapper.unmount();
  });

  it("retains rendered layout identity when persisted overrides match it", async () => {
    const { store } = makeStore();
    store.forcedBreakpoint = "md";
    storeHolder.current = store;
    const { default: GridComponent } = await import(
      "@/components/grid/Grid.vue"
    );
    const wrapper = mount(GridComponent);
    await flushPromises();
    const before = wrapper
      .findComponent({ name: "GridLayoutStub" })
      .props("layout") as GridLayoutItem[];

    before[0]!.x = 3;
    before[0]!.y = 4;
    before[0]!.w = 4;
    before[0]!.h = 4;
    await nextTick();

    store.currentGrid.overrides = {
      md: {
        "tile-1": { x: 3, y: 4, w: 4, h: 4 },
      },
    };
    await nextTick();

    const after = wrapper
      .findComponent({ name: "GridLayoutStub" })
      .props("layout") as GridLayoutItem[];
    expect(after[0]).toBe(before[0]);
    expect(after[0]).toEqual(
      expect.objectContaining({ x: 3, y: 4, w: 4, h: 4 }),
    );

    wrapper.unmount();
  });

  it("registers rendered-layout readiness and disposes it on unmount", async () => {
    const {
      store,
      disposeLayoutReadiness,
      registerLayoutReadinessAdapter,
    } = makeStore();
    storeHolder.current = store;
    const { default: GridComponent } = await import(
      "@/components/grid/Grid.vue"
    );

    const wrapper = mount(GridComponent);
    await flushPromises();

    expect(registerLayoutReadinessAdapter).toHaveBeenCalledTimes(1);
    const adapter =
      registerLayoutReadinessAdapter.mock.calls[0]![0];
    const readiness = adapter.waitForLayoutReady("lg");
    wrapper
      .findComponent({ name: "GridLayoutStub" })
      .vm.$emit(
        "layout-updated",
        wrapper
          .findComponent({ name: "GridLayoutStub" })
          .props("layout"),
      );
    await readiness;

    wrapper.unmount();
    expect(disposeLayoutReadiness).toHaveBeenCalledTimes(1);
  });

  it("commits compacted positions through a typed command when gravity is enabled", async () => {
    const first = makeTile({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 });
    const second = makeTile({ i: "tile-2", x: 0, y: 0, w: 2, h: 2 });
    const { store } = makeStore(makeGrid(first));
    store.currentGrid.tiles = [first, second];
    store.verticalCompact = false;
    storeHolder.current = store;
    const { default: GridComponent } = await import(
      "@/components/grid/Grid.vue"
    );
    const wrapper = mount(GridComponent);
    await flushPromises();

    store.verticalCompact = true;
    await nextTick();

    expect(store.currentGrid.tiles).toEqual([
      expect.objectContaining({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 }),
      expect.objectContaining({ i: "tile-2", x: 0, y: 0, w: 2, h: 2 }),
    ]);
    expect(store.commitCompactedLayout).toHaveBeenCalledWith([
      expect.objectContaining({ i: "tile-1", x: 0, y: 0, w: 2, h: 2 }),
      expect.objectContaining({ i: "tile-2", x: 2, y: 0, w: 2, h: 2 }),
    ]);
    expect(store.updateGrid).not.toHaveBeenCalled();
    expect(store.setDisplayPositions).toHaveBeenLastCalledWith([
      { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
      { i: "tile-2", x: 2, y: 0, w: 2, h: 2 },
    ]);

    wrapper.unmount();
  });

  it("reports an empty grid as rendered after Vue commits the empty state", async () => {
    const grid = makeGrid();
    grid.tiles = [];
    const { store, registerLayoutReadinessAdapter } =
      makeStore(grid);
    storeHolder.current = store;
    const { default: GridComponent } = await import(
      "@/components/grid/Grid.vue"
    );

    const wrapper = mount(GridComponent);
    await flushPromises();
    const adapter =
      registerLayoutReadinessAdapter.mock.calls[0]![0];

    await expect(
      adapter.waitForLayoutReady("lg"),
    ).resolves.toBeUndefined();
    expect(
      wrapper.findComponent({ name: "GridLayoutStub" }).exists(),
    ).toBe(false);

    wrapper.unmount();
  });
});
