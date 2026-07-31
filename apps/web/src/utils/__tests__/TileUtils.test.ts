/**
 * Tests for TileUtils.ts
 *
 * Covers:
 *  - isDirectImageUrl / isDirectVideoUrl (URL detection)
 *  - createTileContent (default values for every ContentType)
 *  - validateTileContent (business rules per type)
 *  - createTileContentFromEmbedUrl (YouTube, Spotify, Apple Music, image, video routing)
 *  - normalizeEmbedSrc (canonical YouTube nocookie embed rewriting)
 *  - createTile (positioned tile wrapper)
 *  - getContentComponent / getOptionComponent (component resolution)
 *
 * TileUtils has no runtime DAO calls so no special mocking is needed beyond
 * what setup.ts already provides for the module-level store import.
 */

import { describe, it, expect, vi } from "vitest";
import {
  isDirectImageUrl,
  isDirectVideoUrl,
  createTileContent,
  validateTileContent,
  createTileContentFromEmbedUrl,
  normalizeEmbedSrc,
  createTile,
  getContentComponent,
  getOptionComponent,
  isHiddenSuggestion,
} from "@/utils/TileUtils";
import { ContentType } from "@grids/contracts/types";
import type {
  TextContent,
  ImageContent,
  LinkContent,
  YouTubeContent,
  MusicContent,
  MapContent,
  ProfileBioContent,
  CampfireContent,
  EmbedContent,
} from "@grids/contracts/types";

// TileUtils imports useThemeStore at module level but never calls it in the
// functions under test. Mock it to avoid Pinia "no active instance" errors.
vi.mock("@/stores/theme", () => ({
  useThemeStore: vi.fn(() => ({ isDark: false })),
}));

// ── isDirectImageUrl ───────────────────────────────────────────────────────

describe("isDirectImageUrl", () => {
  it.each([
    "https://example.com/photo.png",
    "https://cdn.example.com/img/banner.jpg",
    "https://example.com/image.jpeg",
    "https://example.com/animation.gif",
    "https://example.com/photo.webp",
    "https://example.com/icon.svg",
    "https://example.com/bitmap.bmp",
  ])("returns true for direct image URL: %s", (url) => {
    expect(isDirectImageUrl(url)).toBe(true);
  });

  it("returns true for data: image URIs", () => {
    expect(isDirectImageUrl("data:image/png;base64,abc123")).toBe(true);
  });

  it.each([
    "",
    "https://example.com/page",
    "https://youtube.com/watch?v=abc",
    "https://example.com/document.pdf",
    "https://example.com/video.mp4",
    "not-a-url",
  ])("returns false for non-image URL: %s", (url) => {
    expect(isDirectImageUrl(url)).toBe(false);
  });

  it("handles URLs without protocol by adding https://", () => {
    expect(isDirectImageUrl("example.com/photo.png")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isDirectImageUrl("")).toBe(false);
  });
});

// ── isDirectVideoUrl ───────────────────────────────────────────────────────

describe("isDirectVideoUrl", () => {
  it.each([
    "https://example.com/video.mp4",
    "https://example.com/clip.webm",
    "https://example.com/recording.mov",
  ])("returns true for direct video URL: %s", (url) => {
    expect(isDirectVideoUrl(url)).toBe(true);
  });

  it("returns true for data: video URIs", () => {
    expect(isDirectVideoUrl("data:video/mp4;base64,abc123")).toBe(true);
  });

  it.each([
    "",
    "https://example.com/page",
    "https://example.com/photo.png",
    "https://example.com/document.pdf",
  ])("returns false for non-video URL: %s", (url) => {
    expect(isDirectVideoUrl(url)).toBe(false);
  });
});

// ── createTileContent defaults ─────────────────────────────────────────────

