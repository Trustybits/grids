import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { ContentType, type Tile } from "@grids/contracts/types";
import TileToolbar from "../TileToolbar.vue";
import { TILE_GEOMETRY_VERSION } from "@/grid-context/tileInteractionKeys";

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => ({
    activeTileId: null,
    activePanelId: null,
    displayPositions: [],
    resizeTile: vi.fn(),
    closeMenus: vi.fn(),
  }),
}));

vi.mock("@/registries/tileToolbar", () => ({
  getTileToolbarButtons: () => [],
}));

describe("TileToolbar positioning", () => {
  it("stays hidden until measured and follows Griddle geometry changes", async () => {
    const geometryVersion = ref(0);
    const toolbarVisible = ref(false);
    const tile: Tile = {
      i: "tile-1",
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      caption: "",
      content: {
        type: ContentType.LINK,
        link: "https://example.com",
      },
    } as Tile;
    const wrapper = mount(TileToolbar, {
      props: {
        tile,
        toolbarRefs: {
          childComponent: ref(null),
          isEditing: ref(false),
          isExitingCropMode: ref(false),
        },
      },
      global: {
        provide: {
          [TILE_GEOMETRY_VERSION as symbol]: geometryVersion,
          tileToolbarVisible: toolbarVisible,
          hoveredToolbarZone: ref(null),
        },
      },
    });
    await nextTick();
    expect(
      (wrapper.vm as unknown as { floatingStyle: Record<string, string> })
        .floatingStyle,
    ).toEqual({ visibility: "hidden" });

    const anchor = wrapper.find(".tile-toolbar-anchor").element;
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      bottom: 500,
      left: 200,
      width: 300,
    } as DOMRect);

    toolbarVisible.value = true;
    await nextTick();
    await nextTick();

    expect(
      (wrapper.vm as unknown as { floatingStyle: Record<string, string> })
        .floatingStyle,
    ).toEqual({
      top: "500px",
      left: "350px",
      visibility: "visible",
    });

    vi.mocked(anchor.getBoundingClientRect).mockReturnValue({
      bottom: 640,
      left: 240,
      width: 320,
    } as DOMRect);
    geometryVersion.value++;
    await nextTick();
    await nextTick();

    expect(
      (wrapper.vm as unknown as { floatingStyle: Record<string, string> })
        .floatingStyle,
    ).toEqual({
      top: "640px",
      left: "400px",
      visibility: "visible",
    });
    wrapper.unmount();
  });
});
