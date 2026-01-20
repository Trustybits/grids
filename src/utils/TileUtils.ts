import { type Tile } from "@/types/Tile";
import {
  ContentType,
  type TileContent,
  type TextContent,
  type ImageContent,
  type LinkContent,
  type VideoContent,
  type EmbedContent,
  type SuggestionContent,
} from "@/types/TileContent";
import { defineAsyncComponent, markRaw } from "vue";

function ensureUrlHasProtocol(url: string): string {
  if (!url) return url;
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;
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

function normalizeEmbedSrc(src: string): string {
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
  contentData: Partial<any> = {},
  caption: string
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
  data: Partial<
    TextContent | ImageContent | LinkContent | VideoContent | EmbedContent | SuggestionContent
  > = {}
): TileContent {
  switch (type) {
    case ContentType.TEXT:
      return {
        type,
        text: (data as Partial<TextContent>).text || "",
        font: (data as Partial<TextContent>).font || "Arial",
        fontSize: (data as Partial<TextContent>).fontSize || 14,
        isBold: (data as Partial<TextContent>).isBold || false,
        isItalic: (data as Partial<TextContent>).isItalic || false,
        textType: (data as Partial<TextContent>).textType || "",
        color: (data as Partial<TextContent>).color || "#ffffff",
      } as TextContent;

    case ContentType.IMAGE:
      return {
        type,
        src: (data as Partial<ImageContent>).src || "",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as ImageContent;

    case ContentType.LINK:
      {
        const input = data as Partial<LinkContent>;
        const linkData = getLinkData(input.link || "");
        return {
          ...input,
          type,
          ...linkData,
        } as LinkContent;
      }

    case ContentType.VIDEO:
      return {
        type,
        src: (data as Partial<VideoContent>).src || "",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as VideoContent;

    case ContentType.EMBED:
      return {
        type,
        // For YouTube links, we normalize to an embeddable URL (watch/homepage URLs
        // often refuse to render in iframes due to X-Frame-Options).
        src: normalizeEmbedSrc((data as Partial<EmbedContent>).src || ""),
      } as EmbedContent;

    case ContentType.SUGGESTION:
      return {
        type,
        action: (data as Partial<SuggestionContent>).action || "text",
        icon: (data as Partial<SuggestionContent>).icon,
        label: (data as Partial<SuggestionContent>).label,
      } as SuggestionContent;

    default:
      throw new Error(`Unsupported content type: ${type}`);
  }
}

function getLinkData(url: string) {
  try {
    const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
    const parsedUrl = new URL(formattedUrl);

    let domain = parsedUrl.hostname;
    let faviconUrl = `https://s2.googleusercontent.com/s2/favicons?sz=64&domain_url=${parsedUrl.origin}`;
    let link = formattedUrl;

    return { domain, faviconUrl, link };
  } catch (error) {
    return {};
  }
}

export function validateTileContent(content: TileContent): boolean {
  switch (content.type) {
    case ContentType.TEXT:
      return (content as TextContent).text.trim().length > 0;
    case ContentType.IMAGE:
      const image = content as ImageContent;
      return (
        !!image.src &&
        (image.src.startsWith("http") || image.src.startsWith("data:"))
      );
    case ContentType.LINK:
      const link = content as LinkContent;
      return !!link.link && link.link.startsWith("http");
    case ContentType.VIDEO:
      const video = content as VideoContent;
      return (
        !!video.src &&
        (video.src.startsWith("http") || video.src.startsWith("data:"))
      );
    case ContentType.EMBED:
      const embed = content as EmbedContent;
      return !!embed.src && embed.src.startsWith("http");
    case ContentType.SUGGESTION:
      return true; // internal placeholder is always valid
    default:
      return false;
  }
}

export function getContentComponent(content: TileContent): any {
  switch (content.type) {
    case ContentType.TEXT:
      return markRaw(
        defineAsyncComponent(
          () => import("@/components/tilecontent/TextContent.vue")
        )
      );
    case ContentType.IMAGE:
      return markRaw(
        defineAsyncComponent(
          () => import("@/components/tilecontent/ImageContent.vue")
        )
      );
    case ContentType.LINK:
      return markRaw(
        defineAsyncComponent(
          () => import("@/components/tilecontent/LinkContent.vue")
        )
      );
    case ContentType.VIDEO:
      return markRaw(
        defineAsyncComponent(
          () => import("@/components/tilecontent/VideoContent.vue")
        )
      );
    case ContentType.EMBED:
      return markRaw(
        defineAsyncComponent(
          () => import("@/components/tilecontent/EmbedContent.vue")
        )
      );
    case ContentType.SUGGESTION:
      return null; // rendered inline in GridTile
    default:
      throw new Error(`Unsupported content type: ${content.type}`);
  }
}

export function getOptionComponent(content: TileContent): any | null {
  switch (content.type) {
    default:
      return null; // If no options are available
  }
}
