/**
 * Tests for GridPersistenceUtils.ts
 *
 * Covers persistable snapshot creation and stripBlobUrlsFromTiles — the safety
 * net that blanks ephemeral `blob:` URLs before tiles are persisted.
 */

import { describe, it, expect } from "vitest";
import {
  ContentType,
  type DocumentsContent,
  type Grid,
  type ImageContent,
  type TextContent,
  type Tile,
} from "@grids/contracts/types";
import {
  createPersistableGridSnapshot,
  stripBlobUrlsFromTiles,
} from "../GridPersistenceUtils";

function makeTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    borderEnabled: true,
    caption: "",
    content: {
      type: ContentType.TEXT,
      text: "Hello",
    } as TextContent,
    ...overrides,
  } as Tile;
}

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Test Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    backgroundColor: "",
    ogImageSrc: "",
    themeId: "dark",
    duplicatable: false,
    tiles: [makeTile()],
    overrides: {},
    ...overrides,
  };
}

describe("createPersistableGridSnapshot", () => {
  it("returns a plain deep snapshot without retaining caller-owned references", () => {
    const source = makeGrid({
      tiles: [
        makeTile({
          content: {
            type: ContentType.TEXT,
            text: "Before",
            font: "Inter",
          } as TextContent,
        }),
      ],
      overrides: {
        md: {
          "tile-1": { x: 1, y: 2, w: 3, h: 4 },
        },
      },
    });

    const snapshot = createPersistableGridSnapshot(source);

    expect(snapshot).toEqual(source);
    expect(snapshot).not.toBe(source);
    expect(snapshot.tiles).not.toBe(source.tiles);
    expect(snapshot.tiles[0]).not.toBe(source.tiles[0]);
    expect(snapshot.tiles[0]?.content).not.toBe(source.tiles[0]?.content);
    expect(snapshot.overrides).not.toBe(source.overrides);

    snapshot.tiles[0]!.caption = "Snapshot only";
    (snapshot.tiles[0]!.content as TextContent).text = "Snapshot text";
    snapshot.overrides!.md!["tile-1"]!.x = 9;

    expect(source.tiles[0]?.caption).toBe("");
    expect((source.tiles[0]?.content as TextContent).text).toBe("Before");
    expect(source.overrides?.md?.["tile-1"]?.x).toBe(1);
  });

  it("replaces resolved media and document blob URLs", () => {
    const image = makeTile({
      i: "image",
      content: {
        type: ContentType.IMAGE,
        src: "blob:http://localhost/image",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as ImageContent,
    });
    const documents = makeTile({
      i: "documents",
      content: {
        type: ContentType.DOCUMENT,
        items: [
          { id: "one", fileName: "one.pdf", url: "blob:http://localhost/one" },
          { id: "two", fileName: "two.pdf", url: "https://cdn.example/two" },
        ],
      } as DocumentsContent,
    });

    const snapshot = createPersistableGridSnapshot(
      makeGrid({ tiles: [image, documents] }),
      { image: "https://cdn.example/image.png" },
      { documents: { one: "https://cdn.example/one.pdf" } },
    );

    expect((snapshot.tiles[0]?.content as ImageContent).src).toBe(
      "https://cdn.example/image.png",
    );
    expect((snapshot.tiles[1]?.content as DocumentsContent).items).toEqual([
      { id: "one", fileName: "one.pdf", url: "https://cdn.example/one.pdf" },
      { id: "two", fileName: "two.pdf", url: "https://cdn.example/two" },
    ]);
    expect((image.content as ImageContent).src).toBe(
      "blob:http://localhost/image",
    );
    expect((documents.content as DocumentsContent).items[0]?.url).toBe(
      "blob:http://localhost/one",
    );
  });

  it("strips unresolved media and document blob URLs from the snapshot", () => {
    const snapshot = createPersistableGridSnapshot(
      makeGrid({
        tiles: [
          makeTile({
            i: "image",
            content: {
              type: ContentType.IMAGE,
              src: "blob:http://localhost/image",
              zoom: 1,
              offsetX: 0,
              offsetY: 0,
            } as ImageContent,
          }),
          makeTile({
            i: "documents",
            content: {
              type: ContentType.DOCUMENT,
              items: [
                {
                  id: "one",
                  fileName: "one.pdf",
                  url: "blob:http://localhost/one",
                },
              ],
            } as DocumentsContent,
          }),
        ],
      }),
    );

    expect((snapshot.tiles[0]?.content as ImageContent).src).toBe("");
    expect((snapshot.tiles[1]?.content as DocumentsContent).items[0]?.url).toBe(
      "",
    );
  });
});

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
