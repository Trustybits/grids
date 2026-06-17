import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGridStore } from "@/stores/grid";

describe("grid store — active color target", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("defaults to the fill target", () => {
    const grid = useGridStore();
    expect(grid.activeColorTarget).toBe("fill");
  });

  it("updates via setColorTarget", () => {
    const grid = useGridStore();
    grid.setColorTarget("overlay");
    expect(grid.activeColorTarget).toBe("overlay");
  });

  it("resets to fill each time a panel opens", () => {
    const grid = useGridStore();
    grid.setColorTarget("overlay");
    grid.togglePanelActive("tile-1", "colorSelect");
    expect(grid.activeColorTarget).toBe("fill");
  });

  it("resets to fill when a panel is set active", () => {
    const grid = useGridStore();
    grid.setColorTarget("overlay");
    grid.setPanelActive("tile-1", "colorSelect");
    expect(grid.activeColorTarget).toBe("fill");
  });
});
