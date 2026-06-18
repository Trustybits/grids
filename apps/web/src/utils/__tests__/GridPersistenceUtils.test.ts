/**
 * Tests for GridPersistenceUtils.ts
 *
 * Covers stripBlobUrlsFromTiles — a safety net that blanks ephemeral `blob:`
 * URLs (both top-level content.src and per-document-item urls) before tiles are
 * persisted, while leaving everything else untouched and not mutating inputs.
 */

import { describe, it, expect } from "vitest";
import { ContentType } from "@grids/contracts/types";
import { stripBlobUrlsFromTiles } from "../GridPersistenceUtils";

describe("stripBlobUrlsFromTiles", () => {
  it("clears blob src and document item urls", () => {
    const tiles = [
      {
        i: "1",
        content: {
          type: ContentType.IMAGE,
          src: "blob:http://x",
        },
      },
      {
        i: "2",
        content: {
          type: ContentType.DOCUMENT,
          items: [
            { id: "a", fileName: "f.pdf", url: "blob:http://y" },
            { id: "b", fileName: "g.pdf", url: "https://ok" },
          ],
        },
      },
    ];

    const out = stripBlobUrlsFromTiles(tiles) as typeof tiles;
    const c0 = out[0]?.content as { src?: string };
    const c1 = out[1]?.content as {
      items: Array<{ url: string }>;
    };
    expect(c0.src).toBe("");
    expect(c1.items[0]?.url).toBe("");
    expect(c1.items[1]?.url).toBe("https://ok");
  });

  it("returns an empty array unchanged for empty input", () => {
    expect(stripBlobUrlsFromTiles([])).toEqual([]);
  });

  // ── Non-blob content is preserved (and references reused) ──────────────────

  it("leaves a non-blob src untouched and returns the same tile reference", () => {
    const tile = {
      i: "1",
      content: { type: ContentType.IMAGE, src: "https://cdn/img.png" },
    };
    const out = stripBlobUrlsFromTiles([tile]);
    expect(out[0]).toBe(tile); // no clone when nothing changed
  });

  it("only blanks the blob: prefixed src, not other schemes", () => {
    const tile = {
      i: "1",
      content: { type: ContentType.IMAGE, src: "data:image/png;base64,AAAA" },
    };
    const out = stripBlobUrlsFromTiles([tile]);
    const content = out[0] as { content: { src?: string } };
    expect(content.content.src).toBe("data:image/png;base64,AAAA");
  });

  // ── Defensive guards for malformed entries ────────────────────────────────

  it("passes through non-object tiles unchanged", () => {
    const input = [null, "string", 42, undefined];
    expect(stripBlobUrlsFromTiles(input)).toEqual(input);
  });

  it("passes through a tile with no content", () => {
    const tile = { i: "1" };
    const out = stripBlobUrlsFromTiles([tile]);
    expect(out[0]).toBe(tile);
  });

  it("passes through a tile whose content is not an object", () => {
    const tile = { i: "1", content: "oops" };
    const out = stripBlobUrlsFromTiles([tile]);
    expect(out[0]).toBe(tile);
  });

  it("ignores a non-string src value", () => {
    const tile = { i: "1", content: { type: ContentType.IMAGE, src: 123 } };
    const out = stripBlobUrlsFromTiles([tile]);
    expect(out[0]).toBe(tile);
  });

  // ── Document items ────────────────────────────────────────────────────────

  it("does not process items when type is not 'document'", () => {
    const tile = {
      i: "1",
      content: {
        type: ContentType.IMAGE,
        items: [{ id: "a", fileName: "f.pdf", url: "blob:http://y" }],
      },
    };
    const out = stripBlobUrlsFromTiles([tile]);
    // Not a document, so items are left alone -> tile reference reused.
    expect(out[0]).toBe(tile);
  });

  it("leaves a document tile untouched when no item url is a blob", () => {
    const tile = {
      i: "1",
      content: {
        type: ContentType.DOCUMENT,
        items: [{ id: "a", fileName: "f.pdf", url: "https://ok" }],
      },
    };
    const out = stripBlobUrlsFromTiles([tile]);
    // contentOut is rebuilt for documents, so a new tile object is returned,
    // but the surviving url is preserved.
    const content = (out[0] as { content: { items: Array<{ url: string }> } })
      .content;
    expect(content.items[0].url).toBe("https://ok");
  });

  it("preserves non-object items inside a document's items array", () => {
    const tile = {
      i: "1",
      content: {
        type: ContentType.DOCUMENT,
        items: [null, { id: "a", fileName: "f.pdf", url: "blob:http://y" }],
      },
    };
    const out = stripBlobUrlsFromTiles([tile]) as Array<{
      content: { items: Array<unknown> };
    }>;
    const items = out[0].content.items;
    expect(items[0]).toBeNull();
    expect((items[1] as { url: string }).url).toBe("");
  });

  it("ignores a document item whose url is not a string", () => {
    const tile = {
      i: "1",
      content: {
        type: ContentType.DOCUMENT,
        items: [{ id: "a", fileName: "f.pdf", url: 999 }],
      },
    };
    const out = stripBlobUrlsFromTiles([tile]) as Array<{
      content: { items: Array<{ url: unknown }> };
    }>;
    expect(out[0].content.items[0].url).toBe(999);
  });

  // ── Immutability ──────────────────────────────────────────────────────────

  it("does not mutate the input tile when blanking a blob src", () => {
    const tile = {
      i: "1",
      content: { type: ContentType.IMAGE, src: "blob:http://x" },
    };
    const out = stripBlobUrlsFromTiles([tile]);
    // Original untouched, output is a fresh clone with the cleared src.
    expect(tile.content.src).toBe("blob:http://x");
    expect((out[0] as { content: { src?: string } }).content.src).toBe("");
    expect(out[0]).not.toBe(tile);
  });

  it("does not mutate the original document items array", () => {
    const tile = {
      i: "1",
      content: {
        type: ContentType.DOCUMENT,
        items: [{ id: "a", fileName: "f.pdf", url: "blob:http://y" }],
      },
    };
    stripBlobUrlsFromTiles([tile]);
    expect(tile.content.items[0].url).toBe("blob:http://y");
  });

  it("returns a new top-level array (map), not the original", () => {
    const tiles = [
      { i: "1", content: { type: ContentType.IMAGE, src: "blob:http://x" } },
    ];
    expect(stripBlobUrlsFromTiles(tiles)).not.toBe(tiles);
  });
});
