import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h, ref } from "vue";
import type { MobileEditorView } from "@/utils/mobileEditorView";

const m = vi.hoisted(() => ({
  clearMobileEditor: vi.fn(),
  setMobileOpenTool: vi.fn(),
  finishMobileArrange: vi.fn(),
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => ({
    clearMobileEditor: m.clearMobileEditor,
    setMobileOpenTool: m.setMobileOpenTool,
    setMobileSheetExpanded: vi.fn(),
    finishMobileArrange: m.finishMobileArrange,
    pruneMobileEditor: vi.fn(),
  }),
}));
vi.mock("@/composables/useGridPreview", () => ({
  useGridPreview: () => ({ isPreviewActive: ref(false) }),
}));
vi.mock("@/composables/useMobileTileEdit", () => ({
  useMobileTileEdit: () => ({ handle: ref(null) }),
  stopTileTyping: vi.fn(),
}));

/** A pointer event of the given type (jsdom has no PointerEvent). */
const pointer = (
  type: "pointerdown" | "pointerup",
  pointerType: string,
  x = 10,
  y = 10,
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  return event;
};

const click = (target: Element, pointerType = "mouse", moveBy = 0) => {
  target.dispatchEvent(pointer("pointerdown", pointerType));
  target.dispatchEvent(pointer("pointerup", pointerType, 10 + moveBy, 10));
};

describe("useMobileEditorLifecycle — empty-space clicks", () => {
  let empty: HTMLElement;
  let tile: HTMLElement;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    empty = document.createElement("div");
    tile = document.createElement("div");
    tile.setAttribute("data-griddle-tile", "a");
    document.body.append(empty, tile);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  const mountLifecycle = async (view: MobileEditorView) => {
    const { useMobileEditorLifecycle } = await import(
      "../useMobileEditorLifecycle"
    );
    return mount(
      defineComponent({
        setup() {
          useMobileEditorLifecycle(ref(view));
          return () => h("div");
        },
      }),
      { attachTo: document.body },
    );
  };

  it("a mouse click on empty space deselects, like a tap", async () => {
    const wrapper = await mountLifecycle({ kind: "tile", tileId: "a" });
    click(empty);
    expect(m.clearMobileEditor).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("peels one layer: a click closes an open card first", async () => {
    const wrapper = await mountLifecycle({
      kind: "popover",
      tileId: "a",
      toolId: "fill",
    });
    const { useGridUiStore } = await import("@/stores/grid/gridUi");
    const ui = useGridUiStore();
    ui.setMobileEditTile("a");
    ui.setMobileOpenTool("fill");
    click(empty);
    expect(m.setMobileOpenTool).toHaveBeenCalledWith(null);
    expect(m.clearMobileEditor).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("ignores clicks on tiles, drags, and touch (handled on touchend)", async () => {
    const wrapper = await mountLifecycle({ kind: "tile", tileId: "a" });
    click(tile);
    click(empty, "mouse", 40);
    click(empty, "touch");
    expect(m.clearMobileEditor).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
