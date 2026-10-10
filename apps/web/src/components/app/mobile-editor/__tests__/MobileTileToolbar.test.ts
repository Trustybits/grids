import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { computed, ref } from "vue";
import { ContentType, type Tile } from "@grids/contracts/types";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useToastStore } from "@/stores/toast";

const h = vi.hoisted(() => ({
  handle: null as null | { remove: () => void },
  duplicateTile: vi.fn(() => "copy-1"),
  removeTiles: vi.fn(),
  displayPositions: [] as { i: string; x: number; y: number; w: number; h: number }[],
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => {
    const ui = useGridUiStore();
    return {
      setMobileEditTile: (id: string | null) => ui.setMobileEditTile(id),
      setMobileOpenTool: (id: string | null) => ui.setMobileOpenTool(id),
      setMobileArrangeTile: (id: string | null) => ui.setMobileArrangeTile(id),
      undo: vi.fn(),
    };
  },
}));

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => ({
    duplicateTile: h.duplicateTile,
    displayPositions: ref(h.displayPositions),
  }),
}));

vi.mock("@/composables/useMobileExperience", () => ({
  useMobileExperience: () => ({ isUnifiedText: ref(true) }),
}));

vi.mock("@/composables/useMobileTileEdit", () => ({
  useMobileTileEdit: () => ({ handle: computed(() => h.handle) }),
}));

vi.mock("@/composables/useTileActions", () => ({
  useTileActions: () => ({
    resolvedTileUrl: ref(""),
    hasDownload: ref(false),
    copyToClipboard: vi.fn(),
    download: vi.fn(),
  }),
}));

vi.mock("@/composables/useGridEngineBridge", () => ({
  getGridEngineBridge: () => ({
    removeTiles: h.removeTiles,
    tileRect: () => null,
  }),
}));

const imageTile = (): Tile =>
  ({
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    borderEnabled: true,
    content: { type: ContentType.IMAGE, src: "a.png" },
  }) as Tile;

const mountToolbar = async (tile = imageTile()) => {
  const { default: MobileTileToolbar } = await import(
    "../MobileTileToolbar.vue"
  );
  const wrapper = mount(MobileTileToolbar, { props: { tile } });
  await flushPromises();
  return wrapper;
};

const tool = (wrapper: Awaited<ReturnType<typeof mountToolbar>>, id: string) =>
  wrapper.find(`[data-tool-id="${id}"]`);

describe("MobileTileToolbar", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    h.handle = null;
    h.duplicateTile.mockClear();
    h.removeTiles.mockClear();
    h.displayPositions = [{ i: "tile-1", x: 0, y: 0, w: 4, h: 3 }];
    useGridUiStore().setMobileEditTile("tile-1");
  });

  it("shows the tile type and its size on the phone layout", async () => {
    const wrapper = await mountToolbar();
    expect(wrapper.find(".mtt__title").text()).toBe("IMAGE TILE");
    expect(wrapper.find(".mtt__size").text()).toBe("4×3");
  });

  it("lists the tile's tools in order, Delete last and red", async () => {
    const wrapper = await mountToolbar();
    const ids = wrapper
      .findAll("[data-tool-id]")
      .map((el) => el.attributes("data-tool-id"));
    expect(ids).toEqual([
      "crop", "fill", "arrange", "link", "caption", "border", "duplicate",
      "delete",
    ]);
    expect(tool(wrapper, "delete").classes()).toContain("mtb--danger");
  });

  it("marks an enabled border as On", async () => {
    const wrapper = await mountToolbar();
    expect(tool(wrapper, "border").classes()).toContain("mtb--on");
  });

  it("selects a popover tool, and a second tap closes it", async () => {
    const wrapper = await mountToolbar();
    const ui = useGridUiStore();

    await tool(wrapper, "fill").trigger("click");
    expect(ui.mobileOpenToolId).toBe("fill");
    expect(tool(wrapper, "fill").classes()).toContain("mtb--selected");

    await tool(wrapper, "fill").trigger("click");
    expect(ui.mobileOpenToolId).toBeNull();
  });

  it("Arrange toggles move/resize for this tile", async () => {
    const wrapper = await mountToolbar();
    const ui = useGridUiStore();
    await tool(wrapper, "arrange").trigger("click");
    expect(ui.mobileArrangeTileId).toBe("tile-1");
    await tool(wrapper, "arrange").trigger("click");
    expect(ui.mobileArrangeTileId).toBeNull();
  });

  it("Duplicate selects the copy", async () => {
    const wrapper = await mountToolbar();
    await tool(wrapper, "duplicate").trigger("click");
    await flushPromises();
    expect(h.duplicateTile).toHaveBeenCalledWith("tile-1");
    expect(useGridUiStore().mobileEditTileId).toBe("copy-1");
    expect(useToastStore().toasts.map((t) => t.message)).toContain(
      "Tile duplicated",
    );
  });

  it("Delete uses the tile's own exit when its handle is live", async () => {
    const remove = vi.fn();
    h.handle = { remove };
    const wrapper = await mountToolbar();
    await tool(wrapper, "delete").trigger("click");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(h.removeTiles).not.toHaveBeenCalled();
    const toast = useToastStore().toasts[0];
    expect(toast?.action?.label).toBe("Undo");
  });

  it("Delete goes through the engine when the tile hasn't registered", async () => {
    const wrapper = await mountToolbar();
    await tool(wrapper, "delete").trigger("click");
    expect(h.removeTiles).toHaveBeenCalledWith(["tile-1"]);
  });
});
