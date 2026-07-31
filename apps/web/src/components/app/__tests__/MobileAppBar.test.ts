import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive, ref } from "vue";

const holder = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  history: null as Record<string, unknown> | null,
  controller: null as Record<string, unknown> | null,
}));

// Module scope rather than `vi.hoisted`, because `ref` is not available that
// early. The mock factory below only runs when the component is imported inside
// a test, by which point this is initialized.
const isPreviewActive = ref(false);

vi.mock("@/composables/useGridPreview", () => ({
  useGridPreview: () => ({ isPreviewActive }),
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

vi.mock("@/components/ui-elements/Button.vue", () => ({
  default: {
    template: '<button class="app-button"><slot /></button>',
  },
}));

async function mountBar(props: Record<string, unknown> = {}) {
  const { default: MobileAppBar } = await import("../MobileAppBar.vue");
  return mount(MobileAppBar, { props });
}

describe("MobileAppBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPreviewActive.value = false;
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

  it("slides up out of view while previewing", async () => {
    const wrapper = await mountBar();
    expect(wrapper.classes()).not.toContain("mobile-app-bar--hidden");

    isPreviewActive.value = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.classes()).toContain("mobile-app-bar--hidden");
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

  it("selects the whole title on focus so typing replaces it", async () => {
    const removeAllRanges = vi.fn();
    const addRange = vi.fn();
    vi.spyOn(window, "getSelection").mockReturnValue({
      removeAllRanges,
      addRange,
    } as unknown as Selection);

    const wrapper = await mountBar();
    await wrapper.find(".mab-title").trigger("focus");

    expect(removeAllRanges).toHaveBeenCalled();
    expect(addRange).toHaveBeenCalledTimes(1);
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

  it("shows a static 'Your Grids' title and New Grid button in home mode", async () => {
    const wrapper = await mountBar({ mode: "home" });
    const title = wrapper.get(".mab-title");
    expect(title.text()).toBe("Your Grids");
    expect(title.attributes("contenteditable")).toBeUndefined();
    expect(wrapper.find('[aria-label="Undo"]').exists()).toBe(false);
    expect(wrapper.get(".app-button").text()).toBe("New Grid");
  });

  it("emits new-grid when the New Grid button is tapped in home mode", async () => {
    const wrapper = await mountBar({ mode: "home" });
    await wrapper.get(".app-button").trigger("click");
    expect(wrapper.emitted("new-grid")).toHaveLength(1);
  });
});
