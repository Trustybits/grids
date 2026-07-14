import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";

const holder = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  history: null as Record<string, unknown> | null,
  controller: null as Record<string, unknown> | null,
}));

vi.mock("@/stores/grid/gridSession", () => ({
  useGridSessionStore: () => holder.session,
}));

vi.mock("@/stores/grid/gridViewport", () => ({
  useGridViewportStore: () => ({
    forcedBreakpoint: null,
    viewportBreakpoint: "lg",
  }),
}));

vi.mock("@/stores/grid/gridHistory", () => ({
  useGridHistoryStore: () => holder.history,
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => holder.controller,
}));

vi.mock("@/components/icons/MenuIcon.vue", () => ({
  default: { template: "<span />" },
}));

vi.mock("@/components/icons/UndoIcon.vue", () => ({
  default: { template: "<span />" },
}));

async function mountBar() {
  const { default: MobileAppBar } = await import("../MobileAppBar.vue");
  return mount(MobileAppBar);
}

describe("MobileAppBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holder.session = reactive({
      currentGrid: { id: "grid-1", name: "Old name" },
      canEditAtBreakpoint: vi.fn(() => true),
    });
    holder.history = reactive({ canUndo: true });
    holder.controller = reactive({
      renameCurrentGrid: vi.fn(),
      undo: vi.fn(),
    });
  });

  it("emits open-menu when the hamburger is tapped", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Open menu"]').trigger("click");
    expect(wrapper.emitted("open-menu")).toHaveLength(1);
  });

  it("requests a typed rename on blur without mutating canonical state", async () => {
    const wrapper = await mountBar();
    const title = wrapper.find<HTMLElement>(".mab-title");
    title.element.innerText = "  New name  ";
    await title.trigger("blur");

    expect(
      (holder.controller as { renameCurrentGrid: ReturnType<typeof vi.fn> })
        .renameCurrentGrid,
    ).toHaveBeenCalledWith("New name");
    expect(
      (holder.session as { currentGrid: { name: string } }).currentGrid.name,
    ).toBe("Old name");
  });

  it("does not rename when editing is not permitted", async () => {
    (
      holder.session as { canEditAtBreakpoint: ReturnType<typeof vi.fn> }
    ).canEditAtBreakpoint = vi.fn(() => false);
    const wrapper = await mountBar();
    const title = wrapper.find<HTMLElement>(".mab-title");
    title.element.innerText = "New name";
    await title.trigger("blur");

    expect(
      (holder.controller as { renameCurrentGrid: ReturnType<typeof vi.fn> })
        .renameCurrentGrid,
    ).not.toHaveBeenCalled();
  });

  it("triggers undo and reflects the disabled state from history", async () => {
    const wrapper = await mountBar();
    const undo = wrapper.get('[aria-label="Undo"]');
    expect(undo.attributes("disabled")).toBeUndefined();
    await undo.trigger("click");
    expect(
      (holder.controller as { undo: ReturnType<typeof vi.fn> }).undo,
    ).toHaveBeenCalled();
  });

  it("disables undo when there is nothing to undo", async () => {
    (holder.history as { canUndo: boolean }).canUndo = false;
    const wrapper = await mountBar();
    expect(
      wrapper.get('[aria-label="Undo"]').attributes("disabled"),
    ).toBeDefined();
  });
});