describe("createTileContent", () => {
  it("creates TEXT content with correct defaults", () => {
    const content = createTileContent(ContentType.TEXT) as TextContent;
    expect(content.type).toBe(ContentType.TEXT);
    expect(content.text).toBe("");
    expect(content.font).toBe("Arial");
    expect(content.fontSize).toBe(14);
    expect(content.isBold).toBe(false);
    expect(content.isItalic).toBe(false);
    expect(content.color).toBe("#ffffff");
  });

  it("creates TEXT content with provided data", () => {
    const content = createTileContent(ContentType.TEXT, {
      text: "Hello",
      font: "Georgia",
      isBold: true,
    }) as TextContent;
    expect(content.text).toBe("Hello");
    expect(content.font).toBe("Georgia");
    expect(content.isBold).toBe(true);
    expect(content.fontSize).toBe(14); // default preserved
  });

  it("creates IMAGE content with correct defaults", () => {
    const content = createTileContent(ContentType.IMAGE) as ImageContent;
    expect(content.type).toBe(ContentType.IMAGE);
    expect(content.src).toBe("");
    expect(content.zoom).toBe(1);
    expect(content.offsetX).toBe(0);
    expect(content.offsetY).toBe(0);
  });

  it("creates LINK content and derives domain + favicon from URL", () => {
    const content = createTileContent(ContentType.LINK, {
      link: "https://github.com",
    }) as LinkContent;
    expect(content.type).toBe(ContentType.LINK);
    expect(content.link).toBe("https://github.com");
    expect(content.domain).toBe("github.com");
    expect(content.faviconUrl).toContain("github.com");
    expect(content.linkBackgroundEnabled).toBe(true);
  });

  it("creates LINK content for URL without protocol", () => {
    const content = createTileContent(ContentType.LINK, {
      link: "github.com",
    }) as LinkContent;
    expect(content.link).toBe("https://github.com");
    expect(content.domain).toBe("github.com");
  });

  it("creates MAP content with correct defaults", () => {
    const content = createTileContent(ContentType.MAP) as MapContent;
    expect(content.type).toBe(ContentType.MAP);
    expect(content.provider).toBe("mapbox");
    expect(content.center).toEqual({ lat: 0, lng: 0 });
    expect(content.zoom).toBe(9);
    expect(content.style).toBe("default");
    expect(content.show3d).toBe(false);
  });

  it("creates PROFILE content with correct defaults", () => {
    const content = createTileContent(ContentType.PROFILE) as ProfileBioContent;
    expect(content.type).toBe(ContentType.PROFILE);
    expect(content.name).toBe("");
    expect(content.avatarShape).toBe("square");
    expect(content.avatarRadius).toBe(12);
  });

  it("creates CAMPFIRE content with correct defaults", () => {
    const content = createTileContent(ContentType.CAMPFIRE) as CampfireContent;
    expect(content.type).toBe(ContentType.CAMPFIRE);
    expect(content.count).toBe(0);
    expect(content.highScore).toBe(0);
  });

  it("creates YOUTUBE content with provided data", () => {
    const content = createTileContent(ContentType.YOUTUBE, {
      youtubeUrl: "https://youtube.com/watch?v=abc123defgh",
      youtubeType: "video",
      youtubeId: "abc123defgh",
    }) as YouTubeContent;
    expect(content.type).toBe(ContentType.YOUTUBE);
    expect(content.youtubeId).toBe("abc123defgh");
    expect(content.youtubeType).toBe("video");
  });

  it("creates MUSIC content with provided data", () => {
    const content = createTileContent(ContentType.MUSIC, {
      platform: "spotify",
      trackId: "ABC123",
      trackName: "Test Song",
      artistName: "Test Artist",
    }) as MusicContent;
    expect(content.type).toBe(ContentType.MUSIC);
    expect(content.platform).toBe("spotify");
    expect(content.trackId).toBe("ABC123");
  });

  it("throws for unsupported content type", () => {
    expect(() => createTileContent("unsupported" as ContentType)).toThrow();
  });
});

// ── validateTileContent ────────────────────────────────────────────────────

