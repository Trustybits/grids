import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import { ContentType, type Tile } from "@grids/contracts/types";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/stores/grid", () => ({
  useGridStore: () => storeHolder.current,
}));

function makeTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "Old caption",
    content: { type: ContentType.TEXT },
    ...overrides,
  } as Tile;
}

describe("TileCaption characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the canonical caption and requests one save", async () => {
    const canonicalTile = makeTile();
    const store = reactive({
      canEdit: true,
      currentGrid: { tiles: [canonicalTile] },
      updateGrid: vi.fn(),
    });
    storeHolder.current = store;
    const { default: TileCaption } = await import(
      "@/components/tile/TileCaption.vue"
    );
    const wrapper = mount(TileCaption, {
      props: { tile: store.currentGrid.tiles[0] },
    });

    await wrapper.find(".tile-caption").trigger("click");
    const input = wrapper.find<HTMLElement>(".caption-input");
    input.element.innerText = "  New caption  ";
    await input.trigger("blur");

    expect(store.currentGrid.tiles[0]?.caption).toBe("New caption");
    expect(store.updateGrid).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".caption-text").text()).toBe("New caption");
  });

  it("does not enter edit mode for a read-only viewer", async () => {
    const tile = makeTile();
    const store = reactive({
      canEdit: false,
      currentGrid: { tiles: [tile] },
      updateGrid: vi.fn(),
    });
    storeHolder.current = store;
    const { default: TileCaption } = await import(
      "@/components/tile/TileCaption.vue"
    );
    const wrapper = mount(TileCaption, { props: { tile } });

    await wrapper.find(".tile-caption").trigger("click");

    expect(wrapper.find(".caption-input").exists()).toBe(false);
    expect(store.updateGrid).not.toHaveBeenCalled();
  });

  it("abandons an edit if permission is lost before save", async () => {
    const canonicalTile = makeTile();
    const store = reactive({
      canEdit: true,
      currentGrid: { tiles: [canonicalTile] },
      updateGrid: vi.fn(),
    });
    storeHolder.current = store;
    const { default: TileCaption } = await import(
      "@/components/tile/TileCaption.vue"
    );
    const wrapper = mount(TileCaption, {
      props: { tile: store.currentGrid.tiles[0] },
    });

    await wrapper.find(".tile-caption").trigger("click");
    const input = wrapper.find<HTMLElement>(".caption-input");
    input.element.innerText = "New caption";
    store.canEdit = false;
    await input.trigger("blur");

    expect(canonicalTile.caption).toBe("Old caption");
    expect(store.updateGrid).not.toHaveBeenCalled();
    expect(wrapper.find(".caption-input").exists()).toBe(false);
  });
});
