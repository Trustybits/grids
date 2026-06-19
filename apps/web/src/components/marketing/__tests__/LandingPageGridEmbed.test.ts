import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import type { Grid } from "@grids/contracts/types";

const holders = vi.hoisted(() => ({
  store: null as Record<string, unknown> | null,
  demoGrid: {
    id: "demo-grid",
    userId: "demo-user",
    name: "Demo",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
  } as Grid,
}));

vi.mock("@/stores/grid", () => ({
  useGridStore: () => holders.store,
}));

vi.mock("@/data/DemoGrid", () => ({
  DEMO_GRID_DIMENSIONS: {
    lg: { width: 900, height: 600 },
    md: { width: 600, height: 500 },
    sm: { width: 300, height: 600 },
  },
  createDemoGrid: () => holders.demoGrid,
}));

vi.mock("@/components/grid/Grid.vue", () => ({
  default: {
    name: "GridStub",
    template: "<div data-test='grid' />",
  },
}));

function makeLiveGrid(): Grid {
  return {
    id: "live-grid",
    userId: "user-1",
    name: "Live",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
  };
}

function makeStore(liveGrid: Grid) {
  const store = reactive({
    currentGrid: liveGrid as Grid | null,
    isOwner: true,
    isDemoGrid: false,
    forcedBreakpoint: "md" as "lg" | "md" | "sm" | null,
    loadDemoGrid: vi.fn((grid: Grid) => {
      store.currentGrid = grid;
      store.isOwner = false;
      store.isDemoGrid = true;
    }),
    setForcedBreakpoint: vi.fn(
      (breakpoint: "lg" | "md" | "sm" | null) => {
        store.forcedBreakpoint = breakpoint;
      },
    ),
  });
  return store;
}

describe("LandingPageGridEmbed session interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(600);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("replaces the live session with a demo while mounted and restores it on unmount", async () => {
    const liveGrid = makeLiveGrid();
    const store = makeStore(liveGrid);
    holders.store = store;
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { default: LandingPageGridEmbed } = await import(
      "@/components/marketing/LandingPageGridEmbed.vue"
    );

    const wrapper = mount(LandingPageGridEmbed);
    await flushPromises();

    expect(store.loadDemoGrid).toHaveBeenCalledWith(holders.demoGrid);
    expect(store.currentGrid).toEqual(holders.demoGrid);
    expect(store.isOwner).toBe(false);
    expect(store.isDemoGrid).toBe(true);
    expect(store.forcedBreakpoint).toBe("sm");
    expect(addListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      { passive: true },
    );
    expect(addListener).toHaveBeenCalledWith("resize", expect.any(Function));

    wrapper.unmount();

    expect(store.setForcedBreakpoint).toHaveBeenLastCalledWith("md");
    expect(store.currentGrid).toEqual(liveGrid);
    expect(store.isOwner).toBe(true);
    expect(store.isDemoGrid).toBe(false);
    expect(removeListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
    expect(removeListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
  });

  it("restores an empty prior session after demo rendering", async () => {
    const store = makeStore(makeLiveGrid());
    store.currentGrid = null;
    store.isOwner = false;
    store.forcedBreakpoint = null;
    holders.store = store;
    const { default: LandingPageGridEmbed } = await import(
      "@/components/marketing/LandingPageGridEmbed.vue"
    );

    const wrapper = mount(LandingPageGridEmbed);
    await flushPromises();
    wrapper.unmount();

    expect(store.currentGrid).toBeNull();
    expect(store.isOwner).toBe(false);
    expect(store.isDemoGrid).toBe(false);
    expect(store.forcedBreakpoint).toBeNull();
  });
});
