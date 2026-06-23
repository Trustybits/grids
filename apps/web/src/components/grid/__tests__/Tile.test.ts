import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import {
  ContentType,
  type ImageContent,
  type LinkContent,
  type Tile,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/stores/grid", () => ({
  useGridStore: () => storeHolder.current,
}));

vi.mock("vue3-grid-layout", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    GridItem: defineComponent({
      name: "GridItemStub",
      emits: ["move", "moved", "resize", "resized"],
      props: {
        i: String,
        x: Number,
        y: Number,
        w: Number,
        h: Number,
      },
      setup(_props, { slots }) {
        return () => h("div", slots.default?.());
      },
    }),
  };
});

vi.mock("@/utils/TileUtils", async () => {
  const { defineComponent, h } = await import("vue");
  const ContentStub = defineComponent({
    name: "ContentStub",
    props: { content: Object },
    setup(props) {
      return () =>
        h("span", {
          "data-test": "content",
          "data-content-type": (props.content as { type?: string })?.type,
        });
    },
  });
  return {
    createTileContent: vi.fn((type: ContentType) => ({ type })),
    getContentComponent: vi.fn(async () => ContentStub),
    getOptionComponent: vi.fn(async () => null),
  };
});

vi.mock("@/registries/tileRegistry", () => ({
  getTileDefinition: () => ({
    capabilities: {},
  }),
}));

vi.mock("@/composables/useFileUpload", () => ({
  useFileUpload: () => ({
    uploadFileOptimisticForTile: vi.fn(),
  }),
}));

vi.mock("@/composables/useTileInput", () => ({
  useTileInput: () => ({
    submitLink: vi.fn(),
    submitEmbed: vi.fn(),
  }),
}));

function makeTile(): Tile {
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
    } as LinkContent,
  };
}

function makeStore(tile: Tile) {
  return reactive({
    activeBreakpoint: "md",
    activeTileId: null,
    canEdit: false,
    isOwner: false,
    currentGrid: { tiles: [tile] },
    pendingFocusTileId: null,
    showMetaData: false,
    showMetaDataVerbose: false,
    getCookieValue: vi.fn(() => null),
    beginMove: vi.fn(),
    commitMove: vi.fn(),
    beginResize: vi.fn(),
    commitResize: vi.fn(),
    removeTile: vi.fn(),
    setTileContent: vi.fn(),
  });
}

async function mountGridTile(
  store: ReturnType<typeof makeStore>,
  layout: GridLayoutItem,
) {
  storeHolder.current = store;
  const { default: GridTile } = await import("@/components/grid/Tile.vue");
  const wrapper = mount(GridTile, {
    props: { tile: store.currentGrid.tiles[0]!, layout },
    global: {
      stubs: {
        TileActions: true,
        TileCaption: true,
        TileToolbar: true,
        FloatingInputModal: true,
      },
    },
  });
  await flushPromises();
  return {
    gridItem: wrapper.findComponent({ name: "GridItemStub" }),
    wrapper,
  };
}

describe("GridTile position-only rendering", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("uses layout geometry while rendering canonical tile content", async () => {
    const tile = makeTile();
    const store = makeStore(tile);
    storeHolder.current = store;
    const layout: GridLayoutItem = {
      i: "tile-1",
      x: 3,
      y: 4,
      w: 5,
      h: 6,
    };
    const { gridItem, wrapper } = await mountGridTile(store, layout);

    expect(gridItem.props()).toEqual(
      expect.objectContaining({
        i: "tile-1",
        x: 3,
        y: 4,
        w: 5,
        h: 6,
      }),
    );
    expect(wrapper.find(".tile-wrapper").attributes()).toEqual(
      expect.objectContaining({
        "data-tile-type": ContentType.LINK,
        "data-tile-w": "5",
        "data-tile-h": "6",
      }),
    );

    (store.currentGrid.tiles[0] as Tile).content = {
      type: ContentType.IMAGE,
      src: "https://cdn.example/image.png",
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    } as ImageContent;
    await flushPromises();

    expect(wrapper.find(".tile-wrapper").attributes("data-tile-type")).toBe(
      ContentType.IMAGE,
    );
    expect(gridItem.props()).toEqual(
      expect.objectContaining({ x: 3, y: 4, w: 5, h: 6 }),
    );

    wrapper.unmount();
  });

  it("leaves canonical dimensions unchanged during live desktop resize and commits once", async () => {
    const tile = makeTile();
    const store = makeStore(tile);
    store.activeBreakpoint = "lg";
    store.canEdit = true;
    const layout: GridLayoutItem = {
      i: "tile-1",
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    };
    const { gridItem, wrapper } = await mountGridTile(store, layout);

    gridItem.vm.$emit("resize", "tile-1", 5.6, 4.4, 560, 440);
    gridItem.vm.$emit("resized");
    await flushPromises();

    expect(store.beginResize).toHaveBeenCalledTimes(1);
    expect(store.currentGrid.tiles[0]).toEqual(
      expect.objectContaining({ w: 2, h: 2 }),
    );
    expect(store.commitResize).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it("keeps canonical dimensions unchanged during a non-desktop resize and commits rendered geometry", async () => {
    const tile = makeTile();
    const store = makeStore(tile);
    store.activeBreakpoint = "md";
    store.canEdit = true;
    const layout: GridLayoutItem = {
      i: "tile-1",
      x: 3,
      y: 4,
      w: 2,
      h: 2,
    };
    const { gridItem, wrapper } = await mountGridTile(store, layout);

    layout.w = 5;
    layout.h = 6;
    gridItem.vm.$emit("resize", "tile-1", 6, 5, 600, 500);
    gridItem.vm.$emit("resized");
    await flushPromises();

    expect(store.beginResize).toHaveBeenCalledTimes(1);
    expect(store.currentGrid.tiles[0]).toEqual(
      expect.objectContaining({ w: 2, h: 2 }),
    );
    expect(layout).toEqual(
      expect.objectContaining({ x: 3, y: 4, w: 5, h: 6 }),
    );
    expect(store.commitResize).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it("commits a completed move", async () => {
    const tile = makeTile();
    const store = makeStore(tile);
    store.canEdit = true;
    const layout: GridLayoutItem = {
      i: "tile-1",
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    };
    const { gridItem, wrapper } = await mountGridTile(store, layout);

    gridItem.vm.$emit("move");
    gridItem.vm.$emit("moved");
    await flushPromises();

    expect(store.beginMove).toHaveBeenCalledTimes(1);
    expect(store.commitMove).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
