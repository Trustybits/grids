import type { Breakpoint, Grid, Tile, TilePosition } from "@grids/contracts/types";

/**
 * Summary of how a draft differs from the published grid it shadows. Pure,
 * content-only: identity/metadata (id, rev, timestamps, draftOf/status) is
 * ignored, mirroring the fields publish writes back.
 */
export interface GridChangeSummary {
  tilesAdded: number;
  tilesRemoved: number;
  /** Tiles whose caption, border, or content changed (may also have moved). */
  tilesEdited: number;
  /** Tiles that only moved or resized, on any breakpoint. */
  tilesMoved: number;
  /** Human-readable labels of changed grid-level settings. */
  settingsChanged: string[];
}

const BREAKPOINTS: readonly Breakpoint[] = ["lg", "md", "sm"];

function tileMap(tiles: Tile[]): Map<string, Tile> {
  return new Map(tiles.map((tile) => [tile.i, tile]));
}

function samePosition(
  a: TilePosition | undefined,
  b: TilePosition | undefined,
): boolean {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function overrideFor(grid: Grid, bp: Breakpoint, tileId: string) {
  return grid.overrides?.[bp]?.[tileId];
}

function tileMoved(before: Tile, after: Tile, published: Grid, draft: Grid) {
  if (!samePosition(before, after)) return true;
  return BREAKPOINTS.some(
    (bp) =>
      !samePosition(
        overrideFor(published, bp, before.i),
        overrideFor(draft, bp, after.i),
      ),
  );
}

function tileEdited(before: Tile, after: Tile): boolean {
  return (
    before.caption !== after.caption ||
    (before.borderEnabled ?? false) !== (after.borderEnabled ?? false) ||
    JSON.stringify(before.content) !== JSON.stringify(after.content)
  );
}

function backgroundSignature(grid: Grid): string {
  return JSON.stringify([
    grid.backgroundImageSrc,
    grid.backgroundImageHash ?? "",
    grid.backgroundEmbed,
    grid.backgroundColor ?? "",
    grid.backgroundActiveSource ?? null,
  ]);
}

export function summarizeGridChanges(
  published: Grid,
  draft: Grid,
): GridChangeSummary {
  const before = tileMap(published.tiles);
  const after = tileMap(draft.tiles);

  let tilesAdded = 0;
  let tilesRemoved = 0;
  let tilesEdited = 0;
  let tilesMoved = 0;

  for (const [id, tile] of after) {
    const prior = before.get(id);
    if (!prior) {
      tilesAdded += 1;
    } else if (tileEdited(prior, tile)) {
      tilesEdited += 1;
    } else if (tileMoved(prior, tile, published, draft)) {
      tilesMoved += 1;
    }
  }
  for (const id of before.keys()) {
    if (!after.has(id)) tilesRemoved += 1;
  }

  const settingsChanged: string[] = [];
  if (published.name !== draft.name) settingsChanged.push("Name");
  if (backgroundSignature(published) !== backgroundSignature(draft)) {
    settingsChanged.push("Background");
  }
  if ((published.themeId ?? "") !== (draft.themeId ?? "")) {
    settingsChanged.push("Theme");
  }
  if (published.colNum !== draft.colNum) settingsChanged.push("Columns");
  if (published.verticalCompact !== draft.verticalCompact) {
    settingsChanged.push("Compact layout");
  }
  if ((published.ogImageSrc ?? "") !== (draft.ogImageSrc ?? "")) {
    settingsChanged.push("Share image");
  }
  if ((published.duplicatable ?? false) !== (draft.duplicatable ?? false)) {
    settingsChanged.push("Template setting");
  }

  return { tilesAdded, tilesRemoved, tilesEdited, tilesMoved, settingsChanged };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Short, display-ready lines for a change summary; empty when nothing changed. */
export function describeGridChanges(summary: GridChangeSummary): string[] {
  const lines: string[] = [];
  if (summary.tilesAdded) lines.push(`${plural(summary.tilesAdded, "tile")} added`);
  if (summary.tilesRemoved) {
    lines.push(`${plural(summary.tilesRemoved, "tile")} removed`);
  }
  if (summary.tilesEdited) {
    lines.push(`${plural(summary.tilesEdited, "tile")} edited`);
  }
  if (summary.tilesMoved) {
    lines.push(`${plural(summary.tilesMoved, "tile")} moved or resized`);
  }
  if (summary.settingsChanged.length) {
    lines.push(`${summary.settingsChanged.join(", ")} changed`);
  }
  return lines;
}
