import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import {
  ContentType,
  type Grid,
  type LinkContent,
  type Tile,
} from "@grids/contracts/types";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/stores/grid", () => ({
  useGridStore: () => storeHolder.current,
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
      },
      setup(props) {
        return () =>
          h("div", {
            "data-test": "grid-tile",
            "data-tile-id": (props.tile as Tile).i,
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
  const store = reactive({
    isLoading: false,
    currentGrid: grid,
    forcedBreakpoint: null as "lg" | "md" | "sm" | null,
    undoRedoVersion: 0,
    skipOverrideRebuild: false,
    canEdit: true,
    verticalCompact: true,
    setActiveBreakpoint: vi.fn(),
    setViewportBreakpoint: vi.fn(),
    setDisplayPositions: vi.fn(),
    getBreakpointPositions: vi.fn(
      (breakpoint: "lg" | "md" | "sm") =>
        store.currentGrid.overrides?.[breakpoint],
    ),
  });
  return store;
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
    const store = makeStore();
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

    wrapper.unmount();
  });

  it("builds a detached non-desktop layout from saved overrides", async () => {
    const canonicalTile = makeTile();
    const grid = makeGrid(canonicalTile);
    grid.overrides = {
      md: {
        "tile-1": { x: 3, y: 4, w: 5, h: 6 },
      },
    };
    const store = makeStore(grid);
    store.forcedBreakpoint = "md";
    storeHolder.current = store;
    const { default: GridComponent } = await import(
      "@/components/grid/Grid.vue"
    );

    const wrapper = mount(GridComponent);
    await flushPromises();

    const renderedTile = wrapper
      .findComponent({ name: "GridTileStub" })
      .props("tile") as Tile;
    expect(renderedTile).toEqual(
      expect.objectContaining({ x: 3, y: 4, w: 5, h: 6 }),
    );
    expect(renderedTile).not.toBe(canonicalTile);

    wrapper.unmount();
  });

  it("synchronizes asynchronously replaced content into a detached layout", async () => {
    const canonicalTile = makeTile();
    const grid = makeGrid(canonicalTile);
    grid.overrides = {
      md: {
        "tile-1": { x: 3, y: 4, w: 5, h: 6 },
      },
    };
    const store = makeStore(grid);
    store.forcedBreakpoint = "md";
    storeHolder.current = store;
    const { default: GridComponent } = await import(
      "@/components/grid/Grid.vue"
    );
    const wrapper = mount(GridComponent);
    await flushPromises();

    store.currentGrid.tiles[0]!.content = {
      type: ContentType.LINK,
      link: "https://example.com",
      metaTitle: "Fetched title",
      metaDescription: "Fetched description",
    } as LinkContent;
    await nextTick();

    const renderedTile = wrapper
      .findComponent({ name: "GridTileStub" })
      .props("tile") as Tile;
    expect(renderedTile.content).toEqual(
      expect.objectContaining({
        metaTitle: "Fetched title",
        metaDescription: "Fetched description",
      }),
    );

    wrapper.unmount();
  });

  it("consumes override rebuild suppression without replacing rendered layout", async () => {
    const store = makeStore();
    store.forcedBreakpoint = "md";
    storeHolder.current = store;
    const { default: GridComponent } = await import(
      "@/components/grid/Grid.vue"
    );
    const wrapper = mount(GridComponent);
    await flushPromises();
    const before = wrapper
      .findComponent({ name: "GridLayoutStub" })
      .props("layout") as Tile[];

    store.skipOverrideRebuild = true;
    store.currentGrid.overrides = {
      md: {
        "tile-1": { x: 3, y: 4, w: 4, h: 4 },
      },
    };
    await nextTick();

    const after = wrapper
      .findComponent({ name: "GridLayoutStub" })
      .props("layout") as Tile[];
    expect(store.skipOverrideRebuild).toBe(false);
    expect(after).toBe(before);
    expect(after[0]).toEqual(
      expect.objectContaining({ x: 0, y: 0, w: 2, h: 2 }),
    );

    wrapper.unmount();
  });
});
