import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  ContentType,
  type DocumentsContent,
  type LinkContent,
  type Tile,
} from "@grids/contracts/types";
import { GridTileContentController } from "../../internal/GridTileContentController";
import {
  createHarness,
  makeDocumentTile,
  makeGrid,
  makeLinkTile,
  type InternalHarness,
} from "./harness";

/**
 * Tests for GridTileContentController — content replacement and patching with
 * change detection, plus the edit-transaction rules that suppress intermediate
 * undo snapshots and save scheduling until commitEditing runs.
 */

describe("GridTileContentController", () => {
  let h: InternalHarness;
  let pushUndoSnapshot: Mock<(actionLabel: string) => void>;
  let scheduleSave: Mock<() => void>;
  let controller: GridTileContentController;

  beforeEach(() => {
    vi.clearAllMocks();
    h = createHarness();
    pushUndoSnapshot = vi.fn<(actionLabel: string) => void>();
    scheduleSave = vi.fn<() => void>();
    controller = new GridTileContentController(
      h.stores,
      pushUndoSnapshot,
      scheduleSave,
    );
  });

  function seedGrid(tiles: Tile[]) {
    h.stores.session.setCurrentGrid(makeGrid({ tiles, colNum: 12 }));
  }

  describe("setTileContent", () => {
    it("does nothing when there is no grid", () => {
      controller.setTileContent("t1", {
        type: ContentType.TEXT,
      } as never);
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
    });

    it("does nothing when the tile does not exist", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      controller.setTileContent("missing", {
        type: ContentType.TEXT,
      } as never);
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("replaces content, captures history, and persists", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      const newContent = {
        type: ContentType.TEXT,
        text: "hello",
      } as never;

      controller.setTileContent("t1", newContent);

      expect(pushUndoSnapshot).toHaveBeenCalledWith("Change tile content");
      expect(h.stores.session.currentGrid?.tiles[0]?.content).toEqual(
        newContent,
      );
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("resizes and repositions a tile switched to profile content", () => {
      // x:10 with the new w:4 would overflow a 12-column grid, so the tile is
      // clamped back to x = colNum - w = 8.
      seedGrid([makeLinkTile({ i: "t1", x: 10, y: 0, w: 2, h: 2 })]);

      controller.setTileContent("t1", {
        type: ContentType.PROFILE,
      } as never);

      const tile = h.stores.session.currentGrid!.tiles[0]!;
      expect(tile.w).toBe(4);
      expect(tile.h).toBe(4);
      expect(tile.x).toBe(8);
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("does not resize or reposition for non-profile content", () => {
      seedGrid([makeLinkTile({ i: "t1", x: 1, y: 2, w: 2, h: 2 })]);

      controller.setTileContent("t1", {
        type: ContentType.TEXT,
        text: "hi",
      } as never);

      const tile = h.stores.session.currentGrid!.tiles[0]!;
      expect(tile).toMatchObject({ x: 1, y: 2, w: 2, h: 2 });
    });
  });

  describe("patchTileContent", () => {
    it("does nothing when the tile is missing", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      controller.patchTileContent("missing", { link: "x" } as never);
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("skips when the patch introduces no change", () => {
      seedGrid([
        makeLinkTile({
          i: "t1",
          content: {
            type: ContentType.LINK,
            link: "https://example.com",
          } as LinkContent,
        }),
      ]);
      controller.patchTileContent("t1", {
        link: "https://example.com",
      } as never);
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("merges the patch, captures history, and persists when not editing", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      controller.patchTileContent("t1", {
        link: "https://new.com",
      } as never);

      expect(
        (h.stores.session.currentGrid!.tiles[0]!.content as LinkContent).link,
      ).toBe("https://new.com");
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Update tile");
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("suppresses history and save during an active edit transaction", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      h.stores.history.beginEdit("t1", null);

      controller.patchTileContent("t1", {
        link: "https://new.com",
      } as never);

      expect(
        (h.stores.session.currentGrid!.tiles[0]!.content as LinkContent).link,
      ).toBe("https://new.com");
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe("autosaveTileContent", () => {
    it("delegates to patchTileContent when not editing the tile", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      controller.autosaveTileContent("t1", {
        link: "https://new.com",
      } as never);
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Update tile");
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("persists without capturing history while editing", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      h.stores.history.beginEdit("t1", null);

      controller.autosaveTileContent("t1", {
        link: "https://new.com",
      } as never);

      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).toHaveBeenCalledTimes(1);
      expect(
        (h.stores.session.currentGrid!.tiles[0]!.content as LinkContent).link,
      ).toBe("https://new.com");
    });

    it("does nothing while editing when there is no change", () => {
      seedGrid([
        makeLinkTile({
          i: "t1",
          content: {
            type: ContentType.LINK,
            link: "https://example.com",
          } as LinkContent,
        }),
      ]);
      h.stores.history.beginEdit("t1", null);

      controller.autosaveTileContent("t1", {
        link: "https://example.com",
      } as never);

      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("does nothing while editing when the tile no longer exists", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      h.stores.history.beginEdit("t1", null);
      h.stores.session.currentGrid!.tiles = [];

      controller.autosaveTileContent("t1", {
        link: "https://new.com",
      } as never);

      expect(scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe("patchDocumentItem", () => {
    it("does nothing for a non-document tile", () => {
      seedGrid([makeLinkTile({ i: "t1" })]);
      controller.patchDocumentItem("t1", "item-1", { fileName: "x" });
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("patches the matching item, captures history, and persists when not editing", () => {
      seedGrid([makeDocumentTile({ i: "t1" })]);
      controller.patchDocumentItem("t1", "item-1", {
        fileName: "renamed.pdf",
      });

      const content = h.stores.session.currentGrid!.tiles[0]!
        .content as DocumentsContent;
      expect(content.items[0]?.fileName).toBe("renamed.pdf");
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Update document");
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("leaves non-matching items unchanged", () => {
      seedGrid([
        makeDocumentTile({
          i: "t1",
          content: {
            type: ContentType.DOCUMENT,
            items: [
              { id: "item-1", fileName: "a.pdf", url: "blob:1" },
              { id: "item-2", fileName: "b.pdf", url: "blob:2" },
            ],
          } as DocumentsContent,
        }),
      ]);

      controller.patchDocumentItem("t1", "item-1", { fileName: "z.pdf" });

      const content = h.stores.session.currentGrid!.tiles[0]!
        .content as DocumentsContent;
      expect(content.items[0]?.fileName).toBe("z.pdf");
      expect(content.items[1]?.fileName).toBe("b.pdf");
    });

    it("suppresses history and save during an edit transaction", () => {
      seedGrid([makeDocumentTile({ i: "t1" })]);
      h.stores.history.beginEdit("t1", null);

      controller.patchDocumentItem("t1", "item-1", {
        fileName: "renamed.pdf",
      });

      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
    });
  });
});
