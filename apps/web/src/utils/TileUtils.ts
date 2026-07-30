import {
  ContentType,
  type Tile,
  type TileContent,
  type YouTubeContent,
  type MusicContent,
  type MusicPlatform,
  type AnyTileContent,
} from "@grids/contracts/types";
import { type Component, defineAsyncComponent, markRaw } from "vue";
import { getTileDefinition } from "@/registries/tileRegistry";

function ensureUrlHasProtocol(url: string): string {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;
}

function _makeDefaultDoc(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  });
}

export function isDirectImageUrl(src: string): boolean {
  const trimmed = (src || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:image/")) return true;

  const formatted = ensureUrlHasProtocol(trimmed);
  try {
    const url = new URL(formatted);
    const pathname = url.pathname.toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(pathname);
  } catch {
    const lower = formatted.toLowerCase();
    return (
      lower.includes(".png") ||
      lower.includes(".jpg") ||
      lower.includes(".jpeg") ||
      lower.includes(".gif") ||
      lower.includes(".webp") ||
      lower.includes(".bmp") ||
      lower.includes(".svg")
    );
  }
}

export function isDirectVideoUrl(src: string): boolean {
  const trimmed = (src || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:video/")) return true;

  const formatted = ensureUrlHasProtocol(trimmed);
  try {
    const url = new URL(formatted);
    const pathname = url.pathname.toLowerCase();
    return /\.(mp4|webm|mov)$/.test(pathname);
  } catch {
    const lower = formatted.toLowerCase();
    return (
      lower.includes(".mp4") ||
      lower.includes(".webm") ||
      lower.includes(".mov")
    );
  }
}

// Parse YouTube URLs to extract type and ID
// Supports formats:
// - Videos: youtube.com/watch?v=ID, youtu.be/ID
// - Shorts: youtube.com/shorts/ID
// - Playlists: youtube.com/playlist?list=ID
// - Channels: youtube.com/@username, youtube.com/channel/ID, youtube.com/c/username
// Note: YouTube Posts (community posts) are not supported as they require different API access
function parseYouTubeUrl(
  url: string,
): { type: "video" | "playlist" | "channel" | "short"; id: string } | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check if it's a YouTube domain
    if (!hostname.includes("youtube.com") && !hostname.includes("youtu.be")) {
      return null;
    }

    // Shorts: youtube.com/shorts/ID (check first as it's most specific)
    const shortsMatch = urlObj.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      return { type: "short", id: shortsMatch[1] };
    }

    // Playlist: Check for list parameter in any watch or playlist URL
    // This handles both youtube.com/playlist?list=ID and youtube.com/watch?v=ID&list=ID
    if (urlObj.searchParams.has("list")) {
      const listId = urlObj.searchParams.get("list");
      // Ignore auto-generated "My Mix" playlists (they start with RD)
      if (listId && !listId.startsWith("RD")) {
        return { type: "playlist", id: listId };
      }
    }

    // Video: youtube.com/watch?v=ID (only if no valid playlist was found)
    if (urlObj.pathname === "/watch" && urlObj.searchParams.has("v")) {
      return { type: "video", id: urlObj.searchParams.get("v") ?? "" };
    }

    // Video: youtu.be/ID
    if (hostname.includes("youtu.be")) {
      const id = urlObj.pathname.slice(1).split("?")[0];
      if (id) return { type: "video", id };
    }

    // Channel: youtube.com/@username
    const atMatch = urlObj.pathname.match(/^\/@([a-zA-Z0-9._-]+)/);
    if (atMatch) {
      return { type: "channel", id: atMatch[1] };
    }

    // Channel: youtube.com/channel/ID
    const channelMatch = urlObj.pathname.match(/^\/channel\/([a-zA-Z0-9_-]+)/);
    if (channelMatch) {
      return { type: "channel", id: channelMatch[1] };
    }

    // Channel: youtube.com/c/username or youtube.com/user/username
    const customMatch = urlObj.pathname.match(/^\/(c|user)\/([a-zA-Z0-9._-]+)/);
    if (customMatch) {
      return { type: "channel", id: customMatch[2] };
    }

    return null;
  } catch {
    return null;
  }
}