describe("validateTileContent", () => {
  it("validates TEXT: returns false for empty text", () => {
    const content = createTileContent(ContentType.TEXT) as TextContent;
    expect(validateTileContent(content)).toBe(false);
  });

  it("validates TEXT: returns true for non-empty text", () => {
    const content = createTileContent(ContentType.TEXT, {
      text: "Hello",
    }) as TextContent;
    expect(validateTileContent(content)).toBe(true);
  });

  it("validates TEXT: returns false for whitespace-only text", () => {
    const content = createTileContent(ContentType.TEXT, {
      text: "   ",
    }) as TextContent;
    expect(validateTileContent(content)).toBe(false);
  });

  it("validates IMAGE: returns false for empty src", () => {
    const content = createTileContent(ContentType.IMAGE) as ImageContent;
    expect(validateTileContent(content)).toBe(false);
  });

  it("validates IMAGE: returns true for https src", () => {
    const content = createTileContent(ContentType.IMAGE, {
      src: "https://example.com/photo.jpg",
    }) as ImageContent;
    expect(validateTileContent(content)).toBe(true);
  });

  it("validates IMAGE: returns true for data: URI", () => {
    const content = createTileContent(ContentType.IMAGE, {
      src: "data:image/png;base64,abc",
    }) as ImageContent;
    expect(validateTileContent(content)).toBe(true);
  });

  it("validates LINK: returns false for empty link", () => {
    const content = createTileContent(ContentType.LINK) as LinkContent;
    expect(validateTileContent(content)).toBe(false);
  });

  it("validates LINK: returns true for valid https link", () => {
    const content = createTileContent(ContentType.LINK, {
      link: "https://example.com",
    }) as LinkContent;
    expect(validateTileContent(content)).toBe(true);
  });

  it("validates EMBED: returns false for empty src", () => {
    const content = createTileContent(ContentType.EMBED) as EmbedContent;
    expect(validateTileContent(content)).toBe(false);
  });

  it("validates EMBED: returns true for https src", () => {
    const content = createTileContent(ContentType.EMBED, {
      src: "https://example.com/embed",
    }) as EmbedContent;
    expect(validateTileContent(content)).toBe(true);
  });

  it("validates MAP: returns false for non-finite coordinates", () => {
    const content = createTileContent(ContentType.MAP, {
      center: { lat: NaN, lng: 0 },
    }) as MapContent;
    expect(validateTileContent(content)).toBe(false);
  });

  it("validates MAP: returns true for valid coordinates", () => {
    const content = createTileContent(ContentType.MAP, {
      center: { lat: 40.7128, lng: -74.006 },
    }) as MapContent;
    expect(validateTileContent(content)).toBe(true);
  });

  it("validates YOUTUBE: returns false when youtubeId is empty", () => {
    const content = createTileContent(ContentType.YOUTUBE) as YouTubeContent;
    expect(validateTileContent(content)).toBe(false);
  });

  it("validates YOUTUBE: returns true when both url and id are present", () => {
    const content = createTileContent(ContentType.YOUTUBE, {
      youtubeUrl: "https://youtube.com/watch?v=abc123defgh",
      youtubeId: "abc123defgh",
    }) as YouTubeContent;
    expect(validateTileContent(content)).toBe(true);
  });

  it("validates MUSIC: returns false when trackId is empty", () => {
    const content = createTileContent(ContentType.MUSIC) as MusicContent;
    expect(validateTileContent(content)).toBe(false);
  });

  it("validates MUSIC: returns true when platform and trackId are set", () => {
    const content = createTileContent(ContentType.MUSIC, {
      platform: "spotify",
      trackId: "ABC123",
    }) as MusicContent;
    expect(validateTileContent(content)).toBe(true);
  });

  it.each([
    ContentType.CHAT,
    ContentType.CAMPFIRE,
    ContentType.PROFILE,
    ContentType.ROADMAP_FEED,
    ContentType.SUGGESTION,
  ])("validates %s as always true (no validation rules)", (type) => {
    const content = createTileContent(type);
    expect(validateTileContent(content)).toBe(true);
  });
});

// ── createTileContentFromEmbedUrl (URL routing) ────────────────────────────

