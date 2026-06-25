import { beforeEach, describe, expect, it, vi } from "vitest";
import { GridUiController } from "../../internal/GridUiController";
import { createHarness, type InternalHarness } from "./harness";

/**
 * Tests for GridUiController — a thin façade over the gridUi store plus
 * cookie persistence of the metadata-visibility preferences.
 */

describe("GridUiController", () => {
  let h: InternalHarness;
  let controller: GridUiController;

  beforeEach(() => {
    vi.clearAllMocks();
    h = createHarness();
    controller = new GridUiController(h.stores, h.dependencies);
  });

  it("activates a tile menu through the store", () => {
    controller.setMenuActive("tile-1");
    expect(h.stores.ui.activeTileId).toBe("tile-1");
    expect(h.stores.ui.activePanelId).toBeNull();
  });

  it("activates a specific panel through the store", () => {
    controller.setPanelActive("tile-1", "settings");
    expect(h.stores.ui.activeTileId).toBe("tile-1");
    expect(h.stores.ui.activePanelId).toBe("settings");
  });

  it("toggles a menu open then closed", () => {
    controller.toggleMenuActive("tile-1");
    expect(h.stores.ui.activeTileId).toBe("tile-1");
    controller.toggleMenuActive("tile-1");
    expect(h.stores.ui.activeTileId).toBeNull();
  });

  it("toggles a panel open then closed", () => {
    controller.togglePanelActive("tile-1", "settings");
    expect(h.stores.ui.activePanelId).toBe("settings");
    controller.togglePanelActive("tile-1", "settings");
    expect(h.stores.ui.activeTileId).toBeNull();
    expect(h.stores.ui.activePanelId).toBeNull();
  });

  it("closes all menus", () => {
    h.stores.ui.setPanelActive("tile-1", "settings");
    controller.closeMenus();
    expect(h.stores.ui.activeTileId).toBeNull();
    expect(h.stores.ui.activePanelId).toBeNull();
  });

  it("persists showMetaData to the store and a cookie as a string", () => {
    controller.setShowMetaData(true);
    expect(h.stores.ui.showMetaData).toBe(true);
    expect(h.dependencies.setCookieValue).toHaveBeenCalledWith(
      "showMetaData",
      "true",
    );
  });

  it("persists showMetaData false to the store and a cookie", () => {
    h.stores.ui.setShowMetaData(true);
    controller.setShowMetaData(false);
    expect(h.stores.ui.showMetaData).toBe(false);
    expect(h.dependencies.setCookieValue).toHaveBeenCalledWith(
      "showMetaData",
      "false",
    );
  });

  it("persists showMetaDataVerbose false to the store and a cookie", () => {
    h.stores.ui.setShowMetaDataVerbose(true);
    controller.setShowMetaDataVerbose(false);
    expect(h.stores.ui.showMetaDataVerbose).toBe(false);
    expect(h.dependencies.setCookieValue).toHaveBeenCalledWith(
      "showMetaDataVerbose",
      "false",
    );
  });

  it("reads cookies through the injected dependency", () => {
    vi.mocked(h.dependencies.getCookieValue).mockReturnValueOnce("yes");
    expect(controller.getCookieValue("showMetaData")).toBe("yes");
    expect(h.dependencies.getCookieValue).toHaveBeenCalledWith(
      "showMetaData",
    );
  });

  it("writes cookies with a default 365-day expiry", () => {
    controller.setCookieValue("k", "v");
    expect(h.dependencies.setCookieValue).toHaveBeenCalledWith("k", "v", 365);
  });

  it("forwards an explicit cookie expiry", () => {
    controller.setCookieValue("k", "v", 7);
    expect(h.dependencies.setCookieValue).toHaveBeenCalledWith("k", "v", 7);
  });
});
