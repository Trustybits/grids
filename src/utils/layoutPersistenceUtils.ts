/**
 * Strip blob: URLs from layout tiles before persisting (safety net).
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