describe("createTileContentFromEmbedUrl", () => {
  describe("YouTube URLs", () => {
    it("detects standard youtube.com/watch?v= URL as YOUTUBE type", () => {
      const content = createTileContentFromEmbedUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ) as YouTubeContent;
      expect(content.type).toBe(ContentType.YOUTUBE);
      expect(content.youtubeType).toBe("video");
      expect(content.youtubeId).toBe("dQw4w9WgXcQ");
    });

    it("detects youtu.be short URL as YOUTUBE type", () => {
      const content = createTileContentFromEmbedUrl(
        "https://youtu.be/dQw4w9WgXcQ",
      ) as YouTubeContent;
      expect(content.type).toBe(ContentType.YOUTUBE);
      expect(content.youtubeId).toBe("dQw4w9WgXcQ");
    });

    it("detects youtube.com/shorts/ URL", () => {
      const content = createTileContentFromEmbedUrl(
        "https://www.youtube.com/shorts/abc12345678",
      ) as YouTubeContent;
      expect(content.type).toBe(ContentType.YOUTUBE);
      expect(content.youtubeType).toBe("short");
    });

    it("detects YouTube playlist URL and captures the list id", () => {
      const content = createTileContentFromEmbedUrl(
        "https://www.youtube.com/playlist?list=PLrEnWoR732-BHrPp_Pm8_VleD68f9s14-",
      ) as YouTubeContent;
      expect(content.type).toBe(ContentType.YOUTUBE);
      expect(content.youtubeType).toBe("playlist");
      expect(content.youtubeId).toBe("PLrEnWoR732-BHrPp_Pm8_VleD68f9s14-");
    });

    it("ignores auto-generated 'My Mix' (RD...) playlists and treats watch URL as a video", () => {
      const content = createTileContentFromEmbedUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RD12345",
      ) as YouTubeContent;
      expect(content.type).toBe(ContentType.YOUTUBE);
      expect(content.youtubeType).toBe("video");
      expect(content.youtubeId).toBe("dQw4w9WgXcQ");
    });

    it("detects YouTube channel @handle URL", () => {
      const content = createTileContentFromEmbedUrl(
        "https://www.youtube.com/@SomeChannel",
      ) as YouTubeContent;
      expect(content.type).toBe(ContentType.YOUTUBE);
      expect(content.youtubeType).toBe("channel");
      expect(content.youtubeId).toBe("SomeChannel");
    });

    it("detects YouTube /channel/<id> URL", () => {
      const content = createTileContentFromEmbedUrl(
        "https://www.youtube.com/channel/UC1234567890",
      ) as YouTubeContent;
      expect(content.type).toBe(ContentType.YOUTUBE);
      expect(content.youtubeType).toBe("channel");
      expect(content.youtubeId).toBe("UC1234567890");
    });

    it("detects YouTube /c/<name> custom channel URL", () => {
      const content = createTileContentFromEmbedUrl(
        "https://www.youtube.com/c/SomeCreator",
      ) as YouTubeContent;
      expect(content.type).toBe(ContentType.YOUTUBE);
      expect(content.youtubeType).toBe("channel");
      expect(content.youtubeId).toBe("SomeCreator");
    });

    it("detects YouTube /user/<name> legacy channel URL", () => {
      const content = createTileContentFromEmbedUrl(
        "https://www.youtube.com/user/LegacyUser",
      ) as YouTubeContent;
      expect(content.type).toBe(ContentType.YOUTUBE);
      expect(content.youtubeType).toBe("channel");
      expect(content.youtubeId).toBe("LegacyUser");
    });
  });

  describe("Spotify URLs", () => {
    it("detects open.spotify.com/track/ URL as MUSIC type", () => {
      const content = createTileContentFromEmbedUrl(
        "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      ) as MusicContent;
      expect(content.type).toBe(ContentType.MUSIC);
      expect(content.platform).toBe("spotify");
      expect(content.trackId).toBe("4cOdK2wGLETKBW3PvgPWqT");
    });

    it("detects Spotify album URL as MUSIC type", () => {
      const content = createTileContentFromEmbedUrl(
        "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3",
      ) as MusicContent;
      expect(content.type).toBe(ContentType.MUSIC);
      expect(content.platform).toBe("spotify");
    });

    it("detects a Spotify /embed/track/ URL as a track", () => {
      const content = createTileContentFromEmbedUrl(
        "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT",
      ) as MusicContent;
      expect(content.type).toBe(ContentType.MUSIC);
      expect(content.platform).toBe("spotify");
      expect(content.trackId).toBe("4cOdK2wGLETKBW3PvgPWqT");
      expect(content.trackType).toBe("track");
    });

    it("detects a Spotify /embed/album/ URL as an album", () => {
      const content = createTileContentFromEmbedUrl(
        "https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3",
      ) as MusicContent;
      expect(content.type).toBe(ContentType.MUSIC);
      expect(content.platform).toBe("spotify");
      expect(content.trackType).toBe("album");
    });

    it("detects the bare spotify.com host (not just open.spotify.com)", () => {
      const content = createTileContentFromEmbedUrl(
        "https://spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      ) as MusicContent;
      expect(content.type).toBe(ContentType.MUSIC);
      expect(content.platform).toBe("spotify");
      expect(content.trackId).toBe("4cOdK2wGLETKBW3PvgPWqT");
    });
  });

  describe("Apple Music URLs", () => {
    it("detects music.apple.com song URL as MUSIC type", () => {
      const content = createTileContentFromEmbedUrl(
        "https://music.apple.com/us/song/bad-guy/1450695723",
      ) as MusicContent;
      expect(content.type).toBe(ContentType.MUSIC);
      expect(content.platform).toBe("apple");
      expect(content.trackId).toBe("1450695723");
    });

    it("detects Apple Music album track with ?i= param", () => {
      const content = createTileContentFromEmbedUrl(
        "https://music.apple.com/us/album/some-album/123456?i=789012",
      ) as MusicContent;
      expect(content.type).toBe(ContentType.MUSIC);
      expect(content.platform).toBe("apple");
      expect(content.trackId).toBe("789012");
    });

    it("detects the short /song/<id> form (no slug segment)", () => {
      const content = createTileContentFromEmbedUrl(
        "https://music.apple.com/us/song/1450695723",
      ) as MusicContent;
      expect(content.type).toBe(ContentType.MUSIC);
      expect(content.platform).toBe("apple");
      expect(content.trackId).toBe("1450695723");
    });

    it("detects the embed.music.apple.com host", () => {
      const content = createTileContentFromEmbedUrl(
        "https://embed.music.apple.com/us/song/bad-guy/1450695723",
      ) as MusicContent;
      expect(content.type).toBe(ContentType.MUSIC);
      expect(content.platform).toBe("apple");
      expect(content.trackId).toBe("1450695723");
    });
  });

  describe("Image URLs", () => {
    it("routes direct .png URL to IMAGE type", () => {
      const content = createTileContentFromEmbedUrl(
        "https://example.com/photo.png",
      );
      expect(content.type).toBe(ContentType.IMAGE);
    });

    it("routes direct .jpg URL to IMAGE type", () => {
      const content = createTileContentFromEmbedUrl(
        "https://example.com/photo.jpg",
      );
      expect(content.type).toBe(ContentType.IMAGE);
    });
  });

  describe("Video URLs", () => {
    it("routes direct .mp4 URL to VIDEO type", () => {
      const content = createTileContentFromEmbedUrl(
        "https://example.com/clip.mp4",
      );
      expect(content.type).toBe(ContentType.VIDEO);
    });
  });

  describe("Embed fallback", () => {
    it("falls back to EMBED type for generic URLs", () => {
      const content = createTileContentFromEmbedUrl(
        "https://example.com/some-page",
      ) as EmbedContent;
      expect(content.type).toBe(ContentType.EMBED);
      expect(content.src).toBe("https://example.com/some-page");
    });

    it("routes a /embed/ YouTube URL to EMBED and normalizes it to a nocookie URL", () => {
      // parseYouTubeUrl does NOT recognize the /embed/ path, so it falls through
      // to EMBED — but the EMBED tile's defaultContent runs the src through
      // normalizeEmbedSrc, rewriting it to the canonical youtube-nocookie embed.
      const content = createTileContentFromEmbedUrl(
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
      ) as EmbedContent;
      expect(content.type).toBe(ContentType.EMBED);
      expect(content.src).toBe(
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&modestbranding=1",
      );
    });

    it("extracts src from pasted <iframe> HTML", () => {
      const iframe =
        '<iframe src="https://example.com/embed/123" width="560" height="315"></iframe>';
      const content = createTileContentFromEmbedUrl(iframe) as EmbedContent;
      expect(content.type).toBe(ContentType.EMBED);
      expect(content.src).toContain("example.com");
    });

    it("adds https:// when protocol is missing", () => {
      const content = createTileContentFromEmbedUrl(
        "example.com/some-page",
      ) as EmbedContent;
      expect(content.src).toMatch(/^https:\/\//);
    });

    it("falls back to EMBED for a Spotify URL that is neither track nor album", () => {
      // parseMusicUrl only recognizes /track and /album — a playlist URL is
      // not music, so it routes to a generic embed.
      const content = createTileContentFromEmbedUrl(
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      ) as EmbedContent;
      expect(content.type).toBe(ContentType.EMBED);
      expect(content.src).toBe(
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      );
    });
  });
});

// ── normalizeEmbedSrc ──────────────────────────────────────────────────────

describe("normalizeEmbedSrc", () => {
  const CANONICAL = (id: string) =>
    `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1`;
  const VIDEO_ID = "dQw4w9WgXcQ"; // exactly 11 chars

  it.each([
    ["youtu.be short link", `https://youtu.be/${VIDEO_ID}`],
    ["watch URL", `https://www.youtube.com/watch?v=${VIDEO_ID}`],
    ["embed URL", `https://www.youtube.com/embed/${VIDEO_ID}`],
    ["shorts URL", `https://www.youtube.com/shorts/${VIDEO_ID}`],
    ["live URL", `https://www.youtube.com/live/${VIDEO_ID}`],
    ["already-nocookie URL", `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`],
  ])("rewrites a %s to the canonical nocookie embed URL", (_label, input) => {
    expect(normalizeEmbedSrc(input)).toBe(CANONICAL(VIDEO_ID));
  });

  it("adds a protocol before normalizing a bare YouTube URL", () => {
    expect(normalizeEmbedSrc(`youtube.com/watch?v=${VIDEO_ID}`)).toBe(
      CANONICAL(VIDEO_ID),
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeEmbedSrc(`  https://youtu.be/${VIDEO_ID}  `)).toBe(
      CANONICAL(VIDEO_ID),
    );
  });

  it("returns the (protocol-added) URL unchanged for non-YouTube hosts", () => {
    expect(normalizeEmbedSrc("https://vimeo.com/123456")).toBe(
      "https://vimeo.com/123456",
    );
  });

  it("does not rewrite a YouTube URL whose id is not exactly 11 chars", () => {
    // Strict 11-char guard prevents turning non-video URLs into embeds.
    const input = "https://www.youtube.com/watch?v=tooShort";
    expect(normalizeEmbedSrc(input)).toBe(input);
  });

  it("does not rewrite a YouTube channel URL (no extractable video id)", () => {
    const input = "https://www.youtube.com/@SomeChannel";
    expect(normalizeEmbedSrc(input)).toBe(input);
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeEmbedSrc("")).toBe("");
    expect(normalizeEmbedSrc("   ")).toBe("");
  });
});

