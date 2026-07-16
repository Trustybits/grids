import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  LEGACY_RESPONSIVE_LAYOUT_VERSION,
  type Grid,
} from "@grids/contracts/types";
import ResponsiveLayoutSettings from "@/components/grid/ResponsiveLayoutSettings.vue";
import BaseModal from "@/components/modal/BaseModal.vue";
import { useGridPreviewStore } from "@/stores/grid/gridPreview";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useToastStore } from "@/stores/toast";

const controllerMock = vi.hoisted(() => ({
  startResponsiveLayoutPreview: vi.fn(() => true),
  stopPreview: vi.fn(),
  upgradeResponsiveLayout: vi.fn(async () => true),
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => controllerMock,
}));

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    responsiveLayoutVersion: LEGACY_RESPONSIVE_LAYOUT_VERSION,
    responsiveLayoutVersionStatus: "supported",
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
    overrides: {},
    ...overrides,
  };
}

describe("ResponsiveLayoutSettings", () => {
  let pinia: Pinia;
  let session: ReturnType<typeof useGridSessionStore>;
  let preview: ReturnType<typeof useGridPreviewStore>;
  let viewport: ReturnType<typeof useGridViewportStore>;

  const mountSettings = () =>
    mount(ResponsiveLayoutSettings, {
      attachTo: document.body,
      global: { plugins: [pinia] },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PROD", false);
    pinia = createPinia();
    setActivePinia(pinia);
    session = useGridSessionStore(pinia);
    preview = useGridPreviewStore(pinia);
    viewport = useGridViewportStore(pinia);
    session.setCurrentGrid(makeGrid());
    session.setOwner(true);
    controllerMock.startResponsiveLayoutPreview.mockImplementation(() => {
      preview.startResponsiveLayoutPreview(session.currentGrid!.id);
      return true;
    });
    controllerMock.stopPreview.mockImplementation(() => {
      preview.stopPreview();
    });
    controllerMock.upgradeResponsiveLayout.mockResolvedValue(true);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllEnvs();
  });

  it("shows controls for owners of missing or explicit legacy versions", async () => {
    session.setCurrentGrid(
      makeGrid({
        responsiveLayoutVersion: undefined,
        responsiveLayoutVersionStatus: "missing",
      }),
    );
    const wrapper = mountSettings();

    expect(wrapper.find('[data-testid="responsive-layout-settings"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Preview Griddle layout");
    expect(wrapper.text()).toContain("Switch to Griddle layout");

    session.setCurrentGrid(makeGrid());
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="responsive-layout-settings"]').exists()).toBe(true);
  });

  it("hides controls from visitors, upgraded grids, unsupported versions, and production", async () => {
    const wrapper = mountSettings();

    session.setOwner(false);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="responsive-layout-settings"]').exists()).toBe(false);

    session.setOwner(true);
    session.setCurrentGrid(
      makeGrid({
        responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
      }),
    );
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="responsive-layout-settings"]').exists()).toBe(false);

    session.setCurrentGrid(
      makeGrid({ responsiveLayoutVersionStatus: "unsupported" }),
    );
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="responsive-layout-settings"]').exists()).toBe(false);

    wrapper.unmount();
    vi.stubEnv("PROD", true);
    session.setCurrentGrid(makeGrid());
    const productionWrapper = mountSettings();
    expect(productionWrapper.find('[data-testid="responsive-layout-settings"]').exists()).toBe(false);
  });

  it("starts and stops projection preview without changing the breakpoint", async () => {
    viewport.setForcedBreakpoint("sm");
    const wrapper = mountSettings();

    await wrapper
      .get('[data-testid="responsive-layout-preview-toggle"]')
      .trigger("click");

    expect(controllerMock.startResponsiveLayoutPreview).toHaveBeenCalledTimes(1);
    expect(viewport.forcedBreakpoint).toBe("sm");
    expect(wrapper.text()).toContain("Stop preview");

    await wrapper
      .get('[data-testid="responsive-layout-preview-toggle"]')
      .trigger("click");
    expect(controllerMock.stopPreview).toHaveBeenCalledTimes(1);
    expect(viewport.forcedBreakpoint).toBe("sm");
    expect(wrapper.text()).toContain("Preview Griddle layout");
  });

  it("requires explicit confirmation with the irreversible-switch guarantees", async () => {
    const wrapper = mountSettings();

    await wrapper
      .get('[data-testid="responsive-layout-upgrade"]')
      .trigger("click");

    const modal = wrapper.findComponent(BaseModal);
    expect(modal.props("show")).toBe(true);
    expect(document.body.textContent).toContain(
      "Existing saved mobile and tablet overrides will be retained.",
    );
    expect(document.body.textContent).toContain(
      "Automatic layouts will use griddle-v1 afterward.",
    );
    expect(document.body.textContent).toContain(
      "This switch cannot be reverted through the UI or undo.",
    );
    expect(controllerMock.upgradeResponsiveLayout).not.toHaveBeenCalled();
  });

  it("shows success only after the controller confirms persistence", async () => {
    const wrapper = mountSettings();
    const toast = useToastStore(pinia);

    await wrapper
      .get('[data-testid="responsive-layout-upgrade"]')
      .trigger("click");
    const confirm = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="responsive-layout-confirm-upgrade"]',
    );
    confirm?.click();
    await flushPromises();

    expect(controllerMock.upgradeResponsiveLayout).toHaveBeenCalledTimes(1);
    expect(toast.toasts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Responsive layout switched to Griddle",
          type: "success",
        }),
      ]),
    );
    expect(wrapper.findComponent(BaseModal).props("show")).toBe(false);
  });

  it("keeps confirmation and preview available after a failed save", async () => {
    controllerMock.upgradeResponsiveLayout.mockResolvedValueOnce(false);
    preview.startResponsiveLayoutPreview("grid-1");
    const wrapper = mountSettings();
    const toast = useToastStore(pinia);

    await wrapper
      .get('[data-testid="responsive-layout-upgrade"]')
      .trigger("click");
    document.body
      .querySelector<HTMLButtonElement>(
        '[data-testid="responsive-layout-confirm-upgrade"]',
      )
      ?.click();
    await flushPromises();

    expect(wrapper.findComponent(BaseModal).props("show")).toBe(true);
    expect(preview.isActive("grid-1")).toBe(true);
    expect(toast.toasts.some((item) => item.type === "success")).toBe(false);
  });
});
