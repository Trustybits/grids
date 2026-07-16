import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  type Grid,
} from "@grids/contracts/types";
import ResponsiveLayoutSettings from "@/components/grid/ResponsiveLayoutSettings.vue";
import { useGridSessionStore } from "@/stores/grid/gridSession";

const controllerMock = vi.hoisted(() => ({
  startResponsiveLayoutPreview: vi.fn(),
  stopPreview: vi.fn(),
  upgradeResponsiveLayout: vi.fn(),
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => controllerMock,
}));

function makeGrid(): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    responsiveLayoutVersionStatus: "supported",
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
    overrides: {},
  };
}

describe("ResponsiveLayoutSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PROD", false);
  });

  it("keeps the obsolete preview and upgrade controls dormant", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const session = useGridSessionStore(pinia);
    session.setCurrentGrid(makeGrid());
    session.setOwner(true);

    const wrapper = mount(ResponsiveLayoutSettings, {
      global: { plugins: [pinia] },
    });

    expect(
      wrapper.find('[data-testid="responsive-layout-settings"]').exists(),
    ).toBe(false);
    expect(controllerMock.startResponsiveLayoutPreview).not.toHaveBeenCalled();
    expect(controllerMock.upgradeResponsiveLayout).not.toHaveBeenCalled();
  });
});
