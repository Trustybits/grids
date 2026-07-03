import { ContentType, type DocumentsContent, type Grid } from "@grids/contracts/types";

export type ResolvedMediaUrlMap = Record<string, string>;
export type ResolvedDocumentItemUrlMap = Record<string, Record<string, string>>;
export type ResolvedMediaHashMap = Record<string, string>;
export type ResolvedDocumentItemHashMap = Record<
  string,
  Record<string, string>
>;

/**
 * Deep-clone the active grid into a plain persistable snapshot, replacing any
 * known optimistic blob URLs with resolved storage URLs (and stamping their
 * archive hash), and stripping any unresolved blob URLs as a final safety net.
 *
 * The archive hash is the authoritative `users/{uid}/uploads/{hash}` key. It is
 * only stamped when the tile's persisted URL matches the resolved upload URL,
 * so a hash is never attached to a src the user has since changed.
 */
export function createPersistableGridSnapshot(
  grid: Grid,
  resolvedUrls: ResolvedMediaUrlMap = {},
  resolvedDocumentItemUrls: ResolvedDocumentItemUrlMap = {},
  resolvedHashes: ResolvedMediaHashMap = {},
  resolvedDocumentItemHashes: ResolvedDocumentItemHashMap = {},
): Grid {
  const snapshot = JSON.parse(JSON.stringify(grid)) as Grid;

  for (const tile of snapshot.tiles) {
    const content = tile.content as {
      src?: unknown;
      srcHash?: unknown;
      type?: unknown;
    };
    if (typeof content.src === "string" && content.src.startsWith("blob:")) {
      const resolved = resolvedUrls[tile.i];
      if (resolved) {
        content.src = resolved;
      }
    }

    const resolvedUrl = resolvedUrls[tile.i];
    const resolvedHash = resolvedHashes[tile.i];
    if (
      typeof content.src === "string" &&
      resolvedUrl &&
      content.src === resolvedUrl &&
      resolvedHash
    ) {
      content.srcHash = resolvedHash;
    }

    if (content.type === ContentType.DOCUMENT) {
      const documentContent = tile.content as DocumentsContent;
      if (!documentContent.items?.length) continue;

      const itemUrlMap = resolvedDocumentItemUrls[tile.i];
      const itemHashMap = resolvedDocumentItemHashes[tile.i];

      documentContent.items = documentContent.items.map((item) => {
        let next = item;
        const itemUrl = itemUrlMap?.[item.id];
        if (
          typeof next.url === "string" &&
          next.url.startsWith("blob:") &&
          itemUrl
        ) {
          next = { ...next, url: itemUrl };
        }

        const itemHash = itemHashMap?.[item.id];
        if (itemHash && itemUrl && next.url === itemUrl) {
          next = { ...next, hash: itemHash };
        }
        return next;
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
 * Keeps Firestore documents from storing ephemeral object URLs, and drops any
 * dangling archive hash whose URL was stripped.
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
      if ("srcHash" in contentOut) {
        contentOut = { ...contentOut, srcHash: "" };
      }
    }

    if (c.type === "document" && Array.isArray(c.items)) {
      const items = c.items.map((item) => {
        if (!item || typeof item !== "object") return item;
        const it = item as Record<string, unknown>;
        const url = it.url;
        if (typeof url === "string" && url.startsWith("blob:")) {
          const stripped: Record<string, unknown> = { ...it, url: "" };
          if ("hash" in stripped) stripped.hash = "";
          return stripped;
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