// ── createTile ─────────────────────────────────────────────────────────────

describe("createTile", () => {
  it("wraps tile content with the given position and identity", () => {
    const tile = createTile(
      ContentType.TEXT,
      "tile-1",
      2,
      3,
      4,
      5,
      { text: "hi" },
      "my caption",
    );
    expect(tile).toMatchObject({
      i: "tile-1",
      x: 2,
      y: 3,
      w: 4,
      h: 5,
      borderEnabled: true,
      caption: "my caption",
    });
  });

  it("builds content via createTileContent for the given type", () => {
    const tile = createTile(
      ContentType.TEXT,
      "t",
      0,
      0,
      1,
      1,
      { text: "hi" },
      "",
    );
    const content = tile.content as TextContent;
    expect(content.type).toBe(ContentType.TEXT);
    expect(content.text).toBe("hi");
    expect(content.font).toBe("Arial"); // default merged in
  });

  it("defaults border to enabled", () => {
    const tile = createTile(ContentType.TEXT, "t", 0, 0, 1, 1, {}, "");
    expect(tile.borderEnabled).toBe(true);
  });

  it("throws for an unsupported content type", () => {
    expect(() =>
      createTile("nope" as ContentType, "t", 0, 0, 1, 1, {}, ""),
    ).toThrow(/Unsupported content type/);
  });
});

