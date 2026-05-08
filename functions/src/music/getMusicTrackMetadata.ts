import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";

// ── Music Track Metadata (Spotify / Apple Music) ───────────────────────────

/**
 * Helper: fetch a URL and return its text body.
 */
async function fetchText(urlStr: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const body = await res.text();
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Convert a Spotify RGBA color object to an rgba() CSS string.
 */
function toRgba(c: { red: number; green: number; blue: number; alpha?: number }): string {
  const a = c.alpha ?? 1;
  return `rgba(${c.red}, ${c.green}, ${c.blue}, ${a})`;
}

/**
 * Darken a hex color by a factor (0–1). Returns hex string.
 */
function darkenHex(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * (1 - factor));
  const g = Math.round(parseInt(h.substring(2, 4), 16) * (1 - factor));
  const b = Math.round(parseInt(h.substring(4, 6), 16) * (1 - factor));
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

/**
 * Lighten an RGB triplet by a factor. Returns rgba() string.
 */
function lightenRgb(r: number, g: number, b: number, factor: number): string {
  const lr = Math.min(255, Math.round(r + (255 - r) * factor));
  const lg = Math.min(255, Math.round(g + (255 - g) * factor));
  const lb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `rgba(${lr}, ${lg}, ${lb}, 1)`;
}

/**
 * Scrape Apple Music embed page for background hex color.
 */
async function scrapeAppleEmbedColors(songId: string): Promise<string | null> {
  try {
    const html = await fetchText(`https://embed.music.apple.com/us/song/${songId}`);
    const hexMatch = html.match(/#([0-9a-fA-F]{6})\b/);
    return hexMatch ? hexMatch[1] : null;
  } catch {
    return null;
  }
}

/**
 * Cloud Function to fetch music track metadata from Spotify or Apple Music.
 * Scrapes embed pages / iTunes API for track details and color palette.
 */
export const getMusicTrackMetadata = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to fetch music metadata.");
  }

  const { platform, trackId, trackType } = data as { platform?: string; trackId?: string; trackType?: string };

  if (!platform || !trackId) {
    throw new HttpsError("invalid-argument", "Missing platform or trackId.");
  }

  if (platform !== "spotify" && platform !== "apple") {
    throw new HttpsError("invalid-argument", `Unsupported platform: ${platform}`);
  }

  try {
    if (platform === "spotify") {
      // ── Spotify ──────────────────────────────────────────────────────
      // For album IDs, fetch the album embed and extract the first track entity
      const isAlbum = trackType === "album";
      const embedUrl = isAlbum
        ? `https://open.spotify.com/embed/album/${trackId}`
        : `https://open.spotify.com/embed/track/${trackId}`;
      const body = await fetchText(embedUrl);

      const scriptMatch = body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!scriptMatch) {
        throw new HttpsError("not-found", "Could not parse Spotify embed data.");
      }

      const nextData = JSON.parse(scriptMatch[1]);
      const pageEntity = nextData?.props?.pageProps?.state?.data?.entity;
      if (!pageEntity) {
        throw new HttpsError("not-found", "Entity not found in Spotify data.");
      }

      // For albums, use the first track as the representative entity
      const entity = isAlbum
        ? (pageEntity.tracks?.items?.[0] ?? pageEntity)
        : pageEntity;

      const vi = pageEntity.visualIdentity || {};
      const artists = entity.artists || pageEntity.artists || [];
      const artistId = artists[0]?.uri?.split(":").pop() || "";
      const trackEntityId = entity.id || entity.uri?.split(":").pop() || trackId;

      return {
        trackName: entity.name || pageEntity.name || "",
        artistName: artists.map((a: { name?: string }) => a.name).join(", ") || "",
        albumArt: vi.image?.[0]?.url ?? "",
        previewUrl: entity.audioPreview?.url ?? pageEntity.audioPreview?.url ?? "",
        trackUrl: isAlbum
          ? `https://open.spotify.com/album/${trackId}`
          : `https://open.spotify.com/track/${trackEntityId}`,
        artistUrl: artistId ? `https://open.spotify.com/artist/${artistId}` : "",
        backgroundColor: vi.backgroundBase ? toRgba(vi.backgroundBase) : "rgba(30, 30, 30, 1)",
        backgroundTinted: vi.backgroundTintedBase ? toRgba(vi.backgroundTintedBase) : "rgba(50, 50, 50, 1)",
        textSubdued: vi.textSubdued ? toRgba(vi.textSubdued) : "rgba(180, 180, 180, 1)",
      };
    } else {
      // ── Apple Music ──────────────────────────────────────────────────
      const itunesUrl = `https://itunes.apple.com/lookup?id=${trackId}&entity=song`;
      const itunesBody = await fetchText(itunesUrl);
      const itunesData = JSON.parse(itunesBody);
      const track = itunesData?.results?.[0];

      if (!track) {
        throw new HttpsError("not-found", "Track not found in iTunes lookup.");
      }

      const albumArt = (track.artworkUrl100 || "").replace("100x100bb", "600x600bb");

      // Scrape embed page for color
      const bgHex = await scrapeAppleEmbedColors(trackId);

      let backgroundColor = "rgba(30, 30, 30, 1)";
      let backgroundTinted = "rgba(50, 50, 50, 1)";
      let textSubdued = "rgba(180, 180, 180, 1)";

      if (bgHex) {
        const r = parseInt(bgHex.substring(0, 2), 16);
        const g = parseInt(bgHex.substring(2, 4), 16);
        const b = parseInt(bgHex.substring(4, 6), 16);
        backgroundColor = `rgba(${r}, ${g}, ${b}, 1)`;
        backgroundTinted = darkenHex(bgHex, 0.15);
        textSubdued = lightenRgb(r, g, b, 0.45);
      }

      return {
        trackName: track.trackName || track.collectionName || "",
        artistName: track.artistName || "",
        albumArt,
        previewUrl: track.previewUrl || "",
        trackUrl: track.trackViewUrl || `https://music.apple.com/us/song/${trackId}`,
        artistUrl: track.artistViewUrl || "",
        backgroundColor,
        backgroundTinted,
        textSubdued,
      };
    }
  } catch (error: unknown) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Failed to fetch music track metadata", {
      error: String(error),
      platform,
      trackId,
    });
    throw new HttpsError("internal", "Failed to fetch music track metadata.");
  }
});
