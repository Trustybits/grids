import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { reactive } from "vue";

// The toolbar listens for Escape on `document`, so a wrapper left mounted keeps
// listening and answers the next test's key events too.
enableAutoUnmount(afterEach);

const holder = vi.hoisted(() => ({
  viewport: null as Record<string, unknown> | null,
  setForcedBreakpoint: vi.fn(),
  exitPreview: vi.fn(),
}));

vi.mock("@/stores/grid/gridViewport", () => ({
  useGridViewportStore: () => holder.viewport,
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => ({
    setForcedBreakpoint: holder.setForcedBreakpoint,
  }),
}));

vi.mock("@/composables/useGridPreview", () => ({
  useGridPreview: () => ({ exitPreview: holder.exitPreview }),
}));

const iconStub = { default: { template: "<span class='icon' />" } };
vi.mock("@/components/icons/PreviewDesktopIcon.vue", () => iconStub);
vi.mock("@/components/icons/PreviewTabletIcon.vue", () => iconStub);
vi.mock("@/components/icons/PreviewMobileIcon.vue", () => iconStub);
vi.mock("@/components/icons/CloseIcon.vue", () => iconStub);

const mountToolbar = async () => {
  const { default: MobilePreviewToolbar } = await import(
    "../MobilePreviewToolbar.vue"
  );
  return mount(MobilePreviewToolbar, { attachTo: document.body });
};

const button = (
  wrapper: Awaited<ReturnType<typeof mountToolbar>>,
  label: string,
) => wrapper.get(`[aria-label="${label}"]`);

describe("MobilePreviewToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holder.viewport = reactive({ renderedBreakpoint: "sm" });
  });

  it("offers the three device widths and a way out", async () => {
    const wrapper = await mountToolbar();
    expect(
      wrapper.findAll("button").map((btn) => btn.attributes("aria-label")),
    ).toEqual([
      "Preview at desktop width",
      "Preview at tablet width",
      "Preview at mobile width",
      "Close preview",
    ]);
  });

  it("marks the breakpoint the canvas is actually rendering", async () => {
    const wrapper = await mountToolbar();
    const mobile = button(wrapper, "Preview at mobile width");
    const desktop = button(wrapper, "Preview at desktop width");

    expect(mobile.classes()).toContain("is-active");
    expect(mobile.attributes("aria-pressed")).toBe("true");
    expect(desktop.classes()).not.toContain("is-active");
    expect(desktop.attributes("aria-pressed")).toBe("false");
  });

  it("follows the rendered breakpoint when it changes", async () => {
    const wrapper = await mountToolbar();
    holder.viewport!.renderedBreakpoint = "lg";
    await wrapper.vm.$nextTick();

    expect(button(wrapper, "Preview at desktop width").classes()).toContain(
      "is-active",
    );
    expect(
      button(wrapper, "Preview at mobile width").classes(),
    ).not.toContain("is-active");
  });

  it("forces the breakpoint that was tapped", async () => {
    const wrapper = await mountToolbar();
    await button(wrapper, "Preview at tablet width").trigger("click");
    expect(holder.setForcedBreakpoint).toHaveBeenCalledWith("md");
  });

  it("does nothing when the breakpoint already on screen is tapped", async () => {
    // Clearing the override would fall back to the same breakpoint while losing
    // the highlight, so the button would read as broken.
    const wrapper = await mountToolbar();
    await button(wrapper, "Preview at mobile width").trigger("click");
    expect(holder.setForcedBreakpoint).not.toHaveBeenCalled();
  });

  it("exits preview from the close button", async () => {
    const wrapper = await mountToolbar();
    await button(wrapper, "Close preview").trigger("click");
    expect(holder.exitPreview).toHaveBeenCalledTimes(1);
  });

  it("exits preview on Escape", async () => {
    await mountToolbar();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(holder.exitPreview).toHaveBeenCalledTimes(1);
  });

  it("stops listening for Escape once unmounted", async () => {
    const wrapper = await mountToolbar();
    wrapper.unmount();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(holder.exitPreview).not.toHaveBeenCalled();
  });
});
