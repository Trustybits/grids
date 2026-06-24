import {
  ContentType,
  type DocumentsContent,
  type Grid,
  type Tile,
  type TilePosition,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";

export function hasRecordChanges(
  current: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>>,
): boolean {
  return Object.keys(patch).some(
    (key) => !Object.is(current[key], patch[key]),
  );
}

export function createPositionMap(
  layout: readonly GridLayoutItem[],
): Record<string, TilePosition> {
  return Object.fromEntries(
    layout.map((position) => [
      position.i,
      {
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
      },
    ]),
  );
}

export function syncPositionOnlyLayout(
  grid: Grid,
  layout: readonly GridLayoutItem[],
): void {
  for (const position of layout) {
    const tile = grid.tiles.find(
      (candidate) => candidate.i === position.i,
    );
    if (tile) {
      tile.x = position.x;
      tile.y = position.y;
      tile.w = position.w;
      tile.h = position.h;
    }
  }
}

export function getTileObjectUrls(tile: Tile): string[] {
  const urls: string[] = [];
  if (
    "src" in tile.content &&
    typeof tile.content.src === "string" &&
    tile.content.src.startsWith("blob:")
  ) {
    urls.push(tile.content.src);
  }
  if (tile.content.type !== ContentType.DOCUMENT) return urls;
  for (const item of (tile.content as DocumentsContent).items ?? []) {
    if (
      typeof item.url === "string" &&
      item.url.startsWith("blob:")
    ) {
      urls.push(item.url);
    }
  }
  return urls;
}
