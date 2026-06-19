import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CampfireContent,
  ContentType,
  type DocumentsContent,
  type ImageContent,
  type LinkContent,
  type ProfileBioContent,
  type SuggestionContent,
  type TileContent,
} from "@grids/contracts/types";
import {
  createLoadedGridStore,
  gridHarness,
  makeGrid,
  makeTile,
  resetGridHarness,
} from "./gridTestHarness";

describe("grid store tile and grid mutations", () => {
  beforeEach(() => {
    resetGridHarness();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("toggles and sets gravity with history captured before one save", async () => {
    const store = await createLoadedGridStore();
    const manager = gridHarness.undoManagers[0];

    store.toggleVerticalCompact();

    expect(store.currentGrid?.verticalCompact).toBe(false);
    expect(manager?.pushSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionLabel: "Toggle gravity",
        verticalCompact: true,
      }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);

    gridHarness.gridService.queueSave.mockClear();
    store.setVerticalCompact(true);

    expect(store.currentGrid?.verticalCompact).toBe(true);
    expect(manager?.pushSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionLabel: "Set gravity",
        verticalCompact: false,
      }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("captures history and saves when gravity is set to its existing value", async () => {
    const store = await createLoadedGridStore();
    const manager = gridHarness.undoManagers[0];

    store.setVerticalCompact(true);

    expect(store.currentGrid?.verticalCompact).toBe(true);
    expect(manager?.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        actionLabel: "Set gravity",
        verticalCompact: true,
      }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("adds a tile at the first available top-of-grid position", async () => {
    const store = await createLoadedGridStore(makeGrid({ tiles: [] }));
    vi.spyOn(store, "getViewportGridY").mockReturnValue(0);
    gridHarness.getTileDefinition.mockReturnValue({
      defaultSize: { w: 3, h: 4 },
    });
    gridHarness.findFirstAvailableSpot.mockReturnValue({ x: 1, y: 2 });

    const id = store.addTile({ type: ContentType.TEXT } as TileContent);

    expect(id).toBe("generated-tile");
    expect(gridHarness.findFirstAvailableSpot).toHaveBeenCalledWith(
      expect.any(Array),
      12,
      3,
      4,
    );
    expect(gridHarness.findBestXAtRow).not.toHaveBeenCalled();
    expect(gridHarness.pushTilesForNewItem).toHaveBeenCalledWith(
      expect.any(Array),
      1,
      2,
      3,
      4,
    );
    expect(store.currentGrid?.tiles[0]).toEqual(
      expect.objectContaining({
        i: "generated-tile",
        x: 1,
        y: 2,
        w: 3,
        h: 4,
      }),
    );
    expect(gridHarness.undoManagers[0]?.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ actionLabel: "Add tile", tiles: [] }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
    expect(gridHarness.analyticsService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        gridId: "grid-1",
        metadata: {
          tileType: ContentType.TEXT,
          tileId: "generated-tile",
        },
      }),
    );
    expect(gridHarness.events).toEqual(["save", "analytics"]);
  });

  it("places a new tile at the visible viewport row when scrolled", async () => {
    const store = await createLoadedGridStore(makeGrid({ tiles: [] }));
    vi.spyOn(store, "getViewportGridY").mockReturnValue(7);
    gridHarness.findBestXAtRow.mockReturnValue({ x: 4, y: 7 });

    store.addTile({ type: ContentType.IMAGE } as TileContent);

    expect(gridHarness.findBestXAtRow).toHaveBeenCalledWith(
      expect.any(Array),
      12,
      2,
      2,
      7,
    );
    expect(gridHarness.findFirstAvailableSpot).not.toHaveBeenCalled();
  });

  it("rejects a tile when the registry max-per-grid constraint is reached", async () => {
    const existing = makeTile({
      content: {
        type: ContentType.CAMPFIRE,
        count: 0,
        highScore: 0,
      } as CampfireContent,
    });
    const store = await createLoadedGridStore(makeGrid({ tiles: [existing] }));
    gridHarness.getTileDefinition.mockReturnValue({
      maxPerGrid: 1,
      label: "Campfire",
    });

    const id = store.addTile({
      type: ContentType.CAMPFIRE,
      count: 0,
      highScore: 0,
    } as CampfireContent);

    expect(id).toBeNull();
    expect(gridHarness.toastStore.addToast).toHaveBeenCalledWith(
      "Only 1 Campfire tile allowed per grid",
      "error",
    );
    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();
    expect(gridHarness.analyticsService.logEvent).not.toHaveBeenCalled();
  });

  it("does not emit analytics for internal suggestion tiles", async () => {
    const store = await createLoadedGridStore(makeGrid({ tiles: [] }));
    vi.spyOn(store, "getViewportGridY").mockReturnValue(0);

    store.addTile({
      type: ContentType.SUGGESTION,
      action: "text",
    } as SuggestionContent);

    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
    expect(gridHarness.analyticsService.logEvent).not.toHaveBeenCalled();
  });

  it("replaces tile content and applies profile sizing", async () => {
    const tile = makeTile({ x: 10, w: 2, h: 2 });
    const store = await createLoadedGridStore(makeGrid({ tiles: [tile] }));
    const profile = {
      type: ContentType.PROFILE,
      name: "Ada",
      title: "Engineer",
      bio: "",
      avatarShape: "circle",
      avatarRadius: 50,
    } as ProfileBioContent;

    store.setTileContent("tile-1", profile);

    expect(store.currentGrid?.tiles[0]?.content).toEqual(profile);
    expect(store.currentGrid?.tiles[0]).toEqual(
      expect.objectContaining({ w: 4, h: 4 }),
    );
    expect(gridHarness.adjustTilePosition).toHaveBeenCalledWith(
      store.currentGrid?.tiles[0],
      12,
    );
    expect(gridHarness.undoManagers[0]?.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ actionLabel: "Change tile content" }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("ignores content replacement for missing grids or tiles", async () => {
    const store = await createLoadedGridStore();
    gridHarness.gridService.queueSave.mockClear();

    store.setTileContent("missing", { type: ContentType.TEXT } as TileContent);
    store.currentGrid = null;
    store.setTileContent("tile-1", { type: ContentType.TEXT } as TileContent);

    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();
  });

  it("patches changed content, skips no-op patches, and saves once", async () => {
    const store = await createLoadedGridStore();
    const manager = gridHarness.undoManagers[0];

    store.patchTileContent("tile-1", { text: "Hello" });

    expect(manager?.pushSnapshot).not.toHaveBeenCalled();
    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();

    store.patchTileContent("tile-1", { text: "Updated" });

    expect(store.currentGrid?.tiles[0]?.content).toEqual(
      expect.objectContaining({ text: "Updated" }),
    );
    expect(manager?.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ actionLabel: "Update tile" }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("does not create per-keystroke history while an edit transaction is active", async () => {
    const store = await createLoadedGridStore();
    const manager = gridHarness.undoManagers[0];

    store.beginEditing("tile-1");
    manager?.pushSnapshot.mockClear();

    store.patchTileContent("tile-1", { text: "Updated" });

    expect(manager?.pushSnapshot).not.toHaveBeenCalled();
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("patches one document item without changing its siblings", async () => {
    const documentTile = makeTile({
      content: {
        type: ContentType.DOCUMENT,
        items: [
          { id: "item-1", fileName: "one.pdf", url: "one" },
          { id: "item-2", fileName: "two.pdf", url: "two" },
        ],
      } as DocumentsContent,
    });
    const store = await createLoadedGridStore(
      makeGrid({ tiles: [documentTile] }),
    );

    store.patchDocumentItem("tile-1", "item-1", {
      thumbnailUrl: "thumb",
    });

    const content = store.currentGrid?.tiles[0]?.content as DocumentsContent;
    expect(content.items).toEqual([
      {
        id: "item-1",
        fileName: "one.pdf",
        url: "one",
        thumbnailUrl: "thumb",
      },
      { id: "item-2", fileName: "two.pdf", url: "two" },
    ]);
    expect(gridHarness.undoManagers[0]?.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ actionLabel: "Update document" }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("updates theme, duplicatability, backgrounds, OG image, and color", async () => {
    const store = await createLoadedGridStore();
    const manager = gridHarness.undoManagers[0];

    store.setGridTheme("theme-b");
    expect(store.currentGrid?.themeId).toBe("theme-b");
    expect(manager?.pushSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ actionLabel: "Change theme" }),
    );

    store.setDuplicatable(true);
    expect(store.currentGrid?.duplicatable).toBe(true);

    store.addBackgroundImage("https://example.com/background", true);
    expect(store.currentGrid).toEqual(
      expect.objectContaining({
        backgroundImageSrc: "https://example.com/background",
        backgroundEmbed: true,
      }),
    );

    store.removeBackgroundImage();
    expect(store.currentGrid).toEqual(
      expect.objectContaining({
        backgroundImageSrc: "",
        backgroundEmbed: false,
      }),
    );

    store.setCustomOgImage("https://example.com/og");
    expect(store.currentGrid?.ogImageSrc).toBe("https://example.com/og");
    expect(manager?.pushSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ actionLabel: "Change social share image" }),
    );

    store.removeCustomOgImage();
    expect(store.currentGrid?.ogImageSrc).toBe("");
    expect(manager?.pushSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ actionLabel: "Remove social share image" }),
    );

    store.setBackgroundColor("#123456");
    expect(store.currentGrid?.backgroundColor).toBe("#123456");

    store.removeBackgroundColor();
    expect(store.currentGrid?.backgroundColor).toBe("");

    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(8);
  });

  it("captures pre-mutation history for background image and color changes", async () => {
    const store = await createLoadedGridStore();
    const manager = gridHarness.undoManagers[0]!;

    store.addBackgroundImage("https://example.com/background", true);
    store.removeBackgroundImage();
    store.setBackgroundColor("#123456");
    store.removeBackgroundColor();

    expect(manager.pushSnapshot).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        actionLabel: "Change background image",
        backgroundImageSrc: "",
        backgroundEmbed: false,
      }),
    );
    expect(manager.pushSnapshot).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        actionLabel: "Remove background image",
        backgroundImageSrc: "https://example.com/background",
        backgroundEmbed: true,
      }),
    );
    expect(manager.pushSnapshot).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        actionLabel: "Change background color",
        backgroundColor: "",
      }),
    );
    expect(manager.pushSnapshot).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        actionLabel: "Remove background color",
        backgroundColor: "#123456",
      }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(4);
  });

  it("duplicates a tile using displayed size and copies content and overrides", async () => {
    const source = makeTile({
      i: "source",
      x: 1,
      y: 2,
      w: 2,
      h: 2,
      caption: "Caption",
      borderEnabled: false,
      content: {
        type: ContentType.DOCUMENT,
        items: [{ id: "item-1", fileName: "one.pdf", url: "blob:one" }],
      } as DocumentsContent,
    });
    const store = await createLoadedGridStore(
      makeGrid({
        tiles: [source],
        overrides: {
          md: {
            source: { x: 3, y: 5, w: 4, h: 6 },
          },
          sm: {
            source: { x: 0, y: 1, w: 4, h: 3 },
          },
        },
      }),
    );
    store.activeBreakpoint = "md";
    store.resolvedDocumentItemUrls.source = {
      "item-1": "https://cdn.example/one",
    };
    gridHarness.findBestXAtRow.mockReturnValue({ x: 0, y: 11 });

    const id = store.duplicateTile("source");

    expect(id).toBe("generated-tile");
    expect(gridHarness.findBestXAtRow).toHaveBeenCalledWith(
      expect.any(Array),
      12,
      4,
      6,
      11,
    );
    const duplicate = store.currentGrid?.tiles.find(
      (tile) => tile.i === "generated-tile",
    );
    expect(duplicate).toEqual({
      i: "generated-tile",
      x: 0,
      y: 11,
      w: 4,
      h: 6,
      borderEnabled: false,
      caption: "Caption",
      content: source.content,
    });
    expect(duplicate?.content).not.toBe(source.content);
    expect(store.resolvedDocumentItemUrls["generated-tile"]).toEqual({
      "item-1": "https://cdn.example/one",
    });
    expect(
      store.currentGrid?.overrides?.md?.["generated-tile"],
    ).toEqual({ x: 0, y: 11, w: 4, h: 6 });
    expect(
      store.currentGrid?.overrides?.sm?.["generated-tile"],
    ).toEqual({ x: 0, y: 11, w: 4, h: 3 });
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
    expect(gridHarness.events).toEqual(["save", "analytics"]);
  });

  it("returns null when duplicating without an active grid or source tile", async () => {
    const store = await createLoadedGridStore();

    expect(store.duplicateTile("missing")).toBeNull();
    store.currentGrid = null;
    expect(store.duplicateTile("tile-1")).toBeNull();
    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();
  });

  it("removes a tile, optimistic URLs, overrides, and upload state", async () => {
    const media = makeTile({
      i: "media",
      content: {
        type: ContentType.IMAGE,
        src: "blob:media",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as ImageContent,
    });
    const document = makeTile({
      i: "document",
      content: {
        type: ContentType.DOCUMENT,
        items: [
          { id: "one", fileName: "one.pdf", url: "blob:one" },
          { id: "two", fileName: "two.pdf", url: "https://cdn/two" },
        ],
      } as DocumentsContent,
    });
    const store = await createLoadedGridStore(
      makeGrid({
        tiles: [media, document],
        overrides: {
          md: {
            media: { x: 0, y: 0, w: 2, h: 2 },
            document: { x: 2, y: 0, w: 2, h: 2 },
          },
        },
      }),
    );
    store.uploadingTiles.media = 0.5;
    store.resolvedUrls.media = "https://cdn/media";
    store.resolvedDocumentItemUrls.media = { item: "https://cdn/item" };

    store.removeTile("media");

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:media");
    expect(store.currentGrid?.tiles.map((tile) => tile.i)).toEqual([
      "document",
    ]);
    expect(store.uploadingTiles.media).toBeUndefined();
    expect(store.resolvedUrls.media).toBeUndefined();
    expect(store.resolvedDocumentItemUrls.media).toBeUndefined();
    expect(store.currentGrid?.overrides?.md?.media).toBeUndefined();
    expect(gridHarness.undoManagers[0]?.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ actionLabel: "Remove tile" }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
    expect(gridHarness.events).toEqual(["analytics", "save"]);

    gridHarness.gridService.queueSave.mockClear();
    store.removeTile("document");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one");
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("https://cdn/two");
  });

  it("toggles tile border and link background with one save each", async () => {
    const link = makeTile({
      borderEnabled: false,
      content: {
        type: ContentType.LINK,
        link: "https://example.com",
        linkBackgroundEnabled: false,
      } as LinkContent,
    });
    const store = await createLoadedGridStore(makeGrid({ tiles: [link] }));

    store.toggleTileBorder("tile-1");
    expect(store.currentGrid?.tiles[0]?.borderEnabled).toBe(true);

    store.toggleLinkBackground("tile-1");
    expect(
      (store.currentGrid?.tiles[0]?.content as LinkContent)
        .linkBackgroundEnabled,
    ).toBe(true);

    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(2);
    expect(gridHarness.undoManagers[0]?.pushSnapshot).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ actionLabel: "Toggle tile border" }),
    );
    expect(gridHarness.undoManagers[0]?.pushSnapshot).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ actionLabel: "Toggle link background" }),
    );
  });

  it("synchronizes rendered desktop positions before persistence", async () => {
    const store = await createLoadedGridStore();
    const canonicalContent = store.currentGrid!.tiles[0]!.content;
    store.setDisplayPositions([
      { i: "tile-1", x: 5, y: 6, w: 7, h: 8 },
      { i: "missing", x: 0, y: 0, w: 1, h: 1 },
    ]);

    store.updateGrid();

    expect(store.currentGrid?.tiles[0]).toEqual(
      expect.objectContaining({ x: 5, y: 6, w: 7, h: 8 }),
    );
    expect(store.currentGrid?.tiles[0]?.content).toBe(canonicalContent);
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("blocks update persistence when the session is not editable", async () => {
    const store = await createLoadedGridStore();
    store.isOwner = false;
    store.setDisplayPositions([
      { i: "tile-1", x: 5, y: 6, w: 7, h: 8 },
    ]);

    store.updateGrid();

    expect(store.currentGrid?.tiles[0]).toEqual(
      expect.objectContaining({ x: 0, y: 0, w: 2, h: 2 }),
    );
    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();
  });
});
