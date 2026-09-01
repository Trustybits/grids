import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGridUiStore } from "../gridUi";

describe("gridUi store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with closed menus, no pending focus, and disabled preferences", () => {
    const store = useGridUiStore();

    expect(store.activeTileId).toBeNull();
    expect(store.activePanelId).toBeNull();
    expect(store.pendingFocusTileId).toBeNull();
    expect(store.showMetaData).toBe(false);
    expect(store.showMetaDataVerbose).toBe(false);
  });

  it("opens menus and panels while preserving one active tile", () => {
    const store = useGridUiStore();

    store.setPanelActive("tile-1", "settings");
    store.setMenuActive("tile-2");

    expect(store.activeTileId).toBe("tile-2");
    expect(store.activePanelId).toBeNull();

    store.setPanelActive("tile-2", "appearance");
    expect(store.activeTileId).toBe("tile-2");
    expect(store.activePanelId).toBe("appearance");
  });

  it("toggles menus and closes an active panel before closing its menu", () => {
    const store = useGridUiStore();

    store.toggleMenuActive("tile-1");
    expect(store.activeTileId).toBe("tile-1");

    store.setPanelActive("tile-1", "settings");
    store.toggleMenuActive("tile-1");
    expect(store.activeTileId).toBe("tile-1");
    expect(store.activePanelId).toBeNull();

    store.toggleMenuActive("tile-1");
    expect(store.activeTileId).toBeNull();
  });

  it("closes an active panel and switches to another tile menu", () => {
    const store = useGridUiStore();

    store.setPanelActive("tile-1", "settings");
    store.toggleMenuActive("tile-2");

    expect(store.activeTileId).toBe("tile-2");
    expect(store.activePanelId).toBeNull();
  });

  it("toggles panels across tiles and closes the selected panel", () => {
    const store = useGridUiStore();

    store.togglePanelActive("tile-1", "settings");
    store.togglePanelActive("tile-1", "appearance");
    expect(store.activePanelId).toBe("appearance");

    store.togglePanelActive("tile-2", "settings");
    expect(store.activeTileId).toBe("tile-2");
    expect(store.activePanelId).toBe("settings");

    store.togglePanelActive("tile-2", "settings");
    expect(store.activeTileId).toBeNull();
    expect(store.activePanelId).toBeNull();
  });

  it("consumes a pending focus request exactly once for the matching tile", () => {
    const store = useGridUiStore();
    store.setPendingFocusTileId("tile-1");

    expect(store.consumePendingFocus("tile-2")).toBe(false);
    expect(store.pendingFocusTileId).toBe("tile-1");
    expect(store.consumePendingFocus("tile-1")).toBe(true);
    expect(store.pendingFocusTileId).toBeNull();
    expect(store.consumePendingFocus("tile-1")).toBe(false);
  });

  it("holds one mobile edit target at a time", () => {
    const store = useGridUiStore();

    store.setMobileEditTile("tile-1");
    expect(store.mobileEditTileId).toBe("tile-1");

    store.setMobileEditTile("tile-2");
    expect(store.mobileEditTileId).toBe("tile-2");

    store.setMobileEditTile(null);
    expect(store.mobileEditTileId).toBeNull();
  });

  it("session reset closes menus and focus while retaining preferences", () => {
    const store = useGridUiStore();
    store.setPanelActive("tile-1", "settings");
    store.setPendingFocusTileId("tile-1");
    store.setMobileEditTile("tile-1");
    store.setShowMetaData(true);
    store.setShowMetaDataVerbose(true);

    store.resetSessionState();

    expect(store.activeTileId).toBeNull();
    expect(store.activePanelId).toBeNull();
    expect(store.pendingFocusTileId).toBeNull();
    // Leaving the grid drops the edit target, so it can never point at a tile
    // that is no longer on screen.
    expect(store.mobileEditTileId).toBeNull();
    expect(store.showMetaData).toBe(true);
    expect(store.showMetaDataVerbose).toBe(true);
  });

  it("closeMenus clears active UI and reset restores every default", () => {
    const store = useGridUiStore();
    store.setPanelActive("tile-1", "settings");
    store.closeMenus();

    expect(store.activeTileId).toBeNull();
    expect(store.activePanelId).toBeNull();

    store.setPanelActive("tile-2", "appearance");
    store.setPendingFocusTileId("tile-1");
    store.setShowMetaData(true);
    store.setShowMetaDataVerbose(true);
    store.reset();

    expect(store.activeTileId).toBeNull();
    expect(store.activePanelId).toBeNull();
    expect(store.pendingFocusTileId).toBeNull();
    expect(store.showMetaData).toBe(false);
    expect(store.showMetaDataVerbose).toBe(false);
  });
});
