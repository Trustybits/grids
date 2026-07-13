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

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => storeHolder.current,
}));

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
  const grid = { tiles: [tile] };

  return reactive({
    activeBreakpoint: "md",
    activeTileId: null,
    canEdit: false,
    isOwner: false,
    grid,
    currentGrid: grid,
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
  return { wrapper };
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
    const { wrapper } = await mountGridTile(store, layout);

    // Tile geometry (data-tile-w/h) is sourced from the layout slot prop that
    // Grid.vue derives from the Griddle tile — not a <GridItem> wrapper.
    expect(wrapper.find(".tile-wrapper").attributes()).toEqual(
      expect.objectContaining({
        "data-tile-type": ContentType.LINK,
        "data-tile-w": "5",
        "data-tile-h": "6",
      }),
    );

    // Content is read live from the canonical tile, independent of geometry.
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
    expect(wrapper.find(".tile-wrapper").attributes()).toEqual(
      expect.objectContaining({ "data-tile-w": "5", "data-tile-h": "6" }),
    );

    wrapper.unmount();
  });

  it("reflows child content when the tile footprint changes", async () => {
    const onResize = vi.fn();
    const tile = makeTile();
    const store = makeStore(tile);
    const layout: GridLayoutItem = { i: "tile-1", x: 0, y: 0, w: 2, h: 2 };
    const { wrapper } = await mountGridTile(store, layout);

    // Stand in for the resolved content component's onResize hook.
    (
      wrapper.vm as unknown as {
        childComponent: { onResize: () => void } | null;
      }
    ).childComponent = { onResize };

    await wrapper.setProps({
      layout: { i: "tile-1", x: 0, y: 0, w: 5, h: 6 },
    });
    await flushPromises();

    expect(onResize).toHaveBeenCalled();
    expect(wrapper.find(".tile-wrapper").attributes()).toEqual(
      expect.objectContaining({ "data-tile-w": "5", "data-tile-h": "6" }),
    );

    wrapper.unmount();
  });
});
