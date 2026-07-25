import {
  AnalyticsEventType,
  ContentType,
  type Breakpoint,
  type Tile,
  type TileContent,
} from "@grids/contracts/types";
import {
  reflowTiles,
  type CellRect,
  type Tile as GriddleTile,
} from "@griddle/core";
import { getTileDefinition } from "@/registries/tileRegistry";
import type { GridLayoutItem } from "@/types/GridLayout";
import {
  findBestXAtRow,
  findFirstAvailableSpot,
  pushTilesForNewItem,
} from "@/utils/GridPlacementUtils";
import { breakpointToColumnCount } from "@/utils/GridLayoutUtils";
import { createTile } from "@/utils/TileUtils";
import {
  createPositionMap,
  getTileObjectUrls,
  syncPositionOnlyLayout,
} from "../GridControllerHelpers";
import type {
  GridControllerDependencies,
  GridControllerStores,
} from "../GridControllerTypes";

export class GridTileStructureController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
    private readonly getViewportGridY: () => number,
    private readonly pushUndoSnapshot: (actionLabel: string) => void,
    private readonly scheduleSave: () => void,
    private readonly refreshStableSnapshot: () => void,
    private readonly recordChatTileForCleanup: (
      gridId: string,
      tileId: string,
    ) => void,
  ) {}

  private placeNewTile(
    tiles: Tile[],
    columns: number,
    width: number,
    height: number,
  ): { x: number; y: number } {
    const viewportY = this.getViewportGridY();
    const position =
      viewportY > 0
        ? findBestXAtRow(
            tiles,
            columns,
            width,
            height,
            viewportY,
          )
        : findFirstAvailableSpot(tiles, columns, width, height);

    pushTilesForNewItem(
      tiles,
      position.x,
      position.y,
      width,
      height,
    );
    return position;
  }

  private normalizeCanonicalLayout(tiles: Tile[], columns: number): void {
    const packedById = new Map(
      reflowTiles(
        tiles.map((tile) => this.toGriddleTile(tile)),
        { cols: columns, strategy: "griddle-v1" },
      ).map((tile) => [tile.id, tile]),
    );

    for (const tile of tiles) {
      const position = packedById.get(tile.i);
      if (!position) continue;
      Object.assign(tile, {
        x: position.col,
        y: position.row,
        w: position.w,
        h: position.h,
      });
    }
  }

  private toGriddleTile(
    tile: Pick<Tile, "i" | "x" | "y" | "w" | "h">,
  ): GriddleTile {
    return {
      id: tile.i,
      col: tile.x,
      row: tile.y,
      w: tile.w,
      h: tile.h,
    };
  }

  addTile(content: TileContent): string | null {
    const grid = this.stores.session.currentGrid;
    if (!grid) return null;

    const definition = getTileDefinition(content.type);
    if (definition?.maxPerGrid) {
      const count = grid.tiles.filter(
        (tile) => tile.content.type === content.type,
      ).length;
      if (count >= definition.maxPerGrid) {
        this.stores.toast.addToast(
          `Only ${definition.maxPerGrid} ${definition.label ?? content.type} tile${definition.maxPerGrid > 1 ? "s" : ""} allowed per grid`,
          "error",
        );
        return null;
      }
    }

    const requestedWidth = definition?.defaultSize?.w ?? 2;
    const height = definition?.defaultSize?.h ?? 2;
    const columns = grid.colNum || 12;
    const width = Math.min(requestedWidth, columns);

    this.pushUndoSnapshot("Add tile");
    const position = this.placeNewTile(
      grid.tiles,
      columns,
      width,
      height,
    );

    const tile = createTile(
      content.type,
      this.dependencies.generateUuid(),
      position.x,
      position.y,
      width,
      height,
      content,
      "",
    );
    grid.tiles.push(tile);
    this.normalizeCanonicalLayout(grid.tiles, columns);
    this.scheduleSave();
    this.logTileEvent(
      AnalyticsEventType.TILE_ADDED,
      grid.id,
      content.type,
      tile.i,
    );
    return tile.i;
  }

  duplicateTile(id: string): string | null {
    const grid = this.stores.session.currentGrid;
    const source = grid?.tiles.find((tile) => tile.i === id);
    if (!grid || !source) return null;

    this.pushUndoSnapshot("Duplicate tile");
    const columns = grid.colNum || 12;
    const width = Math.min(source.w, columns);
    const height = source.h;
    const position = this.placeNewTile(
      grid.tiles,
      columns,
      width,
      height,
    );

    const newId = this.dependencies.generateUuid();
    const tile: Tile = {
      i: newId,
      x: position.x,
      y: position.y,
      w: width,
      h: height,
      borderEnabled: source.borderEnabled,
      caption: source.caption,
      content: JSON.parse(JSON.stringify(source.content)) as TileContent,
    };
    grid.tiles.push(tile);
    this.normalizeCanonicalLayout(grid.tiles, columns);

    const resolvedItems =
      this.stores.uploads.resolvedDocumentItemUrls[id];
    if (resolvedItems) {
      for (const [itemId, url] of Object.entries(resolvedItems)) {
        this.stores.uploads.setResolvedDocumentItemUrl(
          newId,
          itemId,
          url,
        );
      }
    }

    if (grid.overrides) {
      for (const overrideBreakpoint of Object.keys(
        grid.overrides,
      ) as Breakpoint[]) {
        const positions = grid.overrides[overrideBreakpoint];
        const sourcePosition = positions?.[id];
        if (!positions || !sourcePosition || overrideBreakpoint === "lg") {
          continue;
        }

        const breakpointColumns = breakpointToColumnCount(
          overrideBreakpoint,
          columns,
        );
        const breakpointTiles = grid.tiles.map((candidate) => {
          const projected = this.toGriddleTile(candidate);
          return candidate.i === newId
            ? {
                ...projected,
                w: sourcePosition.w,
                h: sourcePosition.h,
              }
            : projected;
        });
        const placements: Record<string, CellRect> = Object.fromEntries(
          Object.entries(positions)
            .filter(([tileId]) => tileId !== newId)
            .map(([tileId, position]) => [
              tileId,
              {
                col: position.x,
                row: position.y,
                w: position.w,
                h: position.h,
              },
            ]),
        );
        let projected: GriddleTile[];
        try {
          projected = reflowTiles(breakpointTiles, {
            cols: breakpointColumns,
            strategy: "griddle-v1",
            placements,
          });
        } catch {
          projected = reflowTiles(breakpointTiles, {
            cols: breakpointColumns,
            strategy: "griddle-v1",
          });
        }
        const duplicateLayout = projected.find(
          (candidate) => candidate.id === newId,
        );
        if (!duplicateLayout) continue;
        positions[newId] = {
          x: duplicateLayout.col,
          y: duplicateLayout.row,
          w: duplicateLayout.w,
          h: duplicateLayout.h,
        };
      }
    }

    this.scheduleSave();
    this.logTileEvent(
      AnalyticsEventType.TILE_ADDED,
      grid.id,
      tile.content.type,
      newId,
    );
    return newId;
  }

  removeTile(id: string, settledLayout?: GridLayoutItem[]): void {
    const grid = this.stores.session.currentGrid;
    if (!grid) return;

    this.pushUndoSnapshot("Remove tile");
    const tile = grid.tiles.find((candidate) => candidate.i === id);

    // Map each blob URL still shown by a *remaining* tile to that tile's id, so
    // shared optimistic uploads (e.g. a duplicate of an in-flight upload) are
    // reassigned to the survivor instead of being revoked/cancelled.
    const survivingBlobOwners: Record<string, string> = {};
    for (const candidate of grid.tiles) {
      if (candidate.i === id) continue;
      for (const url of getTileObjectUrls(candidate)) {
        survivingBlobOwners[url] ??= candidate.i;
      }
    }

    this.stores.uploads.clearTileState(
      id,
      tile ? getTileObjectUrls(tile) : [],
      survivingBlobOwners,
    );

    if (grid.overrides) {
      for (const breakpoint of Object.keys(
        grid.overrides,
      ) as Breakpoint[]) {
        const positions = grid.overrides[breakpoint];
        if (positions) delete positions[id];
      }
    }
    grid.tiles = grid.tiles.filter((candidate) => candidate.i !== id);

    if (settledLayout) {
      const breakpoint = this.stores.viewport.activeBreakpoint;
      if (breakpoint === "lg") {
        syncPositionOnlyLayout(grid, settledLayout);
      } else {
        grid.overrides ??= {};
        grid.overrides[breakpoint] = createPositionMap(settledLayout);
      }
    }

    if (tile) {
      // Defer chat message cleanup so an undo can restore the tile (and its
      // messages, which remain in Firestore) before the GC flush runs.
      if (tile.content.type === ContentType.CHAT) {
        this.recordChatTileForCleanup(grid.id, id);
      }
      this.logTileEvent(
        AnalyticsEventType.TILE_REMOVED,
        grid.id,
        tile.content.type,
        id,
      );
    }
    this.scheduleSave();
    this.refreshStableSnapshot();
  }

  resizeTile(id: string, width: number, height: number): void {
    const grid = this.stores.session.currentGrid;
    const tile = grid?.tiles.find((candidate) => candidate.i === id);
    if (!grid || !tile) return;

    const breakpoint = this.stores.viewport.activeBreakpoint;
    if (breakpoint === "lg") {
      const columns = grid.colNum || 12;
      tile.x = Math.min(Math.max(0, tile.x), columns - 1);
      tile.w = Math.min(Math.max(1, Math.floor(width)), columns - tile.x);
      tile.h = Math.max(1, Math.floor(height));
      const displayPosition =
        this.stores.viewport.displayPositions.find(
          (position) => position.i === id,
        );
      if (displayPosition) {
        displayPosition.w = tile.w;
        displayPosition.h = tile.h;
        displayPosition.x = tile.x;
      }
      this.scheduleSave();
      return;
    }

    const columns = breakpoint === "sm" ? 4 : 8;
    grid.overrides ??= {};
    grid.overrides[breakpoint] ??= createPositionMap(
      this.stores.viewport.displayPositions,
    );
    const positions = grid.overrides[breakpoint];
    if (!positions) return;
    const existing = positions[id];
    const clampedX = Math.min(
      Math.max(0, existing?.x ?? tile.x),
      columns - 1,
    );
    const clampedWidth = Math.min(
      Math.max(1, Math.floor(width)),
      columns - clampedX,
    );
    positions[id] = {
      x: clampedX,
      y: existing?.y ?? tile.y,
      w: clampedWidth,
      h: Math.max(1, Math.floor(height)),
    };
    this.scheduleSave();
  }

  private logTileEvent(
    eventType:
      | AnalyticsEventType.TILE_ADDED
      | AnalyticsEventType.TILE_REMOVED,
    gridId: string,
    tileType: ContentType,
    tileId: string,
  ): void {
    if (tileType === ContentType.SUGGESTION) return;
    try {
      void this.dependencies
        .getAnalyticsService()
        .logEvent({
          eventType,
          userId:
            this.dependencies.getAuthProvider().getCurrentUserId(),
          gridId,
          metadata: { tileType, tileId },
        })
        .catch(() => undefined);
    } catch {
      // Analytics must never make a grid mutation fail.
    }
  }
}
