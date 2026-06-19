import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGridStore,
  makeGrid,
  resetGridHarness,
} from "./gridTestHarness";

describe("grid store UI state and permissions", () => {
  let store: Awaited<ReturnType<typeof createGridStore>>;

  beforeEach(async () => {
    resetGridHarness();
    store = await createGridStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.cookie =
      "showMetaData=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie =
      "showMetaDataVerbose=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("starts with the expected UI and viewport defaults", () => {
    expect(store.activeTileId).toBeNull();
    expect(store.activePanelId).toBeNull();
    expect(store.pendingFocusTileId).toBeNull();
    expect(store.showMetaData).toBe(false);
    expect(store.showMetaDataVerbose).toBe(false);
    expect(store.activeBreakpoint).toBe("lg");
    expect(store.viewportBreakpoint).toBe("lg");
    expect(store.forcedBreakpoint).toBeNull();
    expect(store.displayPositions).toEqual([]);
    expect(store.verticalCompact).toBe(true);
  });

  it("reflects the active grid vertical compact setting", () => {
    store.currentGrid = makeGrid({ verticalCompact: false });

    expect(store.verticalCompact).toBe(false);
  });

  it.each([
    {
      isOwner: false,
      viewport: "lg" as const,
      forced: null,
      expected: false,
    },
    {
      isOwner: true,
      viewport: "lg" as const,
      forced: null,
      expected: true,
    },
    {
      isOwner: true,
      viewport: "sm" as const,
      forced: "md" as const,
      expected: false,
    },
    {
      isOwner: true,
      viewport: "md" as const,
      forced: "lg" as const,
      expected: false,
    },
    {
      isOwner: true,
      viewport: "md" as const,
      forced: "sm" as const,
      expected: true,
    },
    {
      isOwner: true,
      viewport: "sm" as const,
      forced: "sm" as const,
      expected: true,
    },
  ])(
    "computes edit permission for ownership=$isOwner viewport=$viewport forced=$forced",
    ({ isOwner, viewport, forced, expected }) => {
      store.isOwner = isOwner;
      store.viewportBreakpoint = viewport;
      store.forcedBreakpoint = forced;

      expect(store.canEdit).toBe(expected);
    },
  );

  it("opens a menu and clears an existing panel", () => {
    store.setPanelActive("tile-1", "settings");

    store.setMenuActive("tile-2");

    expect(store.activeTileId).toBe("tile-2");
    expect(store.activePanelId).toBeNull();
  });

  it("opens a specific panel for a tile", () => {
    store.setPanelActive("tile-1", "appearance");

    expect(store.activeTileId).toBe("tile-1");
    expect(store.activePanelId).toBe("appearance");
  });

  it("toggles a menu open, switches tiles, and closes the active menu", () => {
    store.toggleMenuActive("tile-1");
    expect(store.activeTileId).toBe("tile-1");

    store.toggleMenuActive("tile-2");
    expect(store.activeTileId).toBe("tile-2");

    store.toggleMenuActive("tile-2");
    expect(store.activeTileId).toBeNull();
  });

  it("closes an active panel before deciding whether to close its tile menu", () => {
    store.setPanelActive("tile-1", "settings");

    store.toggleMenuActive("tile-1");

    expect(store.activeTileId).toBe("tile-1");
    expect(store.activePanelId).toBeNull();
  });

  it("toggles panels across tiles and closes the selected panel", () => {
    store.togglePanelActive("tile-1", "settings");
    expect(store.activeTileId).toBe("tile-1");
    expect(store.activePanelId).toBe("settings");

    store.togglePanelActive("tile-1", "appearance");
    expect(store.activePanelId).toBe("appearance");

    store.togglePanelActive("tile-2", "settings");
    expect(store.activeTileId).toBe("tile-2");
    expect(store.activePanelId).toBe("settings");

    store.togglePanelActive("tile-2", "settings");
    expect(store.activeTileId).toBeNull();
    expect(store.activePanelId).toBeNull();
  });

  it("closes all menus and panels", () => {
    store.setPanelActive("tile-1", "settings");

    store.closeMenus();

    expect(store.activeTileId).toBeNull();
    expect(store.activePanelId).toBeNull();
  });

  it("reads metadata preferences from cookies", () => {
    document.cookie = "showMetaData=true; path=/";
    document.cookie = "showMetaDataVerbose=false; path=/";

    store.checkShowMetaDataCookie();

    expect(store.showMetaData).toBe(true);
    expect(store.showMetaDataVerbose).toBe(false);
    expect(store.getCookieValue("missing")).toBeNull();
  });

  it("updates metadata preferences and writes persistent cookies", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T12:00:00Z"));

    store.setShowMetaData(true);
    store.setShowMetaDataVerbose(true);

    expect(store.showMetaData).toBe(true);
    expect(store.showMetaDataVerbose).toBe(true);
    expect(store.getCookieValue("showMetaData")).toBe("true");
    expect(store.getCookieValue("showMetaDataVerbose")).toBe("true");
  });
});
