import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  ContentType,
  type LinkContent,
  type Tile,
} from "@grids/contracts/types";
import { GridSettingsController } from "../../internal/GridSettingsController";
import {
  createHarness,
  makeGrid,
  makeLinkTile,
  type InternalHarness,
} from "./harness";

/**
 * Tests for GridSettingsController — grid-level and tile-level setting
 * mutations routed through the private runGridCommand pipeline (no-grid guard,
 * validation, optional history capture, persistence scheduling).
 */

describe("GridSettingsController", () => {
  let h: InternalHarness;
  let pushUndoSnapshot: Mock<(actionLabel: string) => void>;
  let scheduleSave: Mock<() => void>;
  let controller: GridSettingsController;

  beforeEach(() => {
    vi.clearAllMocks();
    h = createHarness();
    pushUndoSnapshot = vi.fn<(actionLabel: string) => void>();
    scheduleSave = vi.fn<() => void>();
    controller = new GridSettingsController(
      h.stores,
      pushUndoSnapshot,
      scheduleSave,
    );
  });

  function seedGrid(tiles: Tile[] = []) {
    const grid = makeGrid({ tiles });
    h.stores.session.setCurrentGrid(grid);
    return grid;
  }

  describe("no active grid", () => {
    it("ignores every command when there is no current grid", () => {
      controller.setVerticalCompact(false);
      controller.renameCurrentGrid("X");
      controller.setGridTheme("t");
      controller.setBackgroundColor("#fff");
      // Tile-level commands run their validate guard, but the no-grid guard in
      // runGridCommand short-circuits before either validate or history.
      controller.updateCaption({ tileId: "t1", caption: "x" });
      controller.toggleTileBorder("t1");
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe("history-capturing commands", () => {
    it("setVerticalCompact captures history and persists", () => {
      const grid = seedGrid();
      controller.setVerticalCompact(false);
      expect(grid.verticalCompact).toBe(false);
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Set gravity");
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("setVerticalCompact persists the true value", () => {
      const grid = seedGrid();
      grid.verticalCompact = false;
      controller.setVerticalCompact(true);
      expect(grid.verticalCompact).toBe(true);
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("setGridTheme captures history and updates the theme id", () => {
      const grid = seedGrid();
      controller.setGridTheme("theme-b");
      expect(grid.themeId).toBe("theme-b");
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Change theme");
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("addBackgroundImage / removeBackgroundImage set and clear fields", () => {
      const grid = seedGrid();
      controller.addBackgroundImage("https://cdn/bg", true);
      expect(grid.backgroundImageSrc).toBe("https://cdn/bg");
      expect(grid.backgroundEmbed).toBe(true);
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Change background image");

      controller.removeBackgroundImage();
      expect(grid.backgroundImageSrc).toBe("");
      expect(grid.backgroundEmbed).toBe(false);
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Remove background image");
    });

    it("setCustomOgImage / removeCustomOgImage set and clear the og image", () => {
      const grid = seedGrid();
      controller.setCustomOgImage("https://cdn/og");
      expect(grid.ogImageSrc).toBe("https://cdn/og");
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Change social share image");
      expect(scheduleSave).toHaveBeenCalledTimes(1);

      controller.removeCustomOgImage();
      expect(grid.ogImageSrc).toBe("");
      expect(pushUndoSnapshot).toHaveBeenCalledWith(
        "Remove social share image",
      );
      expect(scheduleSave).toHaveBeenCalledTimes(2);
    });

    it("setBackgroundColor / removeBackgroundColor set and clear the color", () => {
      const grid = seedGrid();
      controller.setBackgroundColor("#abcdef");
      expect(grid.backgroundColor).toBe("#abcdef");
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Change background color");
      expect(scheduleSave).toHaveBeenCalledTimes(1);

      controller.removeBackgroundColor();
      expect(grid.backgroundColor).toBe("");
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Remove background color");
      expect(scheduleSave).toHaveBeenCalledTimes(2);
    });
  });

  describe("non-history commands", () => {
    it("renameCurrentGrid renames the grid and syncs the collection without history", () => {
      const grid = seedGrid();
      h.stores.collection.setGrids([makeGrid({ id: grid.id, name: "Old" })]);

      controller.renameCurrentGrid("Fresh");

      expect(grid.name).toBe("Fresh");
      expect(h.stores.collection.grids[0]?.name).toBe("Fresh");
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("setDuplicatable toggles the flag (both values) without capturing history", () => {
      const grid = seedGrid();
      controller.setDuplicatable(true);
      expect(grid.duplicatable).toBe(true);
      controller.setDuplicatable(false);
      expect(grid.duplicatable).toBe(false);
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).toHaveBeenCalledTimes(2);
    });
  });

  describe("updateCaption", () => {
    it("updates the caption of an existing tile", () => {
      const grid = seedGrid([makeLinkTile({ i: "t1", caption: "old" })]);
      controller.updateCaption({ tileId: "t1", caption: "new" });
      expect(grid.tiles[0]?.caption).toBe("new");
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when the tile does not exist", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      controller.updateCaption({ tileId: "missing", caption: "new" });
      expect(scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe("toggleTileBorder", () => {
    it("flips an enabled border off and captures history", () => {
      const grid = seedGrid([
        makeLinkTile({ i: "t1", borderEnabled: true }),
      ]);
      controller.toggleTileBorder("t1");
      expect(grid.tiles[0]?.borderEnabled).toBe(false);
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Toggle tile border");
    });

    it("treats a missing borderEnabled as enabled and flips it off", () => {
      const tile = makeLinkTile({ i: "t1" });
      delete (tile as Partial<Tile>).borderEnabled;
      const grid = seedGrid([tile]);
      controller.toggleTileBorder("t1");
      expect(grid.tiles[0]?.borderEnabled).toBe(false);
    });

    it("flips an explicitly disabled border back on", () => {
      const grid = seedGrid([
        makeLinkTile({ i: "t1", borderEnabled: false }),
      ]);
      controller.toggleTileBorder("t1");
      expect(grid.tiles[0]?.borderEnabled).toBe(true);
    });

    it("does nothing when the tile does not exist", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      controller.toggleTileBorder("missing");
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe("toggleLinkBackground", () => {
    it("toggles linkBackgroundEnabled on a link tile", () => {
      const grid = seedGrid([makeLinkTile({ i: "t1" })]);
      controller.toggleLinkBackground("t1");
      expect(
        (grid.tiles[0]?.content as LinkContent).linkBackgroundEnabled,
      ).toBe(false);
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Toggle link background");
    });

    it("flips an explicitly disabled link background back on", () => {
      const tile = makeLinkTile({ i: "t1" });
      (tile.content as LinkContent).linkBackgroundEnabled = false;
      const grid = seedGrid([tile]);
      controller.toggleLinkBackground("t1");
      expect(
        (grid.tiles[0]?.content as LinkContent).linkBackgroundEnabled,
      ).toBe(true);
    });

    it("does nothing for a non-link tile", () => {
      const grid = seedGrid([
        {
          i: "t1",
          x: 0,
          y: 0,
          w: 2,
          h: 2,
          caption: "",
          content: { type: ContentType.TEXT } as never,
        },
      ]);
      controller.toggleLinkBackground("t1");
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
      expect(grid.tiles[0]?.content.type).toBe(ContentType.TEXT);
    });
  });
});
