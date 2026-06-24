import { describe, expect, it, vi } from "vitest";
import { isReadonly, reactive } from "vue";
import type {
  AnyTileContent,
  Breakpoint,
  DocumentItem,
  Grid,
} from "@grids/contracts/types";
import type { GridHistoryUrlMaps } from "@/controllers/GridController";
import { createLiveGridViewContext } from "@/grid-view/createLiveGridViewContext";
import type { GridLayoutItem } from "@/types/GridLayout";

// Holders so each test can install fresh reactive store stand-ins and a fresh
// controller spy before constructing the context.
const h = vi.hoisted(() => ({
  session: null as unknown,
  viewport: null as unknown,
  ui: null as unknown,
  uploads: null as unknown,
  collection: null as unknown,
  controller: null as unknown,
}));

vi.mock("@/stores/grid/gridSession", () => ({
  useGridSessionStore: () => h.session,
}));
vi.mock("@/stores/grid/gridViewport", () => ({
  useGridViewportStore: () => h.viewport,
}));
vi.mock("@/stores/grid/gridUi", () => ({
  useGridUiStore: () => h.ui,
}));
vi.mock("@/stores/grid/gridUploads", () => ({
  useGridUploadsStore: () => h.uploads,
}));
vi.mock("@/stores/grid/gridCollection", () => ({
  useGridCollectionStore: () => h.collection,
}));
vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => h.controller,
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

const rank = (bp: Breakpoint): number =>
  bp === "sm" ? 0 : bp === "md" ? 1 : 2;

function installStores() {
  const session = reactive({
    currentGrid: makeGrid("grid-1") as Grid | null,
    isOwner: true,
    isLoading: false,
    verticalCompact: true,
    canEditAtBreakpoint(
      forced: Breakpoint | null,
      viewport: Breakpoint,
    ): boolean {
      if (!session.isOwner) return false;
      if (!forced) return true;
      return rank(forced) <= rank(viewport);
    },
  });
  const viewport = reactive({
    activeBreakpoint: "lg" as Breakpoint,
    viewportBreakpoint: "lg" as Breakpoint,
    forcedBreakpoint: null as Breakpoint | null,
    displayPositions: [
      { i: "tile-1", x: 0, y: 0, w: 2, h: 2 },
    ] as GridLayoutItem[],
  });
  const ui = reactive({
    showMetaData: true,
    showMetaDataVerbose: false,
    activeTileId: "tile-1" as string | null,
    activePanelId: "settings" as string | null,
    pendingFocusTileId: null as string | null,
    setPendingFocusTileId(tileId: string | null) {
      ui.pendingFocusTileId = tileId;
    },
  });
  const uploads = reactive({
    uploadingTiles: { "tile-1": 0.25 } as Record<string, number>,
  });
  const collection = reactive({ isLoading: false });

  h.session = session;
  h.viewport = viewport;
  h.ui = ui;
  h.uploads = uploads;
  h.collection = collection;

  return { session, viewport, ui, uploads, collection };
}

function installController() {
  const controller = {
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
  };
  h.controller = controller;
  return controller;
}

