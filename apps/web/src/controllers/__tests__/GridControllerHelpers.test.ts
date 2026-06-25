import { describe, expect, it } from "vitest";
import {
  ContentType,
  type DocumentsContent,
  type Grid,
  type ImageContent,
  type Tile,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import {
  createPositionMap,
  getTileObjectUrls,
  hasRecordChanges,
  syncPositionOnlyLayout,
} from "../GridControllerHelpers";

/**
 * Unit tests for the pure helper functions backing the grid controllers.
 *
 * Covers: change detection (hasRecordChanges), layout → position-map
 * projection (createPositionMap), in-place position syncing
 * (syncPositionOnlyLayout), and blob-url extraction from tile content
 * (getTileObjectUrls).
 */

function tile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    content: {
      type: ContentType.IMAGE,
      src: "blob:media",
    } as ImageContent,
    ...overrides,
  };
}

describe("hasRecordChanges", () => {
  it("returns true when a patched key differs from current", () => {
    expect(hasRecordChanges({ a: 1, b: 2 }, { b: 3 })).toBe(true);
  });

  it("returns false when every patched key already matches", () => {
    expect(hasRecordChanges({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(false);
  });

  it("returns false for an empty patch regardless of current", () => {
    expect(hasRecordChanges({ a: 1 }, {})).toBe(false);
  });

  it("an undefined patch value matching an absent current key is not a change; a defined value is", () => {
    expect(hasRecordChanges({}, { a: undefined })).toBe(false);
    expect(hasRecordChanges({}, { a: 1 })).toBe(true);
  });

  it("uses Object.is semantics for NaN (no spurious change) and signed zero", () => {
    expect(hasRecordChanges({ a: NaN }, { a: NaN })).toBe(false);
    expect(hasRecordChanges({ a: 0 }, { a: -0 })).toBe(true);
  });

  it("compares object references by identity, not deep equality", () => {
    const shared = { nested: true };
    expect(hasRecordChanges({ a: shared }, { a: shared })).toBe(false);
    expect(
      hasRecordChanges({ a: { nested: true } }, { a: { nested: true } }),
    ).toBe(true);
  });
});

describe("createPositionMap", () => {
  it("maps each layout item to its position keyed by id", () => {
    const layout: GridLayoutItem[] = [
      { i: "a", x: 1, y: 2, w: 3, h: 4 },
      { i: "b", x: 5, y: 6, w: 7, h: 8 },
    ];
    expect(createPositionMap(layout)).toEqual({
      a: { x: 1, y: 2, w: 3, h: 4 },
      b: { x: 5, y: 6, w: 7, h: 8 },
    });
  });

  it("returns an empty map for an empty layout", () => {
    expect(createPositionMap([])).toEqual({});
  });

  it("keeps only x/y/w/h and drops any extra layout properties", () => {
    const layout = [
      { i: "a", x: 1, y: 2, w: 3, h: 4, moved: true, static: false },
    ] as unknown as GridLayoutItem[];
    expect(createPositionMap(layout).a).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    expect(createPositionMap(layout).a).not.toHaveProperty("moved");
  });

  it("lets a later item win when ids collide", () => {
    const layout: GridLayoutItem[] = [
      { i: "a", x: 0, y: 0, w: 1, h: 1 },
      { i: "a", x: 9, y: 9, w: 9, h: 9 },
    ];
    expect(createPositionMap(layout).a).toEqual({ x: 9, y: 9, w: 9, h: 9 });
  });
});

describe("syncPositionOnlyLayout", () => {
  it("writes x/y/w/h from the layout onto matching tiles in place", () => {
    const grid = {
      tiles: [tile({ i: "a" }), tile({ i: "b" })],
    } as unknown as Grid;
    const layout: GridLayoutItem[] = [
      { i: "a", x: 1, y: 2, w: 3, h: 4 },
      { i: "b", x: 5, y: 6, w: 7, h: 8 },
    ];

    syncPositionOnlyLayout(grid, layout);

    expect(grid.tiles[0]).toMatchObject({ i: "a", x: 1, y: 2, w: 3, h: 4 });
    expect(grid.tiles[1]).toMatchObject({ i: "b", x: 5, y: 6, w: 7, h: 8 });
  });

  it("ignores layout entries that have no matching tile", () => {
    const grid = { tiles: [tile({ i: "a" })] } as unknown as Grid;

    expect(() =>
      syncPositionOnlyLayout(grid, [
        { i: "ghost", x: 1, y: 1, w: 1, h: 1 },
      ]),
    ).not.toThrow();
    expect(grid.tiles[0]).toMatchObject({ x: 0, y: 0, w: 2, h: 2 });
  });

  it("leaves tiles absent from the layout untouched", () => {
    const grid = {
      tiles: [tile({ i: "a", x: 0 }), tile({ i: "b", x: 0 })],
    } as unknown as Grid;

    syncPositionOnlyLayout(grid, [{ i: "a", x: 9, y: 9, w: 9, h: 9 }]);

    expect(grid.tiles[1]).toMatchObject({ x: 0, y: 0, w: 2, h: 2 });
  });
});

describe("getTileObjectUrls", () => {
  it("returns the blob src of media content", () => {
    expect(getTileObjectUrls(tile({}))).toEqual(["blob:media"]);
  });

  it("ignores a non-blob src", () => {
    const t = tile({
      content: {
        type: ContentType.IMAGE,
        src: "https://cdn/media",
      } as ImageContent,
    });
    expect(getTileObjectUrls(t)).toEqual([]);
  });

  it("ignores content without a string src", () => {
    const t = tile({
      content: { type: ContentType.TEXT } as unknown as Tile["content"],
    });
    expect(getTileObjectUrls(t)).toEqual([]);
  });

  it("collects blob urls from document items but not non-blob ones", () => {
    const t = tile({
      content: {
        type: ContentType.DOCUMENT,
        items: [
          { id: "1", fileName: "a", url: "blob:doc-1" },
          { id: "2", fileName: "b", url: "https://cdn/doc-2" },
          { id: "3", fileName: "c", url: "blob:doc-3" },
        ],
      } as DocumentsContent,
    });
    expect(getTileObjectUrls(t)).toEqual(["blob:doc-1", "blob:doc-3"]);
  });

  it("combines a blob src with blob document item urls", () => {
    const t = tile({
      content: {
        type: ContentType.DOCUMENT,
        src: "blob:media",
        items: [{ id: "1", fileName: "a", url: "blob:doc-1" }],
      } as unknown as DocumentsContent,
    });
    expect(getTileObjectUrls(t)).toEqual(["blob:media", "blob:doc-1"]);
  });

  it("does not inspect items for non-document content even if items exist", () => {
    const t = tile({
      content: {
        type: ContentType.IMAGE,
        src: "https://cdn/media",
        items: [{ id: "1", fileName: "a", url: "blob:doc-1" }],
      } as unknown as ImageContent,
    });
    expect(getTileObjectUrls(t)).toEqual([]);
  });

  it("tolerates a document tile with a missing items array", () => {
    const t = tile({
      content: {
        type: ContentType.DOCUMENT,
      } as unknown as DocumentsContent,
    });
    expect(getTileObjectUrls(t)).toEqual([]);
  });
});
