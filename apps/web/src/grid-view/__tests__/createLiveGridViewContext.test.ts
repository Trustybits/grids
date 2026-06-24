import { describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import type {
  AnyTileContent,
  Breakpoint,
  DocumentItem,
  Grid,
} from "@grids/contracts/types";
import type { GridHistoryUrlMaps } from "@/controllers/GridController";
import { createLiveGridViewContext } from "@/grid-view/createLiveGridViewContext";
import type { GridLayoutItem } from "@/types/GridLayout";

const storeHolder = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/stores/grid", () => ({
  useGridStore: () => storeHolder.current,
}));

function makeGrid(id: string): Grid {
  return {
    id,
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
  };
}

function makeStore() {
  return reactive({
    currentGrid: makeGrid("grid-1") as Grid | null,
    isOwner: true,
    canEdit: true,
    isLoading: false,
    verticalCompact: true,
    activeBreakpoint: "lg" as Breakpoint,
    viewportBreakpoint: "lg" as Breakpoint,
    forcedBreakpoint: null as Breakpoint | null,
    displayPositions: [{ i: "tile-1", x: 0, y: 0, w: 2, h: 2 }],
    showMetaData: true,
    showMetaDataVerbose: false,
    uploadingTiles: { "tile-1": 0.25 },
    activeTileId: "tile-1" as string | null,
    activePanelId: "settings" as string | null,
    pendingFocusTileId: null as string | null,
    registerLayoutReadinessAdapter: vi.fn(() => vi.fn()),
    setActiveBreakpoint: vi.fn(),
    setViewportBreakpoint: vi.fn(),
    setForcedBreakpoint: vi.fn(),
    setDisplayPositions: vi.fn(),
    commitCompactedLayout: vi.fn(),
    beginMove: vi.fn(),
    commitMove: vi.fn(),
    beginResize: vi.fn(),
    commitResize: vi.fn(),
    beginEditing: vi.fn(),
    commitEditing: vi.fn(),
    setTileContent: vi.fn(),
    patchTileContent: vi.fn(),
    autosaveTileContent: vi.fn(),
    patchDocumentItem: vi.fn(),
    updateCaption: vi.fn(),
    removeTile: vi.fn(),
    duplicateTile: vi.fn(() => "tile-copy"),
    resizeTile: vi.fn(),
    toggleTileBorder: vi.fn(),
    toggleLinkBackground: vi.fn(),
    setPanelActive: vi.fn(),
    toggleMenuActive: vi.fn(),
    togglePanelActive: vi.fn(),
    closeMenus: vi.fn(),
    getCookieValue: vi.fn(() => "cookie-value"),
  });
}