// Parse Spotify and Apple Music URLs to extract platform and track ID
// Supports formats:
// - Spotify: open.spotify.com/track/ID, open.spotify.com/embed/track/ID
// - Apple Music: music.apple.com/.../song/.../ID, music.apple.com/.../album/...?i=ID,
//   embed.music.apple.com/.../song/ID
function parseMusicUrl(url: string): {
  platform: MusicPlatform;
  trackId: string;
  trackType: "track" | "album";
} | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Spotify: open.spotify.com/track/<id>, /album/<id>, /embed/track/<id>, /embed/album/<id>
    if (hostname === "open.spotify.com" || hostname === "spotify.com") {
      const trackMatch = urlObj.pathname.match(
        /(?:\/embed)?\/track\/([A-Za-z0-9]+)/,
      );
      if (trackMatch) {
        return {
          platform: "spotify",
          trackId: trackMatch[1],
          trackType: "track",
        };
      }
      const albumMatch = urlObj.pathname.match(
        /(?:\/embed)?\/album\/([A-Za-z0-9]+)/,
      );
      if (albumMatch) {
        return {
          platform: "spotify",
          trackId: albumMatch[1],
          trackType: "album",
        };
      }
    }

    // Apple Music: music.apple.com/xx/song/slug/ID
    if (
      hostname === "music.apple.com" ||
      hostname === "embed.music.apple.com"
    ) {
      // /us/song/song-name/1234567890
      const songMatch = urlObj.pathname.match(/\/song\/[^/]+\/(\d+)/);
      if (songMatch) {
        return { platform: "apple", trackId: songMatch[1], trackType: "track" };
      }
      // /us/song/1234567890 (short form on embed URLs)
      const shortSongMatch = urlObj.pathname.match(/\/song\/(\d+)/);
      if (shortSongMatch) {
        return {
          platform: "apple",
          trackId: shortSongMatch[1],
          trackType: "track",
        };
      }
      // /us/album/album-name/123?i=456 (track within album)
      const albumTrackId = urlObj.searchParams.get("i");
      if (albumTrackId && /^\d+$/.test(albumTrackId)) {
        return { platform: "apple", trackId: albumTrackId, trackType: "track" };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Extract a URL from pasted <iframe> HTML markup
function extractUrlFromIframe(html: string): string | null {
  const srcMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return srcMatch ? srcMatch[1] : null;
}

export function createTileContentFromEmbedUrl(src: string): TileContent {
  const trimmed = (src || "").trim();

  // Check for pasted <iframe> HTML — extract the src URL
  let urlToCheck = trimmed;
  if (trimmed.includes("<iframe")) {
    const extracted = extractUrlFromIframe(trimmed);
    if (extracted) urlToCheck = extracted;
  }

  const formatted = ensureUrlHasProtocol(urlToCheck);

  // Check for YouTube URLs first
  const youtubeData = parseYouTubeUrl(formatted);
  if (youtubeData) {
    return createTileContent(ContentType.YOUTUBE, {
      youtubeUrl: formatted,
      youtubeType: youtubeData.type,
      youtubeId: youtubeData.id,
    } as Partial<YouTubeContent>);
  }

  // Check for Spotify / Apple Music URLs
  const musicData = parseMusicUrl(formatted);
  if (musicData) {
    return createTileContent(ContentType.MUSIC, {
      platform: musicData.platform,
      trackId: musicData.trackId,
      trackType: musicData.trackType,
    } as Partial<MusicContent>);
  }

  if (isDirectImageUrl(formatted)) {
    return createTileContent(ContentType.IMAGE, { src: formatted });
  }
  if (isDirectVideoUrl(formatted)) {
    return createTileContent(ContentType.VIDEO, { src: formatted });
  }
  return createTileContent(ContentType.EMBED, { src: formatted });
}

function isYouTubeHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com")
  );
}

function extractYouTubeVideoId(parsedUrl: URL): string | null {
  const host = parsedUrl.hostname.toLowerCase();
  const path = parsedUrl.pathname;

  // Supported formats:
  // - https://youtu.be/<id>
  // - https://www.youtube.com/watch?v=<id>
  // - https://www.youtube.com/embed/<id>
  // - https://www.youtube.com/shorts/<id>
  // - https://www.youtube.com/live/<id>
  let id: string | null = null;

  if (host === "youtu.be") {
    id = path.split("/").filter(Boolean)[0] || null;
  } else if (path === "/watch") {
    id = parsedUrl.searchParams.get("v");
  } else {
    const parts = path.split("/").filter(Boolean);
    const prefix = parts[0];
    if (prefix === "embed" || prefix === "shorts" || prefix === "live") {
      id = parts[1] || null;
    }
  }

  if (!id) return null;

  // YouTube video IDs are typically 11 chars. We keep this strict so we don't
  // accidentally turn channel/user URLs into embeds.
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;

  return id;
}

export function normalizeEmbedSrc(src: string): string {
  const formatted = ensureUrlHasProtocol(src.trim());
  if (!formatted) return formatted;

  try {
    const parsed = new URL(formatted);
    if (!isYouTubeHostname(parsed.hostname)) return formatted;

    // If it's a YouTube URL, always store our own canonical embed URL.
    const videoId = extractYouTubeVideoId(parsed);
    if (!videoId) return formatted;
    // Note: autoplay is intentionally NOT enabled by default.
    // If you later add an autoplay toggle, you'd typically apply `autoplay=1&mute=1`.
    const params = new URLSearchParams({
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
    });
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return formatted;
  }
}

export function createTile(
  type: ContentType,
  i: string,
  x: number,
  y: number,
  w: number,
  h: number,
  contentData: Partial<AnyTileContent> = {},
  caption: string,
): Tile {
  return {
    i,
    x,
    y,
    w,
    h,
    borderEnabled: true,
    content: createTileContent(type, contentData),
    caption,
  };
}

export function createTileContent(
  type: ContentType,
  data: Partial<AnyTileContent> = {},
): TileContent {
  const def = getTileDefinition(type);
  if (def) {
    return def.defaultContent(data as never);
  }
  throw new Error(`Unsupported content type: ${type}`);
}


export function validateTileContent(content: TileContent): boolean {
  const def = getTileDefinition(content.type);
  if (def) {
    return def.validate(content as never);
  }
  return false;
}

/**
 * Suggestion tiles are authoring scaffolding rather than content: they invite
 * the owner to fill a cell they are already occupying. Anyone who cannot edit
 * — a visitor on a shared URL, or the owner inside a read-only preview — sees
 * that cell as empty space instead, so preview and the public view agree by
 * construction.
 */
export function isHiddenSuggestion(tile: Tile, canEdit: boolean): boolean {
  return !canEdit && tile.content.type === ContentType.SUGGESTION;
}

export function getContentComponent(content: TileContent): Component | null {
  const def = getTileDefinition(content.type);
  if (!def) {
    throw new Error(`Unsupported content type: ${content.type}`);
  }
  if (content.type === ContentType.SUGGESTION) {
    return null; // rendered inline in GridTile
  }
  return markRaw(defineAsyncComponent(def.component));
}

export function getOptionComponent(content: TileContent): null {
  switch (content.type) {
    default:
      return null; // If no options are available
  }
}
