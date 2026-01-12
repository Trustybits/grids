import { type Tile } from "@/types/Tile";
import {
  ContentType,
  type TileContent,
  type TextContent,
  type ImageContent,
  type LinkContent,
  type VideoContent,
  type EmbedContent,
} from "@/types/TileContent";
import { defineAsyncComponent, markRaw } from "vue";

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
    TextContent | ImageContent | LinkContent | VideoContent | EmbedContent
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
      let linkData = getLinkData((data as Partial<LinkContent>).link || "");
      return {
        type,
        ...linkData,
      } as LinkContent;

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
        src: (data as Partial<EmbedContent>).src || "",
      } as EmbedContent;

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
    return null;
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
