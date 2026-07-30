import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useGridPreviewStore } from "@/stores/grid/gridPreview";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import type { Grid } from "@grids/contracts/types";

vi.mock("@/components/ui-elements/Banner.vue", () => ({
  default: {
    name: "Banner",
    props: ["severity", "dismissible", "transitionName"],
    template: "<div class='banner'><slot /></div>",
  },
}));

const iconStub = { default: { template: "<span />" } };
vi.mock("@/components/icons/EyeIcon.vue", () => iconStub);
vi.mock("@/components/icons/WarningTriangleIcon.vue", () => iconStub);

const mountWarning = async () => {
  const { default: ViewportWarning } = await import("../ViewportWarning.vue");
  return mount(ViewportWarning, { props: { type: "breakpoint-preview" } });
};

describe("ViewportWarning", () => {
  // The global test setup already creates a fresh Pinia per test and installs it
  // as a plugin on mounted components. Creating another one here would leave the
  // test mutating a different instance than the component reads from.
  beforeEach(() => {
    useGridSessionStore().setCurrentGrid({ id: "grid-1" } as Grid);
  });

  it("warns that a breakpoint wider than the screen is view only", async () => {
    const viewport = useGridViewportStore();
    viewport.setViewportBreakpoint("sm");
    viewport.setForcedBreakpoint("md");

    const wrapper = await mountWarning();

    expect(wrapper.find(".banner").text()).toContain(
      "Previewing Tablet layout — view only",
    );
  });

  it("stays quiet with no breakpoint forced", async () => {
    useGridViewportStore().setViewportBreakpoint("sm");
    const wrapper = await mountWarning();
    expect(wrapper.find(".banner").exists()).toBe(false);
  });

  it("stays quiet for a breakpoint the screen can actually edit", async () => {
    const viewport = useGridViewportStore();
    viewport.setViewportBreakpoint("lg");
    viewport.setForcedBreakpoint("sm");

    const wrapper = await mountWarning();

    expect(wrapper.find(".banner").exists()).toBe(false);
  });

  it("stays quiet during a deliberate preview", async () => {
    // Preview is read-only by design and its toolbar already names the device,
    // so the banner would be noise — and a preview is meant to show the grid
    // without exactly this kind of chrome.
    const viewport = useGridViewportStore();
    viewport.setViewportBreakpoint("sm");
    viewport.setForcedBreakpoint("md");
    useGridPreviewStore().startPreview({
      kind: "mobile-breakpoint",
      gridId: "grid-1",
    });

    const wrapper = await mountWarning();

    expect(wrapper.find(".banner").exists()).toBe(false);
  });

  it("still warns when the preview belongs to a different grid", async () => {
    const viewport = useGridViewportStore();
    viewport.setViewportBreakpoint("sm");
    viewport.setForcedBreakpoint("md");
    useGridPreviewStore().startPreview({
      kind: "mobile-breakpoint",
      gridId: "some-other-grid",
    });

    const wrapper = await mountWarning();

    expect(wrapper.find(".banner").exists()).toBe(true);
  });
});
