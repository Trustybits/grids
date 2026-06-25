import { describe, expect, it, vi } from "vitest";
import { isReadonly } from "vue";
import type { AnyTileContent, Grid } from "@grids/contracts/types";
import { createDemoGridViewContext } from "@/grid-context/createDemoGridViewContext";
import type { GridLayoutItem } from "@/types/GridLayout";

function makeGrid(): Grid {
  return {
    id: "demo-grid",
    userId: "demo-user",
    name: "Demo",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [
      {
        i: "tile-1",
        x: 1,
        y: 2,
        w: 3,
        h: 4,
        caption: "Caption",
        content: { type: "text", text: "Original" } as AnyTileContent,
      },
      {
        i: "tile-2",
        x: 4,
        y: 2,
        w: 2,
        h: 2,
        caption: "",
        content: {
          type: "link",
          link: "https://example.com",
        } as AnyTileContent,
      },
    ],
    overrides: {
      md: {
        "tile-1": { x: 0, y: 0, w: 4, h: 4 },
      },
    },
  };
}

describe("createDemoGridViewContext", () => {
  it("exposes local read-only demo state", () => {
    const grid = makeGrid();
    const ctx = createDemoGridViewContext(grid);

    expect(ctx.mode).toBe("demo");
    // Demo grid is exposed deeply readonly, mirroring the live context.
    expect(ctx.grid.value).toEqual(grid);
    expect(isReadonly(ctx.grid.value)).toBe(true);
    expect(ctx.isOwner.value).toBe(false);
    expect(ctx.canEdit.value).toBe(false);
    expect(ctx.isLoading.value).toBe(false);
    expect(ctx.verticalCompact.value).toBe(true);
    expect(ctx.activeBreakpoint.value).toBe("lg");
    expect(ctx.viewportBreakpoint.value).toBe("lg");
    expect(ctx.forcedBreakpoint.value).toBeNull();
    expect(ctx.showMetaData.value).toBe(false);
    expect(ctx.showMetaDataVerbose.value).toBe(false);
    expect(ctx.uploadingTiles.value).toEqual({});
    expect(ctx.activeTileId.value).toBeNull();
    expect(ctx.activePanelId.value).toBeNull();
    expect(ctx.pendingFocusTileId.value).toBeNull();
    expect(ctx.displayPositions.value).toEqual([
      { i: "tile-1", x: 1, y: 2, w: 3, h: 4 },
      { i: "tile-2", x: 4, y: 2, w: 2, h: 2 },
    ]);
  });

  it("keeps breakpoint and rendered-layout state local", () => {
    const ctx = createDemoGridViewContext(makeGrid());
    const positions: GridLayoutItem[] = [
      { i: "tile-1", x: 0, y: 0, w: 4, h: 4 },
    ];

    ctx.setForcedBreakpoint("md");
    ctx.setActiveBreakpoint("md");
    ctx.setViewportBreakpoint("sm");
    ctx.setDisplayPositions(positions);
    positions[0]!.x = 7;
    ctx.setPendingFocusTileId("tile-1");

    expect(ctx.forcedBreakpoint.value).toBe("md");
    expect(ctx.activeBreakpoint.value).toBe("md");
    expect(ctx.viewportBreakpoint.value).toBe("sm");
    expect(ctx.displayPositions.value).toEqual([
      { i: "tile-1", x: 0, y: 0, w: 4, h: 4 },
    ]);
    expect(ctx.pendingFocusTileId.value).toBe("tile-1");

    ctx.setForcedBreakpoint(null);

    expect(ctx.forcedBreakpoint.value).toBeNull();
  });

  it("makes mutation, menu, cookie, and readiness commands no-ops", () => {
    const grid = makeGrid();
    const originalGrid = structuredClone(grid);
    const ctx = createDemoGridViewContext(grid);
    const adapter = { waitForLayoutReady: vi.fn(async () => undefined) };
    const dispose = ctx.registerLayoutReadinessAdapter(adapter);

    ctx.beginMove();
    ctx.commitMove();
    ctx.beginResize();
    ctx.commitResize();
    ctx.beginEditing("tile-1");
    ctx.commitEditing();
    ctx.setTileContent("tile-1", {
      type: "text",
      text: "Changed",
    } as AnyTileContent);
    ctx.patchTileContent("tile-1", { text: "Changed" } as Partial<
      AnyTileContent
    >);
    ctx.autosaveTileContent("tile-1", { text: "Changed" } as Partial<
      AnyTileContent
    >);
    ctx.patchDocumentItem("tile-1", "item-1", {
      fileName: "Changed.pdf",
    });
    ctx.updateCaption({ tileId: "tile-1", caption: "Changed" });
    ctx.removeTile("tile-1");
    ctx.resizeTile("tile-1", 1, 1);
    ctx.toggleTileBorder("tile-1");
    ctx.toggleLinkBackground("tile-2");
    ctx.setPanelActive("tile-1", "settings");
    ctx.toggleMenuActive("tile-1");
    ctx.togglePanelActive("tile-1", "settings");
    ctx.closeMenus();
    dispose();

    expect(ctx.duplicateTile("tile-1")).toBeNull();
    expect(ctx.getCookieValue("showMetaData")).toBeNull();
    expect(adapter.waitForLayoutReady).not.toHaveBeenCalled();
    expect(grid).toEqual(originalGrid);
    expect(ctx.activeTileId.value).toBeNull();
    expect(ctx.activePanelId.value).toBeNull();
  });
});
