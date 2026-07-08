import { describe, expect, it } from "vitest";
import {
  ContentType,
  type DocumentsContent,
  type Grid,
  type ImageContent,
  type TextContent,
  type Tile,
} from "@grids/contracts/types";
import { GridSnapshotCodec } from "../GridSnapshotCodec";
import type { Snapshot } from "../UndoTypes";

function textTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "text",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    borderEnabled: true,
    caption: "Caption",
    content: {
      type: ContentType.TEXT,
      text: "Hello",
      font: "Inter",
      fontSize: 16,
      isBold: false,
      isItalic: false,
      textType: "paragraph",
      color: "#000000",
    } as TextContent,
    ...overrides,
  };
}

function grid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    verticalCompact: false,
    themeId: "theme-a",
    backgroundImageSrc: "background",
    backgroundEmbed: true,
    backgroundColor: "#123456",
    ogImageSrc: "https://cdn/og.png",
    tiles: [textTile()],
    overrides: {
      md: {
        text: { x: 1, y: 2, w: 3, h: 4 },
      },
    },
    ...overrides,
  };
}

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    tiles: [textTile()],
    overrides: {},
    verticalCompact: true,
    themeId: "theme-b",
    backgroundImageSrc: "restored-background",
    backgroundEmbed: false,
    backgroundColor: "#abcdef",
    ogImageSrc: "https://cdn/restored-og.png",
    forcedBreakpoint: "sm",
    actionLabel: "Restore",
    ...overrides,
  };
}

