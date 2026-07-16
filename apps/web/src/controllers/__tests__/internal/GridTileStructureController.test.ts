import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  AnalyticsEventType,
  ContentType,
  type Breakpoint,
  type ChatContent,
  type Tile,
  type TileContent,
} from "@grids/contracts/types";
import { createTileContent } from "@/utils/TileUtils";
import { GridTileStructureController } from "../../internal/GridTileStructureController";
import {
  createHarness,
  makeDocumentTile,
  makeGrid,
  makeImageTile,
  makeLinkTile,
  type InternalHarness,
} from "./harness";

/**
 * Tests for GridTileStructureController — add/duplicate/remove/resize tiles.
 * Runs against the real tile registry and placement utilities; mocks only the
 * injected viewport/save/history/analytics collaborators.
 */

describe("GridTileStructureController", () => {
  let h: InternalHarness;
  let getViewportGridY: Mock<() => number>;
  let pushUndoSnapshot: Mock<(actionLabel: string) => void>;
  let scheduleSave: Mock<() => void>;
  let refreshStableSnapshot: Mock<() => void>;
  let recordChatTileForCleanup: Mock<
    (gridId: string, tileId: string) => void
  >;
  let controller: GridTileStructureController;

  beforeEach(() => {
    vi.clearAllMocks();
    h = createHarness();
    getViewportGridY = vi.fn<() => number>(() => 0);
    pushUndoSnapshot = vi.fn<(actionLabel: string) => void>();
    scheduleSave = vi.fn<() => void>();
    refreshStableSnapshot = vi.fn<() => void>();
    recordChatTileForCleanup =
      vi.fn<(gridId: string, tileId: string) => void>();
    controller = new GridTileStructureController(
      h.stores,
      h.dependencies,
      getViewportGridY,
      pushUndoSnapshot,
      scheduleSave,
      refreshStableSnapshot,
      recordChatTileForCleanup,
    );
  });

  const textContent = (): TileContent => createTileContent(ContentType.TEXT);

  describe("addTile", () => {
    it("returns null with no active grid", () => {
      expect(controller.addTile(textContent())).toBeNull();
    });

    it("adds a tile, captures history, persists, and logs analytics", () => {
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [] }));

      const id = controller.addTile(textContent());

      expect(id).toBe("uuid");
      expect(h.stores.session.currentGrid?.tiles).toHaveLength(1);
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Add tile");
      expect(scheduleSave).toHaveBeenCalledTimes(1);
      expect(h.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AnalyticsEventType.TILE_ADDED,
          gridId: "grid-1",
          metadata: { tileType: ContentType.TEXT, tileId: "uuid" },
        }),
      );
    });

    it("trims a new tile width to a narrow canonical grid", () => {
      h.stores.session.setCurrentGrid(
        makeGrid({ colNum: 3, tiles: [] }),
      );

      const id = controller.addTile(
        createTileContent(ContentType.PROFILE),
      );

      const created = h.stores.session.currentGrid?.tiles.find(
        (tile) => tile.i === id,
      );
      expect(created).toMatchObject({ x: 0, w: 3, h: 4 });
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("enforces a tile type's maxPerGrid and toasts instead of adding", () => {
      // Campfire is registered with maxPerGrid: 1.
      h.stores.session.setCurrentGrid(
        makeGrid({
          tiles: [
            makeLinkTile({
              i: "existing",
              content: { type: ContentType.CAMPFIRE } as TileContent,
            }),
          ],
        }),
      );
      const addToast = vi.spyOn(h.stores.toast, "addToast");

      const id = controller.addTile({
        type: ContentType.CAMPFIRE,
      } as TileContent);

      expect(id).toBeNull();
      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining("allowed per grid"),
        "error",
      );
      expect(h.stores.session.currentGrid?.tiles).toHaveLength(1);
    });

    it("stores normalized content built from the requested type", () => {
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [] }));

      controller.addTile(textContent());

      // createTile rebuilds content via the registry default rather than
      // storing the caller-supplied object as an identity.
      const stored = h.stores.session.currentGrid!.tiles[0]!.content;
      expect(stored.type).toBe(ContentType.TEXT);
      expect(stored).toEqual(createTileContent(ContentType.TEXT));
    });

    it("places a tile at the viewport row when the measurement is positive", () => {
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [] }));
      getViewportGridY.mockReturnValue(5);

      controller.addTile(textContent());

      // findBestXAtRow places the new tile at the measured row.
      expect(h.stores.session.currentGrid?.tiles[0]?.y).toBe(5);
    });

    it("does not log analytics for internal-only suggestion tiles", () => {
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [] }));
      controller.addTile({ type: ContentType.SUGGESTION } as TileContent);
      expect(h.logEvent).not.toHaveBeenCalled();
    });

    it("still adds the tile when analytics logging throws", () => {
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [] }));
      h.logEvent.mockImplementationOnce(() => {
        throw new Error("analytics down");
      });

      const id = controller.addTile(textContent());

      // Analytics must never make a grid mutation fail.
      expect(id).toBe("uuid");
      expect(h.stores.session.currentGrid?.tiles).toHaveLength(1);
    });

    it("allows adding a capped tile type below its maxPerGrid limit", () => {
      // Campfire is capped at 1; with zero existing the add is permitted.
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [] }));

      const id = controller.addTile({
        type: ContentType.CAMPFIRE,
      } as TileContent);

      expect(id).not.toBeNull();
      expect(h.stores.session.currentGrid?.tiles).toHaveLength(1);
    });
  });

  describe("duplicateTile", () => {
    it("returns null when the source tile is missing", () => {
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [] }));
      expect(controller.duplicateTile("missing")).toBeNull();
    });

    it("deep-clones the source content into a new tile", () => {
      const source = makeLinkTile({ i: "src", x: 0, y: 0, w: 2, h: 2 });
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [source] }));

      const newId = controller.duplicateTile("src");

      expect(newId).toBe("uuid");
      const clone = h.stores.session.currentGrid!.tiles.find(
        (t) => t.i === "uuid",
      );
      expect(clone).toBeDefined();
      expect(clone?.content).toEqual(source.content);
      expect(clone?.content).not.toBe(source.content);
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Duplicate tile");
      expect(scheduleSave).toHaveBeenCalledTimes(1);
      expect(h.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AnalyticsEventType.TILE_ADDED,
          gridId: "grid-1",
          metadata: { tileType: ContentType.LINK, tileId: "uuid" },
        }),
      );
    });

    it("uses the same viewport-first placement behavior as adding a tile", () => {
      const source = makeLinkTile({ i: "src", x: 0, y: 0, w: 2, h: 2 });
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [source] }));
      getViewportGridY.mockReturnValue(6);

      const newId = controller.duplicateTile("src")!;
      const clone = h.stores.session.currentGrid!.tiles.find(
        (tile) => tile.i === newId,
      );

      expect(clone).toEqual(expect.objectContaining({ x: 0, y: 6 }));
    });

    it("repairs pre-existing overlap and keeps every duplicate in bounds", () => {
      const first = makeLinkTile({ i: "a", x: 0, y: 0, w: 7, h: 2 });
      const source = makeLinkTile({ i: "src", x: 0, y: 0, w: 7, h: 2 });
      h.stores.session.setCurrentGrid(
        makeGrid({ colNum: 12, tiles: [first, source] }),
      );

      controller.duplicateTile("src");

      const tiles = h.stores.session.currentGrid!.tiles;
      expect(tiles.every((tile) => tile.x >= 0 && tile.y >= 0)).toBe(true);
      expect(tiles.every((tile) => tile.x + tile.w <= 12)).toBe(true);
      for (let left = 0; left < tiles.length; left += 1) {
        for (let right = left + 1; right < tiles.length; right += 1) {
          const a = tiles[left]!;
          const b = tiles[right]!;
          expect(
            a.x < b.x + b.w &&
              a.x + a.w > b.x &&
              a.y < b.y + b.h &&
              a.y + a.h > b.y,
          ).toBe(false);
        }
      }
    });

    it("copies resolved document item urls onto the duplicate", () => {
      const source = makeDocumentTile({ i: "src" });
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [source] }));
      h.stores.uploads.setResolvedDocumentItemUrl(
        "src",
        "item-1",
        "https://cdn/doc",
      );

      const newId = controller.duplicateTile("src")!;

      expect(
        h.stores.uploads.resolvedDocumentItemUrls[newId]?.["item-1"],
      ).toBe("https://cdn/doc");
    });

    it("derives the duplicate from the active breakpoint override when present", () => {
      const source = makeLinkTile({ i: "src", x: 0, y: 0, w: 2, h: 2 });
      h.stores.session.setCurrentGrid(
        makeGrid({
          tiles: [source],
          overrides: { sm: { src: { x: 1, y: 1, w: 3, h: 3 } } },
        }),
      );
      h.stores.viewport.setActiveBreakpoint("sm");

      const newId = controller.duplicateTile("src")!;
      const clone = h.stores.session.currentGrid!.tiles.find(
        (t) => t.i === newId,
      );

      // Canonical geometry remains canonical; the responsive copy keeps the
      // source override size and receives its own collision-free placement.
      expect(clone?.w).toBe(2);
      expect(clone?.h).toBe(2);
      const cloneOverride =
        h.stores.session.currentGrid!.overrides?.sm?.[newId];
      expect(cloneOverride).toEqual({ x: 0, y: 4, w: 3, h: 3 });
      expect(cloneOverride!.x + cloneOverride!.w).toBeLessThanOrEqual(4);
    });
  });

  describe("removeTile", () => {
    it("does nothing without a grid", () => {
      controller.removeTile("t1");
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
    });

    it("removes the tile, clears overrides, and refreshes stable history", () => {
      const tile = makeLinkTile({ i: "t1" });
      h.stores.session.setCurrentGrid(
        makeGrid({
          tiles: [tile],
          overrides: { sm: { t1: { x: 0, y: 0, w: 1, h: 1 } } },
        }),
      );
      const clearTileState = vi.spyOn(h.stores.uploads, "clearTileState");

      controller.removeTile("t1");

      expect(h.stores.session.currentGrid?.tiles).toHaveLength(0);
      expect(h.stores.session.currentGrid?.overrides?.sm?.t1).toBeUndefined();
      expect(clearTileState).toHaveBeenCalledWith("t1", [], {});
      expect(pushUndoSnapshot).toHaveBeenCalledWith("Remove tile");
      expect(scheduleSave).toHaveBeenCalledTimes(1);
      expect(refreshStableSnapshot).toHaveBeenCalledTimes(1);
      expect(h.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AnalyticsEventType.TILE_REMOVED,
          metadata: { tileType: ContentType.LINK, tileId: "t1" },
        }),
      );
    });

    it.each<Breakpoint>(["md", "sm"])(
      "persists Griddle's settled %s layout in the removal transaction",
      (breakpoint) => {
        const first = makeLinkTile({ i: "t1" });
        const second = makeLinkTile({ i: "t2" });
        h.stores.session.setCurrentGrid(
          makeGrid({
            tiles: [first, second],
            overrides: {
              [breakpoint]: {
                t1: { x: 0, y: 0, w: 2, h: 2 },
                t2: { x: 0, y: 4, w: 2, h: 2 },
              },
            },
          }),
        );
        h.stores.viewport.setActiveBreakpoint(breakpoint);

        controller.removeTile("t1", [
          { i: "t2", x: 0, y: 0, w: 2, h: 2 },
        ]);

        expect(h.stores.session.currentGrid?.overrides?.[breakpoint]).toEqual({
          t2: { x: 0, y: 0, w: 2, h: 2 },
        });
        expect(pushUndoSnapshot).toHaveBeenCalledWith("Remove tile");
        expect(scheduleSave).toHaveBeenCalledTimes(1);
        expect(refreshStableSnapshot).toHaveBeenCalledTimes(1);
      },
    );

    it("passes blob object urls of the removed tile to clearTileState", () => {
      const tile = makeImageTile({ i: "t1" });
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [tile] }));
      const clearTileState = vi.spyOn(h.stores.uploads, "clearTileState");

      controller.removeTile("t1");

      expect(clearTileState).toHaveBeenCalledWith("t1", ["blob:media"], {});
    });

    it("maps blob urls still shown by a remaining tile to their surviving owner", () => {
      const original = makeImageTile({ i: "t1" });
      const duplicate = makeImageTile({ i: "t2" });
      h.stores.session.setCurrentGrid(
        makeGrid({ tiles: [original, duplicate] }),
      );
      const clearTileState = vi.spyOn(h.stores.uploads, "clearTileState");

      controller.removeTile("t1");

      expect(clearTileState).toHaveBeenCalledWith("t1", ["blob:media"], {
        "blob:media": "t2",
      });
    });

    it("still schedules a save and refreshes when removing an unknown id", () => {
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [] }));
      controller.removeTile("missing");
      expect(scheduleSave).toHaveBeenCalledTimes(1);
      expect(refreshStableSnapshot).toHaveBeenCalledTimes(1);
      expect(h.logEvent).not.toHaveBeenCalled();
    });

    it("records a removed chat tile for deferred message cleanup", () => {
      const tile: Tile = {
        i: "chat-1",
        x: 0,
        y: 0,
        w: 2,
        h: 2,
        caption: "",
        content: { type: ContentType.CHAT, messages: [] } as ChatContent,
      };
      h.stores.session.setCurrentGrid(
        makeGrid({ id: "grid-1", tiles: [tile] }),
      );

      controller.removeTile("chat-1");

      expect(recordChatTileForCleanup).toHaveBeenCalledWith(
        "grid-1",
        "chat-1",
      );
      // Deferred, not immediate: the DAO/service is never touched here.
      expect(h.deleteAllMessages).not.toHaveBeenCalled();
    });

    it("does not record cleanup when removing a non-chat tile", () => {
      const tile = makeLinkTile({ i: "t1" });
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [tile] }));

      controller.removeTile("t1");

      expect(recordChatTileForCleanup).not.toHaveBeenCalled();
    });
  });

  describe("resizeTile", () => {
    it("does nothing without a grid or tile", () => {
      controller.resizeTile("t1", 3, 3);
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [] }));
      controller.resizeTile("t1", 3, 3);
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("resizes the tile directly at the lg breakpoint", () => {
      const tile = makeLinkTile({ i: "t1", x: 0, y: 0, w: 2, h: 2 });
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [tile] }));
      h.stores.viewport.setActiveBreakpoint("lg");
      h.stores.viewport.setDisplayPositions([
        { i: "t1", x: 0, y: 0, w: 2, h: 2 },
      ]);

      controller.resizeTile("t1", 4, 5);

      expect(tile.w).toBe(4);
      expect(tile.h).toBe(5);
      expect(h.stores.viewport.displayPositions[0]).toMatchObject({
        w: 4,
        h: 5,
      });
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("trims lg width at the right edge without moving the tile left", () => {
      const tile = makeLinkTile({ i: "t1", x: 10, y: 0, w: 2, h: 2 });
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [tile] }));
      h.stores.viewport.setActiveBreakpoint("lg");
      h.stores.viewport.setDisplayPositions([
        { i: "t1", x: 10, y: 0, w: 2, h: 2 },
      ]);

      controller.resizeTile("t1", 4, 4);

      expect(tile.x).toBe(10);
      expect(h.stores.viewport.displayPositions[0]).toMatchObject({
        x: 10,
        w: 2,
        h: 4,
      });
    });

    it("clamps width to the sm column count and writes an override", () => {
      const tile = makeLinkTile({ i: "t1", x: 0, y: 0, w: 2, h: 2 });
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [tile] }));
      h.stores.viewport.setActiveBreakpoint("sm");
      h.stores.viewport.setDisplayPositions([
        { i: "t1", x: 0, y: 0, w: 2, h: 2 },
      ]);

      // sm has 4 columns, so a requested width of 10 is clamped to 4.
      controller.resizeTile("t1", 10, 3);

      const override = h.stores.session.currentGrid!.overrides?.sm?.t1;
      // x:0 with clampedWidth 4 → clampedX = min(0, 4-4) = 0.
      expect(override).toEqual({ x: 0, y: 0, w: 4, h: 3 });
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("trims override width at the right edge without moving it left", () => {
      const tile = makeLinkTile({ i: "t1", x: 3, y: 1, w: 1, h: 1 });
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [tile] }));
      h.stores.viewport.setActiveBreakpoint("sm");
      h.stores.viewport.setDisplayPositions([
        { i: "t1", x: 3, y: 1, w: 1, h: 1 },
      ]);

      controller.resizeTile("t1", 2, 2);

      expect(h.stores.session.currentGrid!.overrides?.sm?.t1).toEqual({
        x: 3,
        y: 1,
        w: 1,
        h: 2,
      });
    });

    it("clamps width to the md column count (8)", () => {
      const tile = makeLinkTile({ i: "t1", x: 0, y: 0, w: 2, h: 2 });
      h.stores.session.setCurrentGrid(makeGrid({ tiles: [tile] }));
      h.stores.viewport.setActiveBreakpoint("md");
      h.stores.viewport.setDisplayPositions([
        { i: "t1", x: 0, y: 0, w: 2, h: 2 },
      ]);

      controller.resizeTile("t1", 12, 4);

      expect(h.stores.session.currentGrid!.overrides?.md?.t1?.w).toBe(8);
    });
  });
});
