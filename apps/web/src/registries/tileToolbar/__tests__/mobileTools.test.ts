import { describe, expect, it } from "vitest";
import { ContentType, type Tile } from "@grids/contracts/types";
import { MIXED } from "@/utils/richText/docTransforms";
import {
  WRITERS,
  getMobileTools,
  getSharedMobileTools,
  readAcrossTiles,
  type MobileToolContext,
} from "../mobileTools";

const makeTile = (
  content: Record<string, unknown>,
  extra: Partial<Tile> = {},
): Tile =>
  ({
    i: `tile-${Math.random().toString(36).slice(2)}`,
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    content,
    ...extra,
  }) as Tile;

const ctx = (
  tile: Tile,
  extra: Partial<MobileToolContext> = {},
): MobileToolContext => ({ tile, unifiedText: true, ...extra });

const ids = (c: MobileToolContext) => getMobileTools(c).map((tool) => tool.id);

const textTile = (text = "") =>
  makeTile({ type: ContentType.TEXT, text, tileLink: "" });

describe("getMobileTools — per-tile toolbars (plan §5)", () => {
  it("text (unified)", () => {
    expect(ids(ctx(textTile("hi")))).toEqual([
      "font", "style", "color", "fill", "arrange", "position", "link",
      "border", "more", "duplicate", "delete",
    ]);
  });

  it("classic text has no Font/Style/Color here (its own controls)", () => {
    expect(ids(ctx(textTile("hi"), { unifiedText: false }))).toEqual([
      "fill", "arrange", "position", "link", "border", "more", "duplicate",
      "delete",
    ]);
  });

  it("image: Open only with a link, Download only when allowed", () => {
    const image = makeTile({ type: ContentType.IMAGE, src: "https://x/a.png" });
    expect(ids(ctx(image))).toEqual([
      "crop", "fill", "arrange", "link", "caption", "border", "duplicate",
      "delete",
    ]);
    const linked = makeTile({
      type: ContentType.IMAGE,
      src: "https://x/a.png",
      tileLink: "https://example.com",
    });
    expect(ids(ctx(linked, { canDownload: true }))).toEqual([
      "crop", "fill", "arrange", "link", "caption", "border", "download",
      "open", "duplicate", "delete",
    ]);
  });

  it("caption needs room: hidden on a 1-wide tile", () => {
    const narrow = makeTile({ type: ContentType.IMAGE, src: "a" }, { w: 1 });
    expect(ids(ctx(narrow))).not.toContain("caption");
  });

  it("link, embed, youtube, music", () => {
    expect(
      ids(
        ctx(
          makeTile({
            type: ContentType.LINK,
            link: "https://a.com",
            faviconUrl: "https://a.com/favicon.ico",
          }),
        ),
      ),
    ).toEqual([
      "edit", "image", "fill", "arrange", "open", "copy", "border", "more",
      "duplicate", "delete",
    ]);
    // More only holds Remove favicon on a link tile.
    expect(
      ids(ctx(makeTile({ type: ContentType.LINK, link: "https://a.com" }))),
    ).not.toContain("more");
    expect(
      ids(ctx(makeTile({ type: ContentType.EMBED, src: "https://a.com" }))),
    ).toEqual([
      "interact", "arrange", "open", "copy", "border", "duplicate", "delete",
    ]);
    expect(
      ids(
        ctx(
          makeTile({
            type: ContentType.YOUTUBE,
            youtubeUrl: "https://youtu.be/x",
          }),
        ),
      ),
    ).toEqual(["arrange", "open", "copy", "duplicate", "delete"]);
    expect(
      ids(
        ctx(makeTile({ type: ContentType.MUSIC, trackUrl: "https://a.com" })),
      ),
    ).toEqual(["arrange", "open", "copy", "duplicate", "delete"]);
  });

  it("documents, map, profile, chat", () => {
    expect(ids(ctx(makeTile({ type: ContentType.DOCUMENT })))).toEqual([
      "edit", "preview", "fill", "arrange", "border", "duplicate", "delete",
    ]);
    expect(
      ids(ctx(makeTile({ type: ContentType.MAP, style: "default" }, { w: 4 }))),
    ).toEqual([
      "pan", "search", "recenter", "mapStyle", "arrange", "caption",
      "duplicate", "delete",
    ]);
    expect(ids(ctx(makeTile({ type: ContentType.PROFILE })))).toEqual([
      "photo", "shape", "edit", "fill", "arrange", "border", "duplicate",
      "delete",
    ]);
    expect(ids(ctx(makeTile({ type: ContentType.CHAT, messages: [] })))).toEqual(
      ["arrange", "duplicate", "delete"],
    );
  });

  it("campfire can't be duplicated (one per grid)", () => {
    expect(ids(ctx(makeTile({ type: ContentType.CAMPFIRE })))).toEqual([
      "arrange", "border", "delete",
    ]);
  });

  it("dev-only and unknown tiles get just the basics; suggestions nothing", () => {
    expect(ids(ctx(makeTile({ type: ContentType.ROADMAP_FEED })))).toEqual([
      "arrange", "duplicate", "delete",
    ]);
    expect(ids(ctx(makeTile({ type: ContentType.SUGGESTION })))).toEqual([]);
  });

  it("always ends with Delete", () => {
    const tools = getMobileTools(ctx(textTile("hi")));
    expect(tools[tools.length - 1]?.id).toBe("delete");
    expect(tools[tools.length - 1]?.danger).toBe(true);
  });
});