// ── getContentComponent / getOptionComponent ───────────────────────────────

describe("getContentComponent", () => {
  it("returns null for SUGGESTION content (rendered inline elsewhere)", () => {
    const content = createTileContent(ContentType.SUGGESTION);
    expect(getContentComponent(content)).toBeNull();
  });

  it("returns a (non-null) async component for a normal content type", () => {
    const content = createTileContent(ContentType.TEXT) as TextContent;
    expect(getContentComponent(content)).not.toBeNull();
  });

  it("throws for an unsupported content type", () => {
    expect(() =>
      getContentComponent({ type: "nope" } as unknown as TextContent),
    ).toThrow(/Unsupported content type/);
  });
});

describe("getOptionComponent", () => {
  it("returns null (no per-type option components are defined)", () => {
    const content = createTileContent(ContentType.TEXT) as TextContent;
    expect(getOptionComponent(content)).toBeNull();
  });
});

// ── isHiddenSuggestion ─────────────────────────────────────────────────────

describe("isHiddenSuggestion", () => {
  const tileOfType = (type: ContentType) =>
    createTile(type, "tile-1", 0, 0, 2, 2, undefined, "");

  it("hides a suggestion tile from anyone who cannot edit", () => {
    const tile = tileOfType(ContentType.SUGGESTION);
    expect(isHiddenSuggestion(tile, false)).toBe(true);
  });

  it("keeps a suggestion tile visible while editing is allowed", () => {
    const tile = tileOfType(ContentType.SUGGESTION);
    expect(isHiddenSuggestion(tile, true)).toBe(false);
  });

  it("never hides real content, editable or not", () => {
    const tile = tileOfType(ContentType.TEXT);
    expect(isHiddenSuggestion(tile, false)).toBe(false);
    expect(isHiddenSuggestion(tile, true)).toBe(false);
  });
});
