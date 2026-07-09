import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { Breakpoint, Grid } from "@grids/contracts/types";
import { useGridSessionStore } from "../gridSession";

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
    ...overrides,
  };
}

describe("gridSession store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with no active session and legacy-compatible selector defaults", () => {
    const store = useGridSessionStore();

    expect(store.currentGrid).toBeNull();
    expect(store.isOwner).toBe(false);
    expect(store.isDemoGrid).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.isResyncing).toBe(false);
    expect(store.loadError).toBeNull();
    expect(store.persistenceError).toBeNull();
    expect(store.verticalCompact).toBe(true);
    expect(store.canEditAtBreakpoint(null, "lg")).toBe(false);
  });

  it("reflects the active grid vertical compact setting", () => {
    const store = useGridSessionStore();

    store.setCurrentGrid(makeGrid({ verticalCompact: false }));

    expect(store.verticalCompact).toBe(false);
  });

  it.each<{
    owner: boolean;
    forced: Breakpoint | null;
    viewport: Breakpoint;
    expected: boolean;
  }>([
    { owner: false, forced: null, viewport: "lg", expected: false },
    { owner: true, forced: null, viewport: "sm", expected: true },
    { owner: true, forced: "sm", viewport: "sm", expected: true },
    { owner: true, forced: "md", viewport: "md", expected: true },
    { owner: true, forced: "lg", viewport: "lg", expected: true },
    { owner: true, forced: "sm", viewport: "lg", expected: true },
    { owner: true, forced: "md", viewport: "lg", expected: true },
    { owner: true, forced: "md", viewport: "sm", expected: false },
    { owner: true, forced: "lg", viewport: "md", expected: false },
  ])(
    "computes edit permission for owner=$owner forced=$forced viewport=$viewport",
    ({ owner, forced, viewport, expected }) => {
      const store = useGridSessionStore();
      store.setOwner(owner);

      expect(store.canEditAtBreakpoint(forced, viewport)).toBe(expected);
    },
  );

  it("keeps load and persistence failures separate without inferring precedence", () => {
    const store = useGridSessionStore();

    store.setLoadError("Load failed");
    store.setPersistenceError("Save failed");

    expect(store.loadError).toBe("Load failed");
    expect(store.persistenceError).toBe("Save failed");
  });

  it("updates session identity and loading state through narrow actions", () => {
    const store = useGridSessionStore();
    const grid = makeGrid();

    store.setCurrentGrid(grid);
    store.setOwner(true);
    store.setDemoGrid(true);
    store.setLoading(true);

    expect(store.currentGrid).toEqual(grid);
    expect(store.isOwner).toBe(true);
    expect(store.isDemoGrid).toBe(true);
    expect(store.isLoading).toBe(true);
  });

  describe("markOwnershipRevoked", () => {
    it("patches the cached owner id and drops edit rights", () => {
      const store = useGridSessionStore();
      store.setCurrentGrid(makeGrid({ id: "g1", userId: "user-1" }));
      store.setOwner(true);

      store.markOwnershipRevoked("recipient");

      expect(store.currentGrid?.userId).toBe("recipient");
      expect(store.isOwner).toBe(false);
    });

    it("preserves grid content so unsaved local edits aren't clobbered", () => {
      const store = useGridSessionStore();
      const grid = makeGrid({ id: "g1", userId: "user-1", name: "Local edit" });
      store.setCurrentGrid(grid);
      store.setOwner(true);

      store.markOwnershipRevoked("recipient");

      expect(store.currentGrid?.id).toBe("g1");
      expect(store.currentGrid?.name).toBe("Local edit");
    });

    it("is a no-op on ownership fields when there is no active grid", () => {
      const store = useGridSessionStore();
      store.setOwner(true);

      store.markOwnershipRevoked("recipient");

      expect(store.currentGrid).toBeNull();
      expect(store.isOwner).toBe(false);
    });
  });

  it("toggles the resync overlay flag through setResyncing", () => {
    const store = useGridSessionStore();

    store.setResyncing(true);
    expect(store.isResyncing).toBe(true);

    store.setResyncing(false);
    expect(store.isResyncing).toBe(false);
  });

  it("reset restores every session field", () => {
    const store = useGridSessionStore();

    store.setCurrentGrid(makeGrid({ verticalCompact: false }));
    store.setOwner(true);
    store.setDemoGrid(true);
    store.setLoading(true);
    store.setResyncing(true);
    store.setLoadError("load");
    store.setPersistenceError("save");
    store.reset();

    expect(store.currentGrid).toBeNull();
    expect(store.isOwner).toBe(false);
    expect(store.isDemoGrid).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.isResyncing).toBe(false);
    expect(store.loadError).toBeNull();
    expect(store.persistenceError).toBeNull();
    expect(store.verticalCompact).toBe(true);
  });
});
