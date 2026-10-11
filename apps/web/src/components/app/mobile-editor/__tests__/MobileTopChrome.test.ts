import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import type { MobileEditorView } from "@/utils/mobileEditorView";

const m = vi.hoisted(() => ({
  view: null as unknown as import("vue").Ref<MobileEditorView>,
  multiActive: null as unknown as import("vue").Ref<boolean>,
  clearMobileEditor: vi.fn(),
  enter: vi.fn(),
  exit: vi.fn(),
}));

vi.mock("@/composables/useMobileEditorView", () => ({
  useMobileEditorView: () => ({ view: m.view }),
}));
vi.mock("@/composables/useMobileEditorLifecycle", () => ({
  useMobileEditorLifecycle: () => {},
}));
vi.mock("@/composables/useTopBarMorph", () => ({
  useTopBarMorph: () => {},
}));
vi.mock("@/composables/useMobileMultiEdit", async () => {
  const { computed } = await import("vue");
  return {
    useMobileMultiEdit: () => ({
      active: computed(() => m.multiActive.value),
      tiles: computed(() => (m.multiActive.value ? [{ i: "a" }] : [])),
      enter: m.enter,
      exit: m.exit,
    }),
  };
});
vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => ({
    clearMobileEditor: m.clearMobileEditor,
    undo: vi.fn(),
    redo: vi.fn(),
  }),
}));

const mountChrome = async () => {
  const { default: MobileTopChrome } = await import("../MobileTopChrome.vue");
  return mount(MobileTopChrome);
};

describe("MobileTopChrome", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    m.view = ref<MobileEditorView>({ kind: "tile", tileId: "a" });
    m.multiActive = ref(false);
  });

  it("offers a ✕ that deselects, beside the Multi edit pill", async () => {
    const wrapper = await mountChrome();
    const close = wrapper.get('button[aria-label="Close"]');
    expect(close.classes()).not.toContain("mtc-close--tucked");
    expect(close.attributes("tabindex")).toBe("0");
    await close.trigger("click");
    expect(m.clearMobileEditor).toHaveBeenCalledTimes(1);
  });

  it("tucks the ✕ away in multi-edit, where the pill has its own", async () => {
    m.multiActive.value = true;
    m.view.value = { kind: "multi", tileIds: ["a"] };
    const wrapper = await mountChrome();
    const close = wrapper.get('button[aria-label="Close"]');
    expect(close.classes()).toContain("mtc-close--tucked");
    expect(close.attributes("tabindex")).toBe("-1");
  });

  it("tucks the ✕ away while typing, where the bar has Done", async () => {
    m.view.value = { kind: "typing", tileId: "a" };
    const wrapper = await mountChrome();
    expect(
      wrapper.get('button[aria-label="Close"]').classes(),
    ).toContain("mtc-close--tucked");
  });

  it("hides everything with nothing selected", async () => {
    m.view.value = { kind: "home" };
    const wrapper = await mountChrome();
    expect(wrapper.classes()).not.toContain("mobile-top-chrome--shown");
    expect(wrapper.attributes("aria-hidden")).toBe("true");
  });
});
