import { ContentType } from "@grids/contracts/types";

/**
 * Normalize a typed tile link: trim, default to https, and reject anything
 * that still isn't a URL. Returns "" for invalid input so callers can tell the
 * user rather than saving garbage.
 */
export function normalizeTileLink(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return "";
  const normalized =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  try {
    new URL(normalized);
    return normalized;
  } catch {
    return "";
  }
}

/**
 * Tile types that carry a tile-wide link (`content.tileLink`). Link tiles are
 * themselves a link and embeds/media cards own their URL, so they don't.
 */
const TILE_LINK_TYPES: ReadonlySet<string> = new Set([
  ContentType.TEXT,
  ContentType.SMART_TEXT,
  ContentType.IMAGE,
  ContentType.VIDEO,
]);

export function supportsTileLink(type: ContentType | string): boolean {
  return TILE_LINK_TYPES.has(type);
}