describe("getSharedMobileTools — multi-edit", () => {
  it("keeps only tools every tile has that are safe in bulk", () => {
    const shared = getSharedMobileTools([
      ctx(textTile("hi")),
      ctx(makeTile({ type: ContentType.IMAGE, src: "a" })),
    ]).map((tool) => tool.id);
    // No Arrange (one tile at a time), no Crop/More (single-tile), no Open.
    expect(shared).toEqual(["fill", "link", "border", "duplicate", "delete"]);
  });

  it("offers text formatting when every tile is unified text", () => {
    const shared = getSharedMobileTools([
      ctx(textTile("a")),
      ctx(textTile("b")),
    ]).map((tool) => tool.id);
    expect(shared).toEqual([
      "font", "style", "color", "fill", "position", "link", "border",
      "duplicate", "delete",
    ]);
  });

  it("drops Duplicate when one tile can't be copied", () => {
    const shared = getSharedMobileTools([
      ctx(makeTile({ type: ContentType.CAMPFIRE })),
      ctx(makeTile({ type: ContentType.EMBED, src: "a" })),
    ]).map((tool) => tool.id);
    expect(shared).toEqual(["border", "delete"]);
  });

  it("is empty with nothing selected", () => {
    expect(getSharedMobileTools([])).toEqual([]);
  });
});

describe("writers", () => {
  it("border sets a value and skips no-op writes", () => {
    const on = makeTile({ type: ContentType.TEXT, text: "" });
    expect(WRITERS.border.read(on)).toBe(true);
    expect(WRITERS.border.patch(on, true)).toBeNull();
    expect(WRITERS.border.patch(on, false)).toEqual({ borderEnabled: false });
  });

  it("link normalizes, clears with empty, and rejects junk", () => {
    const tile = textTile("");
    expect(WRITERS.link.patch(tile, "example.com")).toEqual({
      content: { tileLink: "https://example.com" },
    });
    const linked = makeTile({ type: ContentType.TEXT, tileLink: "https://a.com" });
    expect(WRITERS.link.patch(linked, "  ")).toEqual({
      content: { tileLink: "" },
    });
    expect(WRITERS.link.patch(tile, "not a url at all ::")).toBeNull();
  });

  it("text formatting rewrites the stored doc", () => {
    const stored = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    });
    const tile = textTile(stored);
    expect(WRITERS.bold.read(tile)).toBe(false);
    const write = WRITERS.bold.patch(tile, true);
    const next = makeTile({
      type: ContentType.TEXT,
      text: (write!.content as { text: string }).text,
    });
    expect(WRITERS.bold.read(next)).toBe(true);
    // Nothing to format in an empty tile.
    expect(WRITERS.bold.patch(textTile(""), true)).toBeNull();
  });

  it("whole-tile alignment clears paragraph overrides", () => {
    const stored = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "right" },
          content: [{ type: "text", text: "a" }],
        },
      ],
    });
    const write = WRITERS.textAlign.patch(textTile(stored), "center");
    const content = write!.content as { textAlign: string; text: string };
    expect(content.textAlign).toBe("center");
    expect(JSON.parse(content.text).content[0].attrs.textAlign).toBeNull();
  });

  it("fill uses the type's legacy rules", () => {
    const image = makeTile({
      type: ContentType.IMAGE,
      backgroundColor: "var(--color-red)",
    });
    expect(WRITERS.fill.read(image)).toBe("");
    expect(WRITERS.overlay.read(image)).toBe("var(--color-red)");
  });

  it("readAcrossTiles agrees, or reports mixed", () => {
    const on = makeTile({ type: ContentType.TEXT });
    const off = makeTile({ type: ContentType.TEXT }, { borderEnabled: false });
    expect(readAcrossTiles(WRITERS.border, [on, on])).toBe(true);
    expect(readAcrossTiles(WRITERS.border, [on, off])).toBe(MIXED);
  });
});
