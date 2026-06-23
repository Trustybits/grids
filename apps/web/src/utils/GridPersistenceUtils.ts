import { ContentType, type DocumentsContent, type Grid } from "@grids/contracts/types";

export type ResolvedMediaUrlMap = Record<string, string>;
export type ResolvedDocumentItemUrlMap = Record<string, Record<string, string>>;

/**
 * Deep-clone the active grid into a plain persistable snapshot, replacing any
 * known optimistic blob URLs with resolved storage URLs and stripping any
 * unresolved blob URLs as a final safety net.
 */
export function createPersistableGridSnapshot(
  grid: Grid,
  resolvedUrls: ResolvedMediaUrlMap = {},
  resolvedDocumentItemUrls: ResolvedDocumentItemUrlMap = {},
): Grid {
  const snapshot = JSON.parse(JSON.stringify(grid)) as Grid;

  for (const tile of snapshot.tiles) {
    const content = tile.content as { src?: unknown; type?: unknown };
    if (typeof content.src === "string" && content.src.startsWith("blob:")) {
      const resolved = resolvedUrls[tile.i];
      if (resolved) {
        content.src = resolved;
      }
    }

    if (content.type === ContentType.DOCUMENT) {
      const documentContent = tile.content as DocumentsContent;
      const itemMap = resolvedDocumentItemUrls[tile.i];
      if (!itemMap || !documentContent.items?.length) continue;

      documentContent.items = documentContent.items.map((item) => {
        const resolved = itemMap[item.id];
        if (
          typeof item.url === "string" &&
          item.url.startsWith("blob:") &&
          resolved
        ) {
          return { ...item, url: resolved };
        }
        return item;
      });
    }
  }

  snapshot.tiles = stripBlobUrlsFromTiles(
    snapshot.tiles as unknown[],
  ) as Grid["tiles"];

  return snapshot;
}

/**
 * Strip blob: URLs from grid tiles before persisting (safety net).
 * Keeps Firestore documents from storing ephemeral object URLs.
 */
export function stripBlobUrlsFromTiles(tiles: unknown[]): unknown[] {
  return tiles.map((tile) => {
    if (!tile || typeof tile !== "object") return tile;
    const rec = tile as Record<string, unknown>;
    const content = rec.content;
    if (!content || typeof content !== "object") return tile;
    const c = content as Record<string, unknown>;

    let contentOut = c;
    const src = c.src;
    if (typeof src === "string" && src.startsWith("blob:")) {
      contentOut = { ...contentOut, src: "" };
    }

    if (c.type === "document" && Array.isArray(c.items)) {
      const items = c.items.map((item) => {
        if (!item || typeof item !== "object") return item;
        const it = item as Record<string, unknown>;
        const url = it.url;
        if (typeof url === "string" && url.startsWith("blob:")) {
          return { ...it, url: "" };
        }
        return item;
      });
      contentOut = { ...contentOut, items };
    }

    if (contentOut !== c) {
      return { ...rec, content: contentOut };
    }
    return tile;
  });
}
