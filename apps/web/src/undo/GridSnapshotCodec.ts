import {
  ContentType,
  type Breakpoint,
  type DocumentsContent,
  type Grid,
} from "@grids/contracts/types";
import type { Snapshot } from "./UndoTypes";

export interface GridSnapshotCaptureInput {
  grid: Grid;
  breakpoint: Breakpoint;
  actionLabel: string;
  resolvedUrls?: Readonly<Record<string, string>>;
  resolvedDocumentItemUrls?: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
}

export class GridSnapshotCodec {
  capture({
    grid,
    breakpoint,
    actionLabel,
    resolvedUrls = {},
    resolvedDocumentItemUrls = {},
  }: GridSnapshotCaptureInput): Snapshot {
    const tiles = this.deepClone(grid.tiles);

    for (const tile of tiles) {
      if (
        "src" in tile.content &&
        typeof tile.content.src === "string" &&
        tile.content.src.startsWith("blob:")
      ) {
        const resolvedUrl = resolvedUrls[tile.i];
        if (resolvedUrl) tile.content.src = resolvedUrl;
      }

      if (tile.content.type !== ContentType.DOCUMENT) continue;

      const content = tile.content as DocumentsContent;
      const resolvedItems = resolvedDocumentItemUrls[tile.i];
      if (!resolvedItems) continue;

      for (const item of content.items ?? []) {
        if (
          typeof item.url === "string" &&
          item.url.startsWith("blob:") &&
          resolvedItems[item.id]
        ) {
          item.url = resolvedItems[item.id];
        }
      }
    }

    return {
      tiles,
      overrides: this.deepClone(grid.overrides ?? {}),
      verticalCompact: grid.verticalCompact,
      themeId: grid.themeId ?? "",
      backgroundImageSrc: grid.backgroundImageSrc,
      backgroundEmbed: grid.backgroundEmbed,
      backgroundColor: grid.backgroundColor ?? "",
      ogImageSrc: grid.ogImageSrc ?? "",
      forcedBreakpoint: breakpoint,
      actionLabel,
    };
  }

  apply(grid: Grid, snapshot: Snapshot): void {
    grid.tiles = this.deepClone(snapshot.tiles);
    grid.overrides = this.deepClone(snapshot.overrides);
    grid.verticalCompact = snapshot.verticalCompact;
    grid.themeId = snapshot.themeId;
    grid.backgroundImageSrc = snapshot.backgroundImageSrc;
    grid.backgroundEmbed = snapshot.backgroundEmbed;
    grid.backgroundColor = snapshot.backgroundColor;
    grid.ogImageSrc = snapshot.ogImageSrc;
  }

  clone(snapshot: Snapshot): Snapshot {
    return this.deepClone(snapshot);
  }

  equals(left: Snapshot, right: Snapshot): boolean {
    return JSON.stringify(this.data(left)) === JSON.stringify(this.data(right));
  }

  replaceBlobUrl(
    snapshot: Snapshot | null,
    tileId: string,
    permanentUrl: string,
    documentItemId?: string,
  ): void {
    if (!snapshot) return;

    const tile = snapshot.tiles.find((candidate) => candidate.i === tileId);
    if (!tile) return;

    if (documentItemId) {
      if (tile.content.type !== ContentType.DOCUMENT) return;

      const content = tile.content as DocumentsContent;
      const item = content.items?.find(
        (candidate) => candidate.id === documentItemId,
      );
      if (
        item &&
        typeof item.url === "string" &&
        item.url.startsWith("blob:")
      ) {
        item.url = permanentUrl;
      }
      return;
    }

    if (
      "src" in tile.content &&
      typeof tile.content.src === "string" &&
      tile.content.src.startsWith("blob:")
    ) {
      tile.content.src = permanentUrl;
    }
  }

  private data(snapshot: Snapshot): Omit<Snapshot, "actionLabel"> {
    return {
      tiles: snapshot.tiles,
      overrides: snapshot.overrides,
      verticalCompact: snapshot.verticalCompact,
      themeId: snapshot.themeId,
      backgroundImageSrc: snapshot.backgroundImageSrc,
      backgroundEmbed: snapshot.backgroundEmbed,
      backgroundColor: snapshot.backgroundColor,
      ogImageSrc: snapshot.ogImageSrc,
      forcedBreakpoint: snapshot.forcedBreakpoint,
    };
  }

  private deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
