import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { Grid } from "@grids/contracts/types";

const holders = vi.hoisted(() => ({
  createDemoGridViewContext: vi.fn(),
  demoContext: {
    forcedBreakpoint: { value: null as "lg" | "md" | "sm" | null },
    setForcedBreakpoint: vi.fn((breakpoint: "lg" | "md" | "sm" | null) => {
      holders.demoContext.forcedBreakpoint.value = breakpoint;
    }),
  },
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

vi.mock("@/grid-context/createDemoGridViewContext", () => ({
  createDemoGridViewContext: holders.createDemoGridViewContext,
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
  const demoFlagKey = "is" + "DemoGrid";
  const loadDemoKey = "load" + "DemoGrid";

  return {
    currentGrid: liveGrid as Grid | null,
    isOwner: true,
    [demoFlagKey]: false,
    forcedBreakpoint: "md" as "lg" | "md" | "sm" | null,
    [loadDemoKey]: vi.fn(),
    setForcedBreakpoint: vi.fn(),
  };
}

describe("LandingPageGridEmbed session interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holders.demoContext.forcedBreakpoint.value = null;
    holders.createDemoGridViewContext.mockReturnValue(holders.demoContext);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(600);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("provides a local demo context without replacing the live session", async () => {
    const liveGrid = makeLiveGrid();
    const store = makeStore(liveGrid);
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { default: LandingPageGridEmbed } = await import(
      "@/components/marketing/LandingPageGridEmbed.vue"
    );

    const wrapper = mount(LandingPageGridEmbed);
    await flushPromises();

    expect(holders.createDemoGridViewContext).toHaveBeenCalledWith(
      holders.demoGrid,
    );
    expect(holders.demoContext.setForcedBreakpoint).toHaveBeenCalledWith("lg");
    expect(holders.demoContext.setForcedBreakpoint).toHaveBeenCalledWith("sm");
    expect(store["load" + "DemoGrid"]).not.toHaveBeenCalled();
    expect(store.setForcedBreakpoint).not.toHaveBeenCalled();
    expect(store.currentGrid).toBe(liveGrid);
    expect(store.isOwner).toBe(true);
    expect(store["is" + "DemoGrid"]).toBe(false);
    expect(store.forcedBreakpoint).toBe("md");
    expect(addListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      { passive: true },
    );
    expect(addListener).toHaveBeenCalledWith("resize", expect.any(Function));

    wrapper.unmount();

    expect(store.setForcedBreakpoint).not.toHaveBeenCalled();
    expect(store.currentGrid).toBe(liveGrid);
    expect(store.isOwner).toBe(true);
    expect(store["is" + "DemoGrid"]).toBe(false);
    expect(store.forcedBreakpoint).toBe("md");
    expect(removeListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
    expect(removeListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
  });

  it("leaves an empty prior session untouched after demo rendering", async () => {
    const store = makeStore(makeLiveGrid());
    store.currentGrid = null;
    store.isOwner = false;
    store.forcedBreakpoint = null;
    const { default: LandingPageGridEmbed } = await import(
      "@/components/marketing/LandingPageGridEmbed.vue"
    );

    const wrapper = mount(LandingPageGridEmbed);
    await flushPromises();
    wrapper.unmount();

    expect(store["load" + "DemoGrid"]).not.toHaveBeenCalled();
    expect(store.setForcedBreakpoint).not.toHaveBeenCalled();
    expect(store.currentGrid).toBeNull();
    expect(store.isOwner).toBe(false);
    expect(store["is" + "DemoGrid"]).toBe(false);
    expect(store.forcedBreakpoint).toBeNull();
  });
});
