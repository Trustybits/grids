/**
 * Tests for the tile definitions in src/registries/tiles/.
 *
 * Each tile definition is a plain data object whose interesting behavior lives
 * in pure functions: `defaultContent` (defaults + override merge), `validate`
 * (per-type business rules), `actions` (copy / download / external URL), and —
 * for media tiles — `matchUrl` / `parseUrl`.
 *
 * The image/video/embed tiles delegate to helpers in `@/utils/TileUtils`
 * (isDirectImageUrl, isDirectVideoUrl, normalizeEmbedSrc). Those helpers are
 * mocked so each tile is tested as an isolated unit: we assert the tile
 * delegates correctly, not that the helper itself is correct (covered by
 * TileUtils' own tests).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/TileUtils", () => ({
  isDirectImageUrl: vi.fn(),
  isDirectVideoUrl: vi.fn(),
  normalizeEmbedSrc: vi.fn(),
}));

import { ContentType } from "@grids/contracts/types";
import type {
  TextContent,
  SmartTextContent,
  LinkContent,
  ImageContent,
  VideoContent,
  EmbedContent,
  MapContent,
  YouTubeContent,
  MusicContent,
  DocumentsContent,
} from "@grids/contracts/types";

import { textDefinition } from "@/registries/tiles/text";
import { smartTextDefinition } from "@/registries/tiles/smartText";
import { chatDefinition } from "@/registries/tiles/chat";
import { linkDefinition } from "@/registries/tiles/link";
import { mapDefinition } from "@/registries/tiles/map";
import { campfireDefinition } from "@/registries/tiles/campfire";
import { suggestionDefinition } from "@/registries/tiles/suggestion";
import { profileDefinition } from "@/registries/tiles/profile";
import { youtubeDefinition } from "@/registries/tiles/youtube";
import { roadmapFeedDefinition } from "@/registries/tiles/roadmapFeed";
import { musicDefinition } from "@/registries/tiles/music";
import { documentDefinition } from "@/registries/tiles/document";

// The global setup file imports `@/registries/tiles` (and therefore image.ts /
// video.ts / embed.ts) *before* this file's vi.mock registers, so those modules
// captured the REAL TileUtils helpers. Reset the module registry and re-import
// them — together with the mocked helpers — so they share the same mocked
// instances and the delegation can be asserted.
vi.resetModules();
const { imageDefinition } = await import("@/registries/tiles/image");
const { videoDefinition } = await import("@/registries/tiles/video");
const { embedDefinition } = await import("@/registries/tiles/embed");
const { isDirectImageUrl, isDirectVideoUrl, normalizeEmbedSrc } = await import(
  "@/utils/TileUtils"
);

const mockedIsImage = vi.mocked(isDirectImageUrl);
const mockedIsVideo = vi.mocked(isDirectVideoUrl);
const mockedNormalize = vi.mocked(normalizeEmbedSrc);

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper to build a tiptap-style JSON doc string for text copyContent tests.
function tiptapDoc(...texts: string[]) {
  return JSON.stringify({
    type: "doc",
    content: texts.map((t) => ({ type: "paragraph", content: [{ text: t }] })),
  });
}

// ── text ────────────────────────────────────────────────────────────────────

describe("textDefinition", () => {
  it("has the expected identity metadata", () => {
    expect(textDefinition.type).toBe(ContentType.TEXT);
    expect(textDefinition.category).toBe("text");
    expect(textDefinition.editMode).toBe("richtext");
  });

  describe("defaultContent", () => {
    it("fills sensible defaults when no data is given", () => {
      expect(textDefinition.defaultContent()).toEqual({
        type: ContentType.TEXT,
        text: "",
        font: "Arial",
        fontSize: 14,
        isBold: false,
        isItalic: false,
        textType: "",
        color: "#ffffff",
        textAlign: undefined,
        verticalAlign: undefined,
        tileLink: undefined,
        backgroundColor: undefined,
      });
    });

    it("uses provided values over the defaults", () => {
      const c = textDefinition.defaultContent({
        text: "hi",
        font: "Georgia",
        fontSize: 22,
        isBold: true,
        isItalic: true,
        textType: "h1",
        color: "#000000",
        textAlign: "center",
        verticalAlign: "center",
        tileLink: "https://x.com",
        backgroundColor: "#111",
      });
      expect(c).toMatchObject({
        text: "hi",
        font: "Georgia",
        fontSize: 22,
        isBold: true,
        isItalic: true,
        textType: "h1",
        color: "#000000",
        textAlign: "center",
        verticalAlign: "center",
        tileLink: "https://x.com",
        backgroundColor: "#111",
      });
    });

    it("falls back to defaults for falsy fontSize (0)", () => {
      expect(textDefinition.defaultContent({ fontSize: 0 }).fontSize).toBe(14);
    });
  });

  describe("validate", () => {
    it("is valid when text contains non-whitespace", () => {
      expect(
        textDefinition.validate({ text: "hello" } as TextContent),
      ).toBe(true);
    });

    it("is invalid for empty or whitespace-only text", () => {
      expect(textDefinition.validate({ text: "" } as TextContent)).toBe(false);
      expect(textDefinition.validate({ text: "   " } as TextContent)).toBe(
        false,
      );
    });
  });

  describe("actions.copyContent", () => {
    it("returns null when text is empty", () => {
      expect(
        textDefinition.actions?.copyContent?.({ text: "" } as TextContent),
      ).toBeNull();
    });

    it("extracts plain text from a tiptap JSON doc", () => {
      const doc = tiptapDoc("Hello ", "world");
      expect(
        textDefinition.actions?.copyContent?.({ text: doc } as TextContent),
      ).toBe("Hello world");
    });

    it("returns the raw string when text is not valid JSON", () => {
      expect(
        textDefinition.actions?.copyContent?.({
          text: "just plain text",
        } as TextContent),
      ).toBe("just plain text");
    });

    it("nested tiptap content is flattened recursively", () => {
      const nested = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ text: "a" }, { content: [{ text: "b" }] }],
          },
        ],
      });
      expect(
        textDefinition.actions?.copyContent?.({ text: nested } as TextContent),
      ).toBe("ab");
    });

    // A plain string that happens to be valid JSON for a primitive (a bare
    // number, boolean, or a quoted string) parses successfully but is not a
    // tiptap doc. copyContent must return it verbatim rather than dropping it.
    it("returns a numeric string verbatim (not a tiptap doc)", () => {
      expect(
        textDefinition.actions?.copyContent?.({ text: "123" } as TextContent),
      ).toBe("123");
    });

    it("returns a JSON-quoted string verbatim (not a tiptap doc)", () => {
      expect(
        textDefinition.actions?.copyContent?.({
          text: '"hello"',
        } as TextContent),
      ).toBe('"hello"');
    });

    it("returns a boolean-looking string verbatim", () => {
      expect(
        textDefinition.actions?.copyContent?.({ text: "true" } as TextContent),
      ).toBe("true");
    });
  });

  describe("actions.externalUrl", () => {
    it("returns the tileLink when present, otherwise null", () => {
      expect(
        textDefinition.actions?.externalUrl?.({
          tileLink: "https://x.com",
        } as TextContent),
      ).toBe("https://x.com");
      expect(
        textDefinition.actions?.externalUrl?.({} as TextContent),
      ).toBeNull();
    });
  });
});

// ── smartText (mirrors text, with its own feature flag) ──────────────────────

describe("smartTextDefinition", () => {
  it("is gated behind the editor-smart-text feature flag", () => {
    expect(smartTextDefinition.type).toBe(ContentType.SMART_TEXT);
    expect(smartTextDefinition.featureFlag).toBe("editor-smart-text");
  });

  it("defaultContent mirrors the text tile defaults", () => {
    expect(smartTextDefinition.defaultContent()).toMatchObject({
      type: ContentType.SMART_TEXT,
      text: "",
      font: "Arial",
      fontSize: 14,
      color: "#ffffff",
    });
  });

  it("validate requires non-whitespace text", () => {
    expect(
      smartTextDefinition.validate({ text: "x" } as SmartTextContent),
    ).toBe(true);
    expect(
      smartTextDefinition.validate({ text: "  " } as SmartTextContent),
    ).toBe(false);
  });

  it("copyContent extracts text from a tiptap doc", () => {
    expect(
      smartTextDefinition.actions?.copyContent?.({
        text: tiptapDoc("abc"),
      } as SmartTextContent),
    ).toBe("abc");
  });

  it("copyContent returns the raw string for non-JSON text", () => {
    expect(
      smartTextDefinition.actions?.copyContent?.({
        text: "plain",
      } as SmartTextContent),
    ).toBe("plain");
  });

  // Shares text's copyContent logic: a primitive-JSON string is not a tiptap
  // doc and must be returned verbatim.
  it("copyContent returns a numeric string verbatim", () => {
    expect(
      smartTextDefinition.actions?.copyContent?.({
        text: "123",
      } as SmartTextContent),
    ).toBe("123");
  });
});

// ── chat ──────────────────────────────────────────────────────────────────────

describe("chatDefinition", () => {
  it("defaults messages to an empty array", () => {
    expect(chatDefinition.defaultContent()).toEqual({
      type: ContentType.CHAT,
      messages: [],
    });
  });

  it("preserves provided messages", () => {
    const messages = [{ id: "1" }] as never;
    expect(chatDefinition.defaultContent({ messages }).messages).toBe(messages);
  });

  it("is always valid", () => {
    expect(chatDefinition.validate({} as never)).toBe(true);
  });

  it("exposes the tile id via extraProps", () => {
    expect(chatDefinition.extraProps?.({ i: "chat-7" } as never)).toEqual({
      tileId: "chat-7",
    });
  });
});

// ── image ─────────────────────────────────────────────────────────────────────

describe("imageDefinition", () => {
  it("defaults to an empty src with reset crop transform", () => {
    expect(imageDefinition.defaultContent()).toEqual({
      type: ContentType.IMAGE,
      src: "",
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      backgroundColor: undefined,
      tileLink: undefined,
    });
  });

  it("uses the provided src and links but always resets zoom/offset", () => {
    const c = imageDefinition.defaultContent({
      src: "https://x.com/a.png",
      zoom: 5,
      offsetX: 10,
      offsetY: 20,
      tileLink: "https://link",
      backgroundColor: "#fff",
    } as Partial<ImageContent>);
    expect(c.src).toBe("https://x.com/a.png");
    expect(c.tileLink).toBe("https://link");
    expect(c.backgroundColor).toBe("#fff");
    // zoom/offset are hard-coded resets, NOT taken from data
    expect(c.zoom).toBe(1);
    expect(c.offsetX).toBe(0);
    expect(c.offsetY).toBe(0);
  });

  it.each([
    ["https://x.com/a.png", true],
    ["data:image/png;base64,xxx", true],
    ["blob:abc", true],
    ["ftp://x.com/a.png", false],
    ["", false],
  ])("validate(%s) => %s", (src, expected) => {
    expect(imageDefinition.validate({ src } as ImageContent)).toBe(expected);
  });

  it("downloadUrl returns the src or null", () => {
    expect(
      imageDefinition.actions?.downloadUrl?.({ src: "u" } as ImageContent),
    ).toBe("u");
    expect(
      imageDefinition.actions?.downloadUrl?.({ src: "" } as ImageContent),
    ).toBeNull();
  });

  it("externalUrl returns the tileLink or null", () => {
    expect(
      imageDefinition.actions?.externalUrl?.({
        tileLink: "t",
      } as ImageContent),
    ).toBe("t");
    expect(
      imageDefinition.actions?.externalUrl?.({} as ImageContent),
    ).toBeNull();
  });

  it("matchUrl delegates to isDirectImageUrl and returns its result", () => {
    mockedIsImage.mockReturnValue(true);
    expect(imageDefinition.matchUrl?.("https://x.com/a.png")).toBe(true);
    expect(mockedIsImage).toHaveBeenCalledWith("https://x.com/a.png");

    mockedIsImage.mockReturnValue(false);
    expect(imageDefinition.matchUrl?.("https://x.com/page")).toBe(false);
  });

  it("parseUrl wraps the URL into a src partial", () => {
    expect(imageDefinition.parseUrl?.("https://x.com/a.png")).toEqual({
      src: "https://x.com/a.png",
    });
  });
});

// ── video (mirrors image, delegates to isDirectVideoUrl) ─────────────────────

describe("videoDefinition", () => {
  it("defaults to an empty src with reset crop transform", () => {
    expect(videoDefinition.defaultContent()).toMatchObject({
      type: ContentType.VIDEO,
      src: "",
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it.each([
    ["https://x.com/a.mp4", true],
    ["data:video/mp4;base64,xxx", true],
    ["blob:abc", true],
    ["ftp://x.com/a.mp4", false],
    ["", false],
  ])("validate(%s) => %s", (src, expected) => {
    expect(videoDefinition.validate({ src } as VideoContent)).toBe(expected);
  });

  it("matchUrl delegates to isDirectVideoUrl", () => {
    mockedIsVideo.mockReturnValue(true);
    expect(videoDefinition.matchUrl?.("https://x.com/a.mp4")).toBe(true);
    expect(mockedIsVideo).toHaveBeenCalledWith("https://x.com/a.mp4");
  });

  it("parseUrl wraps the URL into a src partial", () => {
    expect(videoDefinition.parseUrl?.("u")).toEqual({ src: "u" });
  });
});

// ── link (real URL parsing in defaultContent) ────────────────────────────────

describe("linkDefinition", () => {
  describe("defaultContent URL handling", () => {
    it("prefixes a bare domain with https and derives domain + favicon", () => {
      const c = linkDefinition.defaultContent({ link: "example.com" });
      expect(c.link).toBe("https://example.com");
      expect(c.domain).toBe("example.com");
      expect(c.faviconUrl).toContain(
        "https://s2.googleusercontent.com/s2/favicons",
      );
      expect(c.faviconUrl).toContain("domain_url=https://example.com");
    });

    it("keeps an existing http(s) URL as-is", () => {
      const c = linkDefinition.defaultContent({
        link: "https://sub.example.com/path",
      });
      expect(c.link).toBe("https://sub.example.com/path");
      expect(c.domain).toBe("sub.example.com");
    });

    it("trims surrounding whitespace before parsing", () => {
      const c = linkDefinition.defaultContent({ link: "  example.com  " });
      expect(c.link).toBe("https://example.com");
    });

    it("does not URL-parse mailto links (no domain/favicon)", () => {
      const c = linkDefinition.defaultContent({ link: "mailto:a@b.com" });
      expect(c.link).toBe("mailto:a@b.com");
      expect(c.domain).toBeUndefined();
      expect(c.faviconUrl).toBeUndefined();
    });

    it("does not URL-parse tel links", () => {
      const c = linkDefinition.defaultContent({ link: "tel:+15551234" });
      expect(c.link).toBe("tel:+15551234");
      expect(c.domain).toBeUndefined();
    });

    it("keeps the original string when URL parsing throws", () => {
      const c = linkDefinition.defaultContent({ link: "has spaces" });
      expect(c.link).toBe("has spaces");
      expect(c.domain).toBeUndefined();
      expect(c.faviconUrl).toBeUndefined();
    });

    it("defaults an empty link to empty string", () => {
      const c = linkDefinition.defaultContent();
      expect(c.link).toBe("");
      expect(c.domain).toBeUndefined();
    });

    it("prefers explicitly provided domain/favicon over derived ones", () => {
      const c = linkDefinition.defaultContent({
        link: "example.com",
        domain: "custom-domain.com",
        faviconUrl: "https://custom/favicon.ico",
      });
      expect(c.domain).toBe("custom-domain.com");
      expect(c.faviconUrl).toBe("https://custom/favicon.ico");
    });

    it("defaults linkBackgroundEnabled to true and respects an explicit false", () => {
      expect(linkDefinition.defaultContent({ link: "x.com" }).linkBackgroundEnabled).toBe(
        true,
      );
      expect(
        linkDefinition.defaultContent({
          link: "x.com",
          linkBackgroundEnabled: false,
        }).linkBackgroundEnabled,
      ).toBe(false);
    });

    it("passes through optional meta/custom fields", () => {
      const c = linkDefinition.defaultContent({
        link: "x.com",
        metaTitle: "T",
        metaDescription: "D",
        metaImageUrl: "img",
        metaSiteName: "S",
        customTitle: "CT",
        customDescription: "CD",
        customSubtitle: "CS",
        customImageUrl: "ci",
        backgroundColor: "#000",
      });
      expect(c).toMatchObject({
        metaTitle: "T",
        metaDescription: "D",
        metaImageUrl: "img",
        metaSiteName: "S",
        customTitle: "CT",
        customDescription: "CD",
        customSubtitle: "CS",
        customImageUrl: "ci",
        backgroundColor: "#000",
      });
    });
  });

  describe("validate", () => {
    it.each([
      ["https://x.com", true],
      ["http://x.com", true],
      ["mailto:a@b.com", true],
      ["tel:+1555", true],
      ["", false],
      ["ftp://x.com", false],
      ["example.com", false],
    ])("validate(%s) => %s", (link, expected) => {
      expect(linkDefinition.validate({ link } as LinkContent)).toBe(expected);
    });
  });

  describe("actions", () => {
    it("copyContent and externalUrl return the link or null", () => {
      expect(
        linkDefinition.actions?.copyContent?.({
          link: "https://x.com",
        } as LinkContent),
      ).toBe("https://x.com");
      expect(
        linkDefinition.actions?.copyContent?.({ link: "" } as LinkContent),
      ).toBeNull();
      expect(
        linkDefinition.actions?.externalUrl?.({
          link: "https://x.com",
        } as LinkContent),
      ).toBe("https://x.com");
    });
  });
});

// ── embed (delegates to normalizeEmbedSrc) ───────────────────────────────────

describe("embedDefinition", () => {
  it("normalizes the src via normalizeEmbedSrc in defaultContent", () => {
    mockedNormalize.mockReturnValue("NORMALIZED");
    const c = embedDefinition.defaultContent({ src: "https://raw" });
    expect(mockedNormalize).toHaveBeenCalledWith("https://raw");
    expect(c).toEqual({ type: ContentType.EMBED, src: "NORMALIZED" });
  });

  it("passes an empty string to normalizeEmbedSrc when src is missing", () => {
    mockedNormalize.mockReturnValue("");
    embedDefinition.defaultContent();
    expect(mockedNormalize).toHaveBeenCalledWith("");
  });

  it.each([
    ["https://x.com/embed", true],
    ["http://x.com/embed", true],
    ["", false],
    ["ftp://x.com", false],
  ])("validate(%s) => %s", (src, expected) => {
    expect(embedDefinition.validate({ src } as EmbedContent)).toBe(expected);
  });

  it("copyContent and externalUrl return the src or null", () => {
    expect(
      embedDefinition.actions?.copyContent?.({ src: "s" } as EmbedContent),
    ).toBe("s");
    expect(
      embedDefinition.actions?.externalUrl?.({ src: "" } as EmbedContent),
    ).toBeNull();
  });
});

// ── map ───────────────────────────────────────────────────────────────────────

describe("mapDefinition", () => {
  it("applies mapbox defaults when no data is given", () => {
    expect(mapDefinition.defaultContent()).toEqual({
      type: ContentType.MAP,
      provider: "mapbox",
      center: { lat: 0, lng: 0 },
      zoom: 9,
      bearing: 0,
      pitch: 0,
      style: "default",
      show3d: false,
      showClouds: true,
      showPlanes: true,
      searchQuery: undefined,
      marker: undefined,
    });
  });

  it("respects provided numeric values including falsy zoom 0", () => {
    const c = mapDefinition.defaultContent({
      center: { lat: 51.5, lng: -0.12 },
      zoom: 0,
      bearing: 45,
      pitch: 30,
      show3d: true,
      showClouds: false,
      showPlanes: false,
    } as Partial<MapContent>);
    expect(c.center).toEqual({ lat: 51.5, lng: -0.12 });
    expect(c.zoom).toBe(0);
    expect(c.bearing).toBe(45);
    expect(c.show3d).toBe(true);
    expect(c.showClouds).toBe(false);
    expect(c.showPlanes).toBe(false);
  });

  describe("validate", () => {
    it("is valid for mapbox provider with finite coordinates", () => {
      expect(
        mapDefinition.validate({
          provider: "mapbox",
          center: { lat: 10, lng: 20 },
        } as MapContent),
      ).toBe(true);
    });

    it("is invalid for a non-mapbox provider", () => {
      expect(
        mapDefinition.validate({
          provider: "google",
          center: { lat: 0, lng: 0 },
        } as unknown as MapContent),
      ).toBe(false);
    });

    it("is invalid for non-finite or missing coordinates", () => {
      expect(
        mapDefinition.validate({
          provider: "mapbox",
          center: { lat: NaN, lng: 0 },
        } as MapContent),
      ).toBe(false);
      expect(
        mapDefinition.validate({
          provider: "mapbox",
          center: { lat: Infinity, lng: 0 },
        } as MapContent),
      ).toBe(false);
      expect(
        mapDefinition.validate({ provider: "mapbox" } as MapContent),
      ).toBe(false);
    });
  });

  it("has no copy/external actions defined", () => {
    expect(mapDefinition.actions).toBeUndefined();
  });
});

// ── campfire ──────────────────────────────────────────────────────────────────

describe("campfireDefinition", () => {
  it("defaults count and highScore to zero", () => {
    expect(campfireDefinition.defaultContent()).toEqual({
      type: ContentType.CAMPFIRE,
      count: 0,
      highScore: 0,
    });
  });

  it("uses provided count and highScore", () => {
    expect(
      campfireDefinition.defaultContent({ count: 5, highScore: 99 }),
    ).toMatchObject({ count: 5, highScore: 99 });
  });

  it("is always valid and limited to one per grid", () => {
    expect(campfireDefinition.validate({} as never)).toBe(true);
    expect(campfireDefinition.maxPerGrid).toBe(1);
  });
});

// ── suggestion ────────────────────────────────────────────────────────────────

describe("suggestionDefinition", () => {
  it("defaults action to 'text' and omits icon/label", () => {
    expect(suggestionDefinition.defaultContent()).toEqual({
      type: ContentType.SUGGESTION,
      action: "text",
    });
  });

  it("includes icon and label only when they are strings", () => {
    const c = suggestionDefinition.defaultContent({
      action: "media",
      icon: "star",
      label: "Add image",
    });
    expect(c).toEqual({
      type: ContentType.SUGGESTION,
      action: "media",
      icon: "star",
      label: "Add image",
    });
  });

  it("omits icon/label when they are not strings", () => {
    const c = suggestionDefinition.defaultContent({
      icon: undefined,
      label: undefined,
    });
    expect(c).not.toHaveProperty("icon");
    expect(c).not.toHaveProperty("label");
  });

  it("is non-duplicatable and non-resizable", () => {
    expect(suggestionDefinition.capabilities.duplicate).toBe(false);
    expect(suggestionDefinition.capabilities.resizable).toBe(false);
  });

  it("resolves its component to a null default (placeholder)", async () => {
    await expect(suggestionDefinition.component()).resolves.toEqual({
      default: null,
    });
  });
});

// ── profile ───────────────────────────────────────────────────────────────────

describe("profileDefinition", () => {
  it("applies profile defaults", () => {
    expect(profileDefinition.defaultContent()).toEqual({
      type: ContentType.PROFILE,
      name: "",
      title: "",
      bio: "",
      avatarShape: "square",
      avatarRadius: 12,
      avatarSides: 6,
      profilePhotoUrl: "",
      backgroundColor: undefined,
    });
  });

  it("respects provided values including avatarRadius 0", () => {
    const c = profileDefinition.defaultContent({
      name: "Ada",
      avatarShape: "circle",
      avatarRadius: 0,
    } as never);
    expect(c.name).toBe("Ada");
    expect(c.avatarShape).toBe("circle");
    expect(c.avatarRadius).toBe(0);
  });

  it("is always valid and has a 4x4 default size", () => {
    expect(profileDefinition.validate({} as never)).toBe(true);
    expect(profileDefinition.defaultSize).toEqual({ w: 4, h: 4 });
  });
});

// ── youtube ───────────────────────────────────────────────────────────────────

describe("youtubeDefinition", () => {
  it("defaults to an empty video with type 'video'", () => {
    const c = youtubeDefinition.defaultContent();
    expect(c).toMatchObject({
      type: ContentType.YOUTUBE,
      youtubeUrl: "",
      youtubeType: "video",
      youtubeId: "",
    });
  });

  it("passes through provided fields", () => {
    const c = youtubeDefinition.defaultContent({
      youtubeUrl: "https://youtu.be/abc",
      youtubeId: "abc",
      youtubeType: "playlist",
      title: "T",
    } as Partial<YouTubeContent>);
    expect(c.youtubeUrl).toBe("https://youtu.be/abc");
    expect(c.youtubeId).toBe("abc");
    expect(c.youtubeType).toBe("playlist");
    expect(c.title).toBe("T");
  });

  it.each([
    [{ youtubeUrl: "u", youtubeId: "id" }, true],
    [{ youtubeUrl: "u", youtubeId: "" }, false],
    [{ youtubeUrl: "", youtubeId: "id" }, false],
    [{ youtubeUrl: "", youtubeId: "" }, false],
  ])("validate(%o) => %s", (content, expected) => {
    expect(youtubeDefinition.validate(content as YouTubeContent)).toBe(
      expected,
    );
  });

  it("copyContent and externalUrl return the youtubeUrl or null", () => {
    expect(
      youtubeDefinition.actions?.copyContent?.({
        youtubeUrl: "u",
      } as YouTubeContent),
    ).toBe("u");
    expect(
      youtubeDefinition.actions?.externalUrl?.({
        youtubeUrl: "",
      } as YouTubeContent),
    ).toBeNull();
  });
});

// ── roadmapFeed ───────────────────────────────────────────────────────────────

describe("roadmapFeedDefinition", () => {
  it("applies empty defaults and is gated behind a feature flag", () => {
    expect(roadmapFeedDefinition.defaultContent()).toEqual({
      type: ContentType.ROADMAP_FEED,
      notionDatabaseId: "",
      statusPropertyName: "",
      upvotePropertyName: "",
      statusMapping: {},
      queryFilters: undefined,
      cachedItems: undefined,
      lastSyncedAt: undefined,
    });
    expect(roadmapFeedDefinition.featureFlag).toBe("beta-roadmap-feed");
  });

  it("passes through provided notion configuration", () => {
    const c = roadmapFeedDefinition.defaultContent({
      notionDatabaseId: "db1",
      statusPropertyName: "Status",
      statusMapping: { done: "Done" } as never,
    });
    expect(c.notionDatabaseId).toBe("db1");
    expect(c.statusPropertyName).toBe("Status");
    expect(c.statusMapping).toEqual({ done: "Done" });
  });

  it("is always valid", () => {
    expect(roadmapFeedDefinition.validate({} as never)).toBe(true);
  });
});

// ── music ─────────────────────────────────────────────────────────────────────

describe("musicDefinition", () => {
  it("defaults to an empty spotify track", () => {
    expect(musicDefinition.defaultContent()).toMatchObject({
      type: ContentType.MUSIC,
      platform: "spotify",
      trackId: "",
      trackName: "",
    });
  });

  it("passes through provided track fields", () => {
    const c = musicDefinition.defaultContent({
      platform: "apple",
      trackId: "123",
      trackUrl: "https://music",
    } as Partial<MusicContent>);
    expect(c.platform).toBe("apple");
    expect(c.trackId).toBe("123");
    expect(c.trackUrl).toBe("https://music");
  });

  it.each([
    [{ trackId: "1", platform: "spotify" }, true],
    [{ trackId: "", platform: "spotify" }, false],
    [{ trackId: "1", platform: "" }, false],
  ])("validate(%o) => %s", (content, expected) => {
    expect(musicDefinition.validate(content as MusicContent)).toBe(expected);
  });

  it("copyContent and externalUrl return the trackUrl or null", () => {
    expect(
      musicDefinition.actions?.copyContent?.({
        trackUrl: "u",
      } as MusicContent),
    ).toBe("u");
    expect(
      musicDefinition.actions?.externalUrl?.({ trackUrl: "" } as MusicContent),
    ).toBeNull();
  });
});

// ── document ──────────────────────────────────────────────────────────────────

describe("documentDefinition", () => {
  it("is gated behind the beta-documents feature flag", () => {
    expect(documentDefinition.featureFlag).toBe("beta-documents");
  });

  describe("defaultContent", () => {
    it("defaults items to an empty array and omits optional fields", () => {
      const c = documentDefinition.defaultContent();
      expect(c).toEqual({ type: ContentType.DOCUMENT, items: [] });
    });

    it("includes backgroundColor only when it is a non-empty string", () => {
      expect(
        documentDefinition.defaultContent({ backgroundColor: "#fff" }),
      ).toHaveProperty("backgroundColor", "#fff");
      expect(
        documentDefinition.defaultContent({ backgroundColor: "" }),
      ).not.toHaveProperty("backgroundColor");
    });

    it("includes customTitle/customDescription only when they are strings", () => {
      const c = documentDefinition.defaultContent({
        customTitle: "T",
        customDescription: "D",
      });
      expect(c).toMatchObject({ customTitle: "T", customDescription: "D" });

      const empty = documentDefinition.defaultContent({});
      expect(empty).not.toHaveProperty("customTitle");
      expect(empty).not.toHaveProperty("customDescription");
    });

    it("includes an empty-string customTitle (string check, not truthiness)", () => {
      const c = documentDefinition.defaultContent({ customTitle: "" });
      expect(c).toHaveProperty("customTitle", "");
    });

    it("preserves provided items", () => {
      const items = [{ id: "1", fileName: "a.pdf", url: "https://x/a.pdf" }];
      expect(
        documentDefinition.defaultContent({ items } as never).items,
      ).toEqual(items);
    });
  });

  describe("validate", () => {
    const item = (over: Record<string, unknown> = {}) => ({
      id: "1",
      fileName: "a.pdf",
      url: "https://x/a.pdf",
      ...over,
    });

    it("is valid for a non-empty list of well-formed items", () => {
      expect(
        documentDefinition.validate({
          items: [item(), item({ id: "2", url: "blob:b" })],
        } as DocumentsContent),
      ).toBe(true);
    });

    it("is invalid for an empty list", () => {
      expect(
        documentDefinition.validate({
          type: ContentType.DOCUMENT,
          items: [],
        } as DocumentsContent),
      ).toBe(false);
    });

    it("is invalid when items is not an array", () => {
      expect(
        documentDefinition.validate({
          items: undefined,
        } as unknown as DocumentsContent),
      ).toBe(false);
    });

    it("is invalid when an item is missing its id", () => {
      expect(
        documentDefinition.validate({
          items: [item({ id: "" })],
        } as DocumentsContent),
      ).toBe(false);
    });

    it("is invalid when an item has an empty fileName", () => {
      expect(
        documentDefinition.validate({
          items: [item({ fileName: "" })],
        } as DocumentsContent),
      ).toBe(false);
    });

    it.each([
      ["https://x/a.pdf", true],
      ["blob:abc", true],
      ["data:application/pdf;base64,xx", true],
      ["ftp://x/a.pdf", false],
      ["/relative/a.pdf", false],
    ])("item url %s => valid:%s", (url, expected) => {
      expect(
        documentDefinition.validate({
          items: [item({ url })],
        } as DocumentsContent),
      ).toBe(expected);
    });
  });

  it("exposes the tile id via extraProps", () => {
    expect(documentDefinition.extraProps?.({ i: "doc-3" } as never)).toEqual({
      tileId: "doc-3",
    });
  });
});

// ── toolbar wiring ────────────────────────────────────────────────────────────
//
// Each tile hand-assembles its `toolbar` array from the shared button modules.
// The individual buttons are unit-tested in tileToolbar/__tests__; here we
// guard the WIRING — that each tile still includes the distinctive buttons it
// is supposed to expose — so a regression that drops a button from a tile is
// caught. We assert containment of key ids rather than exact arrays to avoid a
// brittle mirror of the source.

describe("tile toolbar wiring", () => {
  const ids = (def: { toolbar?: unknown }): string[] => {
    expect(Array.isArray(def.toolbar)).toBe(true);
    return (def.toolbar as { id: string }[]).map((b) => b.id);
  };

  it("text/smartText expose alignment and the text more-menu", () => {
    for (const def of [textDefinition, smartTextDefinition]) {
      expect(ids(def)).toEqual(
        expect.arrayContaining([
          "resize-1x1",
          "border-toggle",
          "color",
          "text-align",
          "more-menu",
        ]),
      );
    }
  });

  it("image/video expose crop and tile-link buttons", () => {
    for (const def of [imageDefinition, videoDefinition]) {
      expect(ids(def)).toEqual(
        expect.arrayContaining([
          "crop",
          "tile-link",
          "border-toggle",
          "color",
        ]),
      );
    }
  });

  it("link exposes the link more-menu", () => {
    expect(ids(linkDefinition)).toEqual(
      expect.arrayContaining(["border-toggle", "color", "more-menu"]),
    );
  });

  it("map wires in the map-style buttons", () => {
    expect(ids(mapDefinition)).toEqual(
      expect.arrayContaining([
        "map-default",
        "map-pan",
        "map-search",
        "map-recenter",
      ]),
    );
  });

  it("music exposes only resize presets", () => {
    expect(ids(musicDefinition)).toEqual([
      "resize-1x1",
      "resize-2x3",
      "resize-2x2",
      "resize-4x2",
      "resize-4x4",
    ]);
  });

  it("chat exposes only its three resize presets", () => {
    expect(ids(chatDefinition)).toEqual([
      "resize-3x2",
      "resize-4x2",
      "resize-4x4",
    ]);
  });

  it("embed and campfire expose the border toggle", () => {
    expect(ids(embedDefinition)).toContain("border-toggle");
    expect(ids(campfireDefinition)).toContain("border-toggle");
  });

  it("profile and roadmapFeed expose border + color appearance buttons", () => {
    for (const def of [profileDefinition, roadmapFeedDefinition]) {
      expect(ids(def)).toEqual(
        expect.arrayContaining(["border-toggle", "color"]),
      );
    }
  });

  it("youtube and suggestion define no toolbar", () => {
    expect(youtubeDefinition.toolbar).toBeUndefined();
    expect(suggestionDefinition.toolbar).toBeUndefined();
  });
});