describe("createLiveGridViewContext", () => {
  it("maps read state from the focused stores", () => {
    const { session, viewport, ui } = installStores();
    installController();

    const ctx = createLiveGridViewContext();

    expect(ctx.mode).toBe("live");
    // Grid is exposed deeply readonly so components cannot mutate canonical state.
    expect(ctx.grid.value?.id).toBe("grid-1");
    expect(isReadonly(ctx.grid.value)).toBe(true);
    expect(ctx.isOwner.value).toBe(true);
    expect(ctx.canEdit.value).toBe(true);
    expect(ctx.isLoading.value).toBe(false);
    expect(ctx.verticalCompact.value).toBe(true);
    expect(ctx.activeBreakpoint.value).toBe("lg");
    expect(ctx.viewportBreakpoint.value).toBe("lg");
    expect(ctx.forcedBreakpoint.value).toBeNull();
    expect(ctx.displayPositions.value).toBe(viewport.displayPositions);
    expect(ctx.showMetaData.value).toBe(true);
    expect(ctx.showMetaDataVerbose.value).toBe(false);
    expect(ctx.uploadingTiles.value).toEqual({ "tile-1": 0.25 });
    expect(ctx.activeTileId.value).toBe("tile-1");
    expect(ctx.activePanelId.value).toBe("settings");

    // Reads stay reactive against the underlying stores.
    session.currentGrid = makeGrid("grid-2");
    session.isOwner = false; // flips canEdit through canEditAtBreakpoint
    viewport.activeBreakpoint = "md";
    ui.pendingFocusTileId = "tile-2";

    expect(ctx.grid.value?.id).toBe("grid-2");
    expect(ctx.isOwner.value).toBe(false);
    expect(ctx.canEdit.value).toBe(false);
    expect(ctx.activeBreakpoint.value).toBe("md");
    expect(ctx.pendingFocusTileId.value).toBe("tile-2");

    // pendingFocusTileId is read-only; focus writes go through the command.
    ctx.setPendingFocusTileId("tile-3");
    expect(ui.pendingFocusTileId).toBe("tile-3");
  });

  it("derives canEdit as view-only when forced beyond the viewport", () => {
    const { viewport } = installStores();
    installController();

    const ctx = createLiveGridViewContext();
    expect(ctx.canEdit.value).toBe(true);

    viewport.forcedBreakpoint = "lg";
    viewport.viewportBreakpoint = "sm";
    expect(ctx.canEdit.value).toBe(false);
  });

  it("ORs collection and session loading for isLoading", () => {
    const { session, collection } = installStores();
    installController();

    const ctx = createLiveGridViewContext();
    expect(ctx.isLoading.value).toBe(false);

    collection.isLoading = true;
    expect(ctx.isLoading.value).toBe(true);

    collection.isLoading = false;
    session.isLoading = true;
    expect(ctx.isLoading.value).toBe(true);
  });

  it("forwards layout, edit, content, tile, and menu commands to the controller", () => {
    installStores();
    const controller = installController();
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

    expect(controller.registerLayoutReadinessAdapter).toHaveBeenCalledWith(
      adapter,
    );
    expect(typeof dispose).toBe("function");
    expect(controller.setActiveBreakpoint).toHaveBeenCalledWith("md");
    expect(controller.setViewportBreakpoint).toHaveBeenCalledWith("sm");
    expect(controller.setForcedBreakpoint).toHaveBeenCalledWith("md");
    expect(controller.setDisplayPositions).toHaveBeenCalledWith(positions);
    expect(controller.commitCompactedLayout).toHaveBeenCalledWith(positions);
    expect(controller.beginMove).toHaveBeenCalledWith(urlMaps);
    expect(controller.commitMove).toHaveBeenCalledWith(urlMaps);
    expect(controller.beginResize).toHaveBeenCalledWith(urlMaps);
    expect(controller.commitResize).toHaveBeenCalledWith(urlMaps);
    expect(controller.beginEditing).toHaveBeenCalledWith("tile-1", urlMaps);
    expect(controller.commitEditing).toHaveBeenCalledWith(urlMaps);
    expect(controller.setTileContent).toHaveBeenCalledWith("tile-1", content);
    expect(controller.patchTileContent).toHaveBeenCalledWith("tile-1", patch);
    expect(controller.autosaveTileContent).toHaveBeenCalledWith(
      "tile-1",
      patch,
    );
    expect(controller.patchDocumentItem).toHaveBeenCalledWith(
      "tile-2",
      "item-1",
      itemPatch,
    );
    expect(controller.updateCaption).toHaveBeenCalledWith({
      tileId: "tile-1",
      caption: "Caption",
    });
    expect(controller.removeTile).toHaveBeenCalledWith("tile-1");
    expect(duplicateId).toBe("tile-copy");
    expect(controller.duplicateTile).toHaveBeenCalledWith("tile-1");
    expect(controller.resizeTile).toHaveBeenCalledWith("tile-1", 4, 5);
    expect(controller.toggleTileBorder).toHaveBeenCalledWith("tile-1");
    expect(controller.toggleLinkBackground).toHaveBeenCalledWith("tile-1");
    expect(controller.setPanelActive).toHaveBeenCalledWith(
      "tile-1",
      "settings",
    );
    expect(controller.toggleMenuActive).toHaveBeenCalledWith("tile-1");
    expect(controller.togglePanelActive).toHaveBeenCalledWith(
      "tile-1",
      "settings",
    );
    expect(controller.closeMenus).toHaveBeenCalledTimes(1);
    expect(cookieValue).toBe("cookie-value");
    expect(controller.getCookieValue).toHaveBeenCalledWith("showMetaData");
  });
});
