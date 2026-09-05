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
export interface BlobResolution {
  url: string;
  hash?: string;
}

/**
 * Build reverse lookups from an optimistic `blob:` URL to its resolved storage
 * URL (and archive hash). Keyed off the source tiles that actually own a
 * resolved entry, this lets any tile duplicated from an in-flight upload — which
 * shares the source's blob URL but has no entry under its own id — be swapped to
 * the permanent URL on save (and in undo snapshots).
 */
export function buildBlobResolutionMaps(
  tiles: Grid["tiles"],
  resolvedUrls: ResolvedMediaUrlMap,
  resolvedDocumentItemUrls: ResolvedDocumentItemUrlMap,
  resolvedHashes: ResolvedMediaHashMap = {},
  resolvedDocumentItemHashes: ResolvedDocumentItemHashMap = {},
): {
  blobToResolved: Map<string, BlobResolution>;
  blobItemToResolved: Map<string, BlobResolution>;
} {
  const blobToResolved = new Map<string, BlobResolution>();
  const blobItemToResolved = new Map<string, BlobResolution>();

  for (const tile of tiles) {
    const content = tile.content as { src?: unknown; type?: unknown };

    const resolvedUrl = resolvedUrls[tile.i];
    if (
      resolvedUrl &&
      typeof content.src === "string" &&
      content.src.startsWith("blob:")
    ) {
      blobToResolved.set(content.src, {
        url: resolvedUrl,
        hash: resolvedHashes[tile.i],
      });
    }

    if (content.type !== ContentType.DOCUMENT) continue;
    const documentContent = tile.content as DocumentsContent;
    const itemUrlMap = resolvedDocumentItemUrls[tile.i];
    if (!itemUrlMap || !documentContent.items?.length) continue;
    const itemHashMap = resolvedDocumentItemHashes[tile.i];

    for (const item of documentContent.items) {
      const itemUrl = itemUrlMap[item.id];
      if (
        itemUrl &&
        typeof item.url === "string" &&
        item.url.startsWith("blob:")
      ) {
        blobItemToResolved.set(item.url, {
          url: itemUrl,
          hash: itemHashMap?.[item.id],
        });
      }
    }
  }

  return { blobToResolved, blobItemToResolved };
}

export function createPersistableGridSnapshot(
  grid: Grid,
  resolvedUrls: ResolvedMediaUrlMap = {},
  resolvedDocumentItemUrls: ResolvedDocumentItemUrlMap = {},
  resolvedHashes: ResolvedMediaHashMap = {},
  resolvedDocumentItemHashes: ResolvedDocumentItemHashMap = {},
): Grid {
  const snapshot = JSON.parse(JSON.stringify(grid)) as Grid;

  const { blobToResolved, blobItemToResolved } = buildBlobResolutionMaps(
    snapshot.tiles,
    resolvedUrls,
    resolvedDocumentItemUrls,
    resolvedHashes,
    resolvedDocumentItemHashes,
  );

  for (const tile of snapshot.tiles) {
    const content = tile.content as {
      src?: unknown;
      srcHash?: unknown;
      type?: unknown;
    };

    // Prefer a resolution keyed by this tile's own id, then fall back to one
    // keyed by the blob URL itself. Tiles duplicated from an in-flight upload
    // share the source's blob URL but have no resolved entry under their own
    // id, so the reverse map is what swaps them to the permanent URL.
    const blobSrc =
      typeof content.src === "string" && content.src.startsWith("blob:")
        ? content.src
        : undefined;
    const ownResolvedUrl = resolvedUrls[tile.i];
    const resolution = ownResolvedUrl
      ? { url: ownResolvedUrl, hash: resolvedHashes[tile.i] }
      : blobSrc
        ? blobToResolved.get(blobSrc)
        : undefined;

    if (blobSrc && resolution) {
      content.src = resolution.url;
    }

    if (
      typeof content.src === "string" &&
      resolution &&
      content.src === resolution.url &&
      resolution.hash
    ) {
      content.srcHash = resolution.hash;
    }

    if (content.type === ContentType.DOCUMENT) {
      const documentContent = tile.content as DocumentsContent;
      if (!documentContent.items?.length) continue;

      const itemUrlMap = resolvedDocumentItemUrls[tile.i];
      const itemHashMap = resolvedDocumentItemHashes[tile.i];

      documentContent.items = documentContent.items.map((item) => {
        let next = item;
        const blobItemUrl =
          typeof item.url === "string" && item.url.startsWith("blob:")
            ? item.url
            : undefined;
        const ownItemUrl = itemUrlMap?.[item.id];
        const itemResolution = ownItemUrl
          ? { url: ownItemUrl, hash: itemHashMap?.[item.id] }
          : blobItemUrl
            ? blobItemToResolved.get(blobItemUrl)
            : undefined;

        if (blobItemUrl && itemResolution) {
          next = { ...next, url: itemResolution.url };
        }

        if (
          itemResolution?.hash &&
          typeof next.url === "string" &&
          next.url === itemResolution.url
        ) {
          next = { ...next, hash: itemResolution.hash };
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

    // Profile tiles keep their avatar under a different key than media tiles.
    const profilePhotoUrl = c.profilePhotoUrl;
    if (
      typeof profilePhotoUrl === "string" &&
      profilePhotoUrl.startsWith("blob:")
    ) {
      contentOut = { ...contentOut, profilePhotoUrl: "" };
      if ("profilePhotoHash" in contentOut) {
        contentOut = { ...contentOut, profilePhotoHash: "" };
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
