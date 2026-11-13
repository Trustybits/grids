import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { computed, reactive } from "vue";
import { ContentType, type Tile } from "@grids/contracts/types";
import { useGridUiStore } from "@/stores/grid/gridUi";

const m = vi.hoisted(() => ({
  history: { isBatching: false },
  begin: vi.fn(),
  commit: vi.fn(),
  patchTileContent: vi.fn(),
  setTileBorder: vi.fn(),
  updateCaption: vi.fn(),
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => {
    const ui = useGridUiStore();
    return {
      setMobileOpenTool: (id: string | null) => ui.setMobileOpenTool(id),
    };
  },
}));

vi.mock("@/stores/grid/gridHistory", () => ({
  useGridHistoryStore: () => m.history,
}));

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => ({
    beginHistoryBatch: m.begin,
    commitHistoryBatch: m.commit,
    patchTileContent: m.patchTileContent,
    setTileBorder: m.setTileBorder,
    updateCaption: m.updateCaption,
  }),
}));

vi.mock("@/composables/useMobileTileEdit", () => ({
  useMobileTileEdit: () => ({ handle: computed(() => null) }),
}));

const textTile = (): Tile =>
  ({
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    borderEnabled: true,
    content: { type: ContentType.TEXT, text: "", verticalAlign: "top" },
  }) as Tile;

const mountPopover = async (toolId: string) => {
  const { default: MobileToolPopover } = await import(
    "../MobileToolPopover.vue"
  );
  const wrapper = mount(MobileToolPopover, {
    props: { tiles: [textTile()], toolId: toolId as never },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
};

describe("MobileToolPopover", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    m.history = reactive({ isBatching: false });
    m.begin.mockImplementation(() => {
      if (m.history.isBatching) return false;
      m.history.isBatching = true;
      return true;
    });
    m.commit.mockImplementation(() => {
      m.history.isBatching = false;
    });
  });

  it("is a labelled dialog with the tool's heading and a close button", async () => {
    const wrapper = await mountPopover("border");
    const card = wrapper.get('[role="dialog"]');
    expect(card.attributes("aria-label")).toBe("Choose your border");
    expect(card.attributes("data-tile-edit-surface")).toBeDefined();
    expect(wrapper.get(".mtp__title").text()).toBe("Choose your border");
    expect(wrapper.get(".mtp__close").attributes("aria-label")).toBe("Close");
    wrapper.unmount();
  });

  it("the close button closes the tool", async () => {
    const wrapper = await mountPopover("border");
    // After mounting: the component's imports can swap the active store.
    const ui = useGridUiStore();
    ui.setMobileEditTile("tile-1");
    ui.setMobileOpenTool("border");
    await wrapper.get(".mtp__close").trigger("click");
    expect(ui.mobileOpenToolId).toBeNull();
    wrapper.unmount();
  });

  it("writes through the tool and closes the undo step on unmount", async () => {
    const wrapper = await mountPopover("border");
    const hide = wrapper
      .findAll(".ppc__option")
      .find((option) => option.text() === "Hide");
    await hide!.trigger("click");
    expect(m.setTileBorder).toHaveBeenCalledWith("tile-1", false);
    expect(m.begin).toHaveBeenCalledWith("Edit border");
    wrapper.unmount();
    expect(m.commit).toHaveBeenCalledTimes(1);
  });

  it("swaps the body in place and closes the previous tool's step", async () => {
    const wrapper = await mountPopover("border");
    await wrapper
      .findAll(".ppc__option")
      .find((option) => option.text() === "Hide")!
      .trigger("click");
    await wrapper.setProps({ toolId: "position" as never });
    await flushPromises();
    expect(m.commit).toHaveBeenCalledTimes(1);
    expect(wrapper.get(".mtp__title").text()).toBe("Position your text");
    expect(wrapper.text()).toContain("Middle");
    wrapper.unmount();
  });
});
