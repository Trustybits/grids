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

  describe("phone toolbar editor state", () => {
    it("switching tiles closes the popover, the sheet and arrange", () => {
      const store = useGridUiStore();
      store.setMobileEditTile("a");
      store.setMobileOpenTool("fill");
      store.setMobileEditTile("b");
      expect(store.mobileOpenToolId).toBeNull();

      store.setMobileSheetExpanded(true);
      store.setMobileEditTile("a");
      expect(store.mobileSheetExpanded).toBe(false);

      store.setMobileArrangeTile("a");
      store.setMobileEditTile("b");
      expect(store.mobileArrangeTileId).toBeNull();
    });

    it("re-selecting the same tile keeps what's open", () => {
      const store = useGridUiStore();
      store.setMobileEditTile("a");
      store.setMobileOpenTool("fill");
      store.setMobileEditTile("a");
      expect(store.mobileOpenToolId).toBe("fill");
    });

    it("keeps only one of popover / sheet / arrange open", () => {
      const store = useGridUiStore();
      store.setMobileArrangeTile("a");
      // Arranging selects the tile.
      expect(store.mobileEditTileId).toBe("a");

      store.setMobileOpenTool("border");
      expect(store.mobileArrangeTileId).toBeNull();

      store.setMobileSheetExpanded(true);
      expect(store.mobileOpenToolId).toBeNull();

      store.setMobileArrangeTile("a");
      expect(store.mobileSheetExpanded).toBe(false);
      expect(store.mobileArrangeTileId).toBe("a");
    });

    it("starts multi-edit with the selected tile and toggles picks", () => {
      const store = useGridUiStore();
      store.setMobileEditTile("a");
      store.setMobileOpenTool("fill");

      store.enterMobileMultiSelect();
      expect(store.mobileMultiSelectIds).toEqual(["a"]);
      expect(store.mobileOpenToolId).toBeNull();

      store.toggleMobileMultiSelectTile("b");
      expect(store.mobileMultiSelectIds).toEqual(["a", "b"]);
      store.toggleMobileMultiSelectTile("a");
      expect(store.mobileMultiSelectIds).toEqual(["b"]);
    });

    it("leaves multi-edit when the last pick is removed", () => {
      const store = useGridUiStore();
      store.setMobileEditTile("a");
      store.enterMobileMultiSelect();
      store.toggleMobileMultiSelectTile("a");

      expect(store.mobileMultiSelectIds).toBeNull();
      expect(store.mobileEditTileId).toBeNull();
    });

    it("ignores picks outside multi-edit", () => {
      const store = useGridUiStore();
      store.toggleMobileMultiSelectTile("a");
      expect(store.mobileMultiSelectIds).toBeNull();
    });

    it("prunes state that points at deleted tiles", () => {
      const store = useGridUiStore();
      store.setMobileEditTile("a");
      store.enterMobileMultiSelect();
      store.toggleMobileMultiSelectTile("b");

      store.pruneMobileEditor(new Set(["b"]));
      expect(store.mobileMultiSelectIds).toEqual(["b"]);

      store.pruneMobileEditor(new Set());
      expect(store.mobileMultiSelectIds).toBeNull();
      expect(store.mobileEditTileId).toBeNull();
    });

    it("prunes a selection and arrange whose tile is gone", () => {
      const store = useGridUiStore();
      store.setMobileArrangeTile("a");
      store.pruneMobileEditor(new Set(["z"]));
      expect(store.mobileEditTileId).toBeNull();
      expect(store.mobileArrangeTileId).toBeNull();
    });

    it("clearing the selection also ends multi-edit", () => {
      const store = useGridUiStore();
      store.setMobileEditTile("a");
      store.enterMobileMultiSelect();
      store.setMobileEditTile(null);
      expect(store.mobileMultiSelectIds).toBeNull();
    });
  });

  it("session reset closes menus and focus while retaining preferences", () => {
    const store = useGridUiStore();
    store.setPanelActive("tile-1", "settings");
    store.setPendingFocusTileId("tile-1");
    store.setMobileEditTile("tile-1");
    store.enterMobileMultiSelect();
    store.setMobileOpenTool("fill");
    store.setShowMetaData(true);
    store.setShowMetaDataVerbose(true);

    store.resetSessionState();

    expect(store.activeTileId).toBeNull();
    expect(store.activePanelId).toBeNull();
    expect(store.pendingFocusTileId).toBeNull();
    // Leaving the grid drops the edit target, so it can never point at a tile
    // that is no longer on screen.
    expect(store.mobileEditTileId).toBeNull();
    expect(store.mobileMultiSelectIds).toBeNull();
    expect(store.mobileOpenToolId).toBeNull();
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
