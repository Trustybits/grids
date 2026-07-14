import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, nextTick, ref } from "vue";
import { ContentType, type Grid, type Tile } from "@grids/contracts/types";
import TileActions from "../TileActions.vue";
import { TILE_GEOMETRY_VERSION } from "@/grid-context/tileInteractionKeys";

const getShareableArchiveDownloadUrl = vi.fn();

const grid = computed(
  () =>
    ({
      id: "grid-1",
      userId: "owner-1",
      name: "Grid",
      colNum: 12,
      verticalCompact: true,
      backgroundImageSrc: "",
      backgroundEmbed: false,
      tiles: [],
    }) as Grid,
);

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => ({
    grid,
    duplicateTile: vi.fn(),
  }),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getStorageService: () => ({
      getShareableArchiveDownloadUrl,
    }),
  }),
}));

vi.mock("@/stores/toast", () => ({
  useToastStore: () => ({
    addToast: vi.fn(),
  }),
}));

const imageTile = (hash = "a".repeat(64)): Tile => ({
  i: "tile-1",
  x: 0,
  y: 0,
  w: 2,
  h: 2,
  caption: "",
  content: {
        type: ContentType.IMAGE,
        src: "https://cdn/source.png",
        srcHash: hash,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as never,
});

describe("TileActions archive downloads", () => {
  beforeEach(() => {
    getShareableArchiveDownloadUrl.mockReset();
  });

  it("hides archive-backed downloads when the server does not return a shareable URL", async () => {
    getShareableArchiveDownloadUrl.mockRejectedValueOnce(
      new Error("not shareable"),
    );

    const wrapper = mount(TileActions, {
      props: { tile: imageTile() },
      global: {
        stubs: { FloatingTooltip: { template: "<slot />" } },
      },
    });
    await flushPromises();

    expect(getShareableArchiveDownloadUrl).toHaveBeenCalledWith(
      "owner-1",
      "a".repeat(64),
    );
    expect((wrapper.vm as unknown as { hasDownload: boolean }).hasDownload).toBe(
      false,
    );
  });

  it("downloads the server-approved URL for shareable archive files", async () => {
    getShareableArchiveDownloadUrl.mockResolvedValueOnce(
      "https://cdn/shareable.png",
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const appendChild = vi.spyOn(document.body, "appendChild");
    const removeChild = vi.spyOn(document.body, "removeChild");

    const wrapper = mount(TileActions, {
      props: { tile: imageTile() },
      global: {
        stubs: { FloatingTooltip: { template: "<slot />" } },
      },
    });
    await flushPromises();

    expect((wrapper.vm as unknown as { hasDownload: boolean }).hasDownload).toBe(
      true,
    );
    await (wrapper.vm as unknown as { onDownload: () => Promise<void> }).onDownload();

    expect(click).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
  });

  it("repositions teleported actions when Griddle geometry changes", async () => {
    const geometryVersion = ref(0);
    const actionsVisible = ref(true);
    const wrapper = mount(TileActions, {
      props: { tile: imageTile() },
      global: {
        provide: {
          [TILE_GEOMETRY_VERSION as symbol]: geometryVersion,
          tileActionsVisible: actionsVisible,
        },
        stubs: { FloatingTooltip: { template: "<slot />" } },
      },
    });
    await nextTick();
    const anchor = wrapper.find(".tile-actions-anchor").element;
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      top: 125,
      right: 450,
    } as DOMRect);

    geometryVersion.value++;
    await nextTick();
    await nextTick();

    expect(
      (wrapper.vm as unknown as { floatingStyle: Record<string, string> })
        .floatingStyle,
    ).toEqual({ top: "125px", left: "450px" });
    wrapper.unmount();
  });
});