describe("GridSnapshotCodec", () => {
  const codec = new GridSnapshotCodec();

  it("captures every undoable grid field and breakpoint context", () => {
    expect(
      codec.capture({
        grid: grid(),
        breakpoint: "md",
        actionLabel: "Before change",
      }),
    ).toEqual({
      tiles: [textTile()],
      overrides: {
        md: {
          text: { x: 1, y: 2, w: 3, h: 4 },
        },
      },
      verticalCompact: false,
      themeId: "theme-a",
      backgroundImageSrc: "background",
      backgroundEmbed: true,
      backgroundColor: "#123456",
      ogImageSrc: "https://cdn/og.png",
      forcedBreakpoint: "md",
      actionLabel: "Before change",
    });
  });

  it("normalizes optional undoable strings when capturing", () => {
    const source = grid({
      themeId: undefined,
      backgroundColor: undefined,
      ogImageSrc: undefined,
      overrides: undefined,
    });

    expect(
      codec.capture({
        grid: source,
        breakpoint: "lg",
        actionLabel: "Defaults",
      }),
    ).toEqual(
      expect.objectContaining({
        overrides: {},
        themeId: "",
        backgroundColor: "",
        ogImageSrc: "",
      }),
    );
  });

  it("captures resolved media and document URLs without mutating the grid", () => {
    const source = grid({
      tiles: [
        textTile({
          i: "media",
          content: {
            type: ContentType.IMAGE,
            src: "blob:media",
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          } as ImageContent,
        }),
        textTile({
          i: "documents",
          content: {
            type: ContentType.DOCUMENT,
            items: [
              { id: "resolved", fileName: "one.pdf", url: "blob:one" },
              { id: "pending", fileName: "two.pdf", url: "blob:two" },
            ],
          } as DocumentsContent,
        }),
      ],
    });

    const captured = codec.capture({
      grid: source,
      breakpoint: "lg",
      actionLabel: "Uploads",
      resolvedUrls: { media: "https://cdn/media" },
      resolvedDocumentItemUrls: {
        documents: { resolved: "https://cdn/one" },
      },
    });

    expect((captured.tiles[0]!.content as ImageContent).src).toBe(
      "https://cdn/media",
    );
    expect(
      (captured.tiles[1]!.content as DocumentsContent).items,
    ).toEqual([
      { id: "resolved", fileName: "one.pdf", url: "https://cdn/one" },
      { id: "pending", fileName: "two.pdf", url: "blob:two" },
    ]);
    expect((source.tiles[0]!.content as ImageContent).src).toBe("blob:media");
    expect(
      (source.tiles[1]!.content as DocumentsContent).items[0]!.url,
    ).toBe("blob:one");
  });

  it("captures resolved URLs for tiles duplicated from a shared blob URL", () => {
    const source = grid({
      tiles: [
        textTile({
          i: "media",
          content: {
            type: ContentType.IMAGE,
            src: "blob:media",
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          } as ImageContent,
        }),
        textTile({
          i: "media-copy",
          content: {
            type: ContentType.IMAGE,
            src: "blob:media",
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          } as ImageContent,
        }),
        textTile({
          i: "documents",
          content: {
            type: ContentType.DOCUMENT,
            items: [{ id: "one", fileName: "one.pdf", url: "blob:one" }],
          } as DocumentsContent,
        }),
        textTile({
          i: "documents-copy",
          content: {
            type: ContentType.DOCUMENT,
            items: [{ id: "one", fileName: "one.pdf", url: "blob:one" }],
          } as DocumentsContent,
        }),
      ],
    });

    const captured = codec.capture({
      grid: source,
      breakpoint: "lg",
      actionLabel: "Uploads",
      resolvedUrls: { media: "https://cdn/media" },
      resolvedDocumentItemUrls: { documents: { one: "https://cdn/one" } },
    });

    expect((captured.tiles[1]!.content as ImageContent).src).toBe(
      "https://cdn/media",
    );
    expect(
      (captured.tiles[3]!.content as DocumentsContent).items[0]!.url,
    ).toBe("https://cdn/one");
  });

  it("does not share captured tile or override references with the grid", () => {
    const source = grid();
    const captured = codec.capture({
      grid: source,
      breakpoint: "lg",
      actionLabel: "Copy",
    });

    captured.tiles[0]!.caption = "Snapshot only";
    captured.overrides.md!.text.x = 7;

    expect(source.tiles[0]!.caption).toBe("Caption");
    expect(source.overrides?.md?.text.x).toBe(1);
  });

  it("applies every undoable field including the OG image", () => {
    const target = grid();
    const restored = snapshot();

    codec.apply(target, restored);

    expect(target).toEqual(
      expect.objectContaining({
        tiles: restored.tiles,
        overrides: restored.overrides,
        verticalCompact: true,
        themeId: "theme-b",
        backgroundImageSrc: "restored-background",
        backgroundEmbed: false,
        backgroundColor: "#abcdef",
        ogImageSrc: "https://cdn/restored-og.png",
      }),
    );
  });

  it("does not share applied tile or override references with the snapshot", () => {
    const target = grid();
    const restored = snapshot({
      overrides: {
        sm: {
          text: { x: 0, y: 3, w: 4, h: 2 },
        },
      },
    });

    codec.apply(target, restored);
    target.tiles[0]!.caption = "Grid only";
    target.overrides!.sm!.text.x = 2;

    expect(restored.tiles[0]!.caption).toBe("Caption");
    expect(restored.overrides.sm!.text.x).toBe(0);
  });

  it("compares snapshot data while ignoring action labels", () => {
    expect(
      codec.equals(
        snapshot({ actionLabel: "First label" }),
        snapshot({ actionLabel: "Second label" }),
      ),
    ).toBe(true);
    expect(
      codec.equals(
        snapshot(),
        snapshot({ ogImageSrc: "https://cdn/different.png" }),
      ),
    ).toBe(false);
  });

  it("clones snapshots deeply", () => {
    const original = snapshot();
    const cloned = codec.clone(original);

    cloned.tiles[0]!.caption = "Clone only";

    expect(cloned).toEqual(expect.objectContaining({ actionLabel: "Restore" }));
    expect(original.tiles[0]!.caption).toBe("Caption");
  });

  it("replaces only matching blob media URLs", () => {
    const target = snapshot({
      tiles: [
        textTile({
          i: "media",
          content: {
            type: ContentType.IMAGE,
            src: "blob:media",
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          } as ImageContent,
        }),
      ],
    });

    codec.replaceBlobUrl(target, "media", "https://cdn/media");
    codec.replaceBlobUrl(target, "missing", "https://cdn/missing");

    expect((target.tiles[0]!.content as ImageContent).src).toBe(
      "https://cdn/media",
    );
  });

  it("replaces only the matching blob document item URL", () => {
    const target = snapshot({
      tiles: [
        textTile({
          i: "documents",
          content: {
            type: ContentType.DOCUMENT,
            items: [
              { id: "one", fileName: "one.pdf", url: "blob:one" },
              {
                id: "two",
                fileName: "two.pdf",
                url: "https://cdn/two",
              },
            ],
          } as DocumentsContent,
        }),
      ],
    });

    codec.replaceBlobUrl(
      target,
      "documents",
      "https://cdn/one",
      "one",
    );
    codec.replaceBlobUrl(
      target,
      "documents",
      "https://cdn/replacement",
      "two",
    );

    expect(
      (target.tiles[0]!.content as DocumentsContent).items,
    ).toEqual([
      { id: "one", fileName: "one.pdf", url: "https://cdn/one" },
      { id: "two", fileName: "two.pdf", url: "https://cdn/two" },
    ]);
  });

  it("safely ignores null snapshots and incompatible content", () => {
    const target = snapshot();

    expect(() => {
      codec.replaceBlobUrl(null, "text", "https://cdn/media");
      codec.replaceBlobUrl(
        target,
        "text",
        "https://cdn/document",
        "item",
      );
    }).not.toThrow();
    expect(target.tiles[0]).toEqual(textTile());
  });
});