describe("createLiveGridViewContext", () => {
  it("maps read state to computed facade values", () => {
    const store = makeStore();
    storeHolder.current = store;

    const ctx = createLiveGridViewContext();

    expect(ctx.mode).toBe("live");
    expect(ctx.grid.value).toBe(store.currentGrid);
    expect(ctx.isOwner.value).toBe(true);
    expect(ctx.canEdit.value).toBe(true);
    expect(ctx.isLoading.value).toBe(false);
    expect(ctx.verticalCompact.value).toBe(true);
    expect(ctx.activeBreakpoint.value).toBe("lg");
    expect(ctx.viewportBreakpoint.value).toBe("lg");
    expect(ctx.forcedBreakpoint.value).toBeNull();
    expect(ctx.displayPositions.value).toBe(store.displayPositions);
    expect(ctx.showMetaData.value).toBe(true);
    expect(ctx.showMetaDataVerbose.value).toBe(false);
    expect(ctx.uploadingTiles.value).toBe(store.uploadingTiles);
    expect(ctx.activeTileId.value).toBe("tile-1");
    expect(ctx.activePanelId.value).toBe("settings");

    const nextGrid = makeGrid("grid-2");
    store.currentGrid = nextGrid;
    store.canEdit = false;
    store.activeBreakpoint = "md";
    store.pendingFocusTileId = "tile-2";

    expect(ctx.grid.value).toBe(store.currentGrid);
    expect(ctx.canEdit.value).toBe(false);
    expect(ctx.activeBreakpoint.value).toBe("md");
    expect(ctx.pendingFocusTileId.value).toBe("tile-2");

    ctx.pendingFocusTileId.value = "tile-3";

    expect(store.pendingFocusTileId).toBe("tile-3");
  });

  it("forwards layout, edit, content, tile, menu, and metadata commands", () => {
    const store = makeStore();
    storeHolder.current = store;
    const ctx = createLiveGridViewContext();
    const adapter = { waitForLayoutReady: vi.fn(async () => undefined) };
    const positions: GridLayoutItem[] = [
      { i: "tile-1", x: 1, y: 2, w: 3, h: 4 },
    ];
    const urlMaps: GridHistoryUrlMaps = {
      resolvedUrls: { "tile-1": "https://example.com/media.png" },
      resolvedDocumentItemUrls: {
        "tile-2": { "item-1": "https://example.com/doc.pdf" },
      },
    };
    const content = { type: "text", text: "hello" } as AnyTileContent;
    const patch = { text: "updated" } as Partial<AnyTileContent>;
    const itemPatch = { name: "Document" } as Partial<DocumentItem>;

    const dispose = ctx.registerLayoutReadinessAdapter(adapter);
    ctx.setActiveBreakpoint("md");
    ctx.setViewportBreakpoint("sm");
    ctx.setForcedBreakpoint("md");
    ctx.setDisplayPositions(positions);
    ctx.commitCompactedLayout(positions);
    ctx.beginMove(urlMaps);
    ctx.commitMove(urlMaps);
    ctx.beginResize(urlMaps);
    ctx.commitResize(urlMaps);
    ctx.beginEditing("tile-1", urlMaps);
    ctx.commitEditing(urlMaps);
    ctx.setTileContent("tile-1", content);
    ctx.patchTileContent("tile-1", patch);
    ctx.autosaveTileContent("tile-1", patch);
    ctx.patchDocumentItem("tile-2", "item-1", itemPatch);
    ctx.updateCaption({ tileId: "tile-1", caption: "Caption" });
    ctx.removeTile("tile-1");
    const duplicateId = ctx.duplicateTile("tile-1");
    ctx.resizeTile("tile-1", 4, 5);
    ctx.toggleTileBorder("tile-1");
    ctx.toggleLinkBackground("tile-1");
    ctx.setPanelActive("tile-1", "settings");
    ctx.toggleMenuActive("tile-1");
    ctx.togglePanelActive("tile-1", "settings");
    ctx.closeMenus();
    const cookieValue = ctx.getCookieValue("showMetaData");

    expect(store.registerLayoutReadinessAdapter).toHaveBeenCalledWith(
      adapter,
    );
    expect(typeof dispose).toBe("function");
    expect(store.setActiveBreakpoint).toHaveBeenCalledWith("md");
    expect(store.setViewportBreakpoint).toHaveBeenCalledWith("sm");
    expect(store.setForcedBreakpoint).toHaveBeenCalledWith("md");
    expect(store.setDisplayPositions).toHaveBeenCalledWith(positions);
    expect(store.commitCompactedLayout).toHaveBeenCalledWith(positions);
    expect(store.beginMove).toHaveBeenCalledWith(urlMaps);
    expect(store.commitMove).toHaveBeenCalledWith(urlMaps);
    expect(store.beginResize).toHaveBeenCalledWith(urlMaps);
    expect(store.commitResize).toHaveBeenCalledWith(urlMaps);
    expect(store.beginEditing).toHaveBeenCalledWith("tile-1", urlMaps);
    expect(store.commitEditing).toHaveBeenCalledWith(urlMaps);
    expect(store.setTileContent).toHaveBeenCalledWith("tile-1", content);
    expect(store.patchTileContent).toHaveBeenCalledWith("tile-1", patch);
    expect(store.autosaveTileContent).toHaveBeenCalledWith(
      "tile-1",
      patch,
    );
    expect(store.patchDocumentItem).toHaveBeenCalledWith(
      "tile-2",
      "item-1",
      itemPatch,
    );
    expect(store.updateCaption).toHaveBeenCalledWith({
      tileId: "tile-1",
      caption: "Caption",
    });
    expect(store.removeTile).toHaveBeenCalledWith("tile-1");
    expect(duplicateId).toBe("tile-copy");
    expect(store.duplicateTile).toHaveBeenCalledWith("tile-1");
    expect(store.resizeTile).toHaveBeenCalledWith("tile-1", 4, 5);
    expect(store.toggleTileBorder).toHaveBeenCalledWith("tile-1");
    expect(store.toggleLinkBackground).toHaveBeenCalledWith("tile-1");
    expect(store.setPanelActive).toHaveBeenCalledWith(
      "tile-1",
      "settings",
    );
    expect(store.toggleMenuActive).toHaveBeenCalledWith("tile-1");
    expect(store.togglePanelActive).toHaveBeenCalledWith(
      "tile-1",
      "settings",
    );
    expect(store.closeMenus).toHaveBeenCalledTimes(1);
    expect(cookieValue).toBe("cookie-value");
    expect(store.getCookieValue).toHaveBeenCalledWith("showMetaData");
  });
});
