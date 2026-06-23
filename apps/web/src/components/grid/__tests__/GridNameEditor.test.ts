import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/stores/grid", () => ({
  useGridStore: () => storeHolder.current,
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

  it("renames the active grid directly and requests one save without history", async () => {
    const store = reactive({
      isOwner: true,
      canEdit: true,
      currentGrid: { id: "grid-1", name: "Old name" },
      saveGrid: vi.fn(),
      pushUndoSnapshot: vi.fn(),
    });
    storeHolder.current = store;
    const { default: GridNameEditor } = await import(
      "@/components/grid/GridNameEditor.vue"
    );
    const wrapper = mount(GridNameEditor, {
      props: { isAuthenticated: true },
    });

    const title = wrapper.find<HTMLElement>(".editable-text");
    title.element.innerText = "  New name  ";
    await title.trigger("blur");

    expect(store.currentGrid.name).toBe("New name");
    expect(store.saveGrid).toHaveBeenCalledTimes(1);
    expect(store.pushUndoSnapshot).not.toHaveBeenCalled();
    expect(wrapper.find(".editable-text").text()).toBe("New name");
  });

  it("does not mutate or save when editing is not allowed", async () => {
    const store = reactive({
      isOwner: true,
      canEdit: false,
      currentGrid: { id: "grid-1", name: "Old name" },
      saveGrid: vi.fn(),
    });
    storeHolder.current = store;
    const { default: GridNameEditor } = await import(
      "@/components/grid/GridNameEditor.vue"
    );
    const wrapper = mount(GridNameEditor, {
      props: { isAuthenticated: true },
    });

    const title = wrapper.find<HTMLElement>(".editable-text");
    title.element.innerText = "New name";
    await title.trigger("blur");

    expect(store.currentGrid.name).toBe("Old name");
    expect(store.saveGrid).not.toHaveBeenCalled();
  });
});
