import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";

const storeHolder = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  controller: null as Record<string, unknown> | null,
}));

vi.mock("@/stores/grid/gridSession", () => ({
  useGridSessionStore: () => storeHolder.session,
}));

vi.mock("@/stores/grid/gridViewport", () => ({
  useGridViewportStore: () => ({
    forcedBreakpoint: null,
    viewportBreakpoint: "lg",
  }),
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => storeHolder.controller,
}));

vi.mock("@/components/grid/GridStats.vue", () => ({
  default: { template: "<span data-test=\"grid-stats\" />" },
}));

vi.mock("@/components/ui-elements/Button.vue", () => ({
  default: { template: "<button><slot /><slot name=\"icon-left\" /></button>" },
}));

vi.mock("@/components/icons/ExploreIcon.vue", () => ({
  default: { template: "<span />" },
}));

describe("GridNameEditor characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    class ResizeObserverStub {
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("requests a typed current-grid rename without mutating canonical state directly", async () => {
    const session = reactive({
      isOwner: true,
      currentGrid: { id: "grid-1", name: "Old name" },
      canEditAtBreakpoint: vi.fn(() => true),
    });
    const controller = reactive({
      canEditCurrentGrid: vi.fn(() => true),
      renameCurrentGrid: vi.fn(),
      saveGrid: vi.fn(),
      pushUndoSnapshot: vi.fn(),
    });
    storeHolder.session = session;
    storeHolder.controller = controller;
    const { default: GridNameEditor } = await import(
      "@/components/grid/GridNameEditor.vue"
    );
    const wrapper = mount(GridNameEditor, {
      props: { isAuthenticated: true },
    });

    const title = wrapper.find<HTMLElement>(".editable-text");
    title.element.innerText = "  New name  ";
    await title.trigger("blur");

    expect(controller.renameCurrentGrid).toHaveBeenCalledWith("New name");
    expect(session.currentGrid.name).toBe("Old name");
    expect(controller.saveGrid).not.toHaveBeenCalled();
    expect(controller.pushUndoSnapshot).not.toHaveBeenCalled();
    expect(wrapper.find(".editable-text").text()).toBe("New name");
  });

  it("does not mutate or save when editing is not allowed", async () => {
    const session = reactive({
      isOwner: true,
      currentGrid: { id: "grid-1", name: "Old name" },
      canEditAtBreakpoint: vi.fn(() => false),
    });
    const controller = reactive({
      canEditCurrentGrid: vi.fn(() => false),
      renameCurrentGrid: vi.fn(),
      saveGrid: vi.fn(),
    });
    storeHolder.session = session;
    storeHolder.controller = controller;
    const { default: GridNameEditor } = await import(
      "@/components/grid/GridNameEditor.vue"
    );
    const wrapper = mount(GridNameEditor, {
      props: { isAuthenticated: true },
    });

    const title = wrapper.find<HTMLElement>(".editable-text");
    title.element.innerText = "New name";
    await title.trigger("blur");

    expect(session.currentGrid.name).toBe("Old name");
    expect(controller.renameCurrentGrid).not.toHaveBeenCalled();
    expect(controller.saveGrid).not.toHaveBeenCalled();
  });
});
