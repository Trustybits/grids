import { ContentType, type TileContent } from "@/types/TileContent";
import {
  createTileContent,
  createTileContentFromEmbedUrl,
} from "@/utils/TileUtils";

// Matches the ScrapedItem shape returned by the scrapePageForGrid Cloud Function.
export interface ScrapedItem {
  type:
    | "title"
    | "description"
    | "image"
    | "link"
    | "video"
    | "youtube"
    | "music"
    | "embed";
  text?: string;
  src?: string;
  url?: string;
  meta?: {
    title?: string;
    description?: string;
    faviconUrl?: string;
    imageUrl?: string;
    domain?: string;
  };
  priority: number;
}

export interface ScrapedPageResult {
  pageMeta: {
    title?: string;
    description?: string;
    faviconUrl?: string;
    ogImage?: string;
    siteName?: string;
    domain?: string;
  };
  items: ScrapedItem[];
}

interface TileDescriptor {
  content: TileContent;
  w: number;
  h: number;
}

function makeTiptapDoc(text: string, heading?: boolean): string {
  if (heading) {
    return JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text }],
        },
      ],
    });
  }
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

export function mapScrapedItemToTile(
  item: ScrapedItem,
  isHeroImage: boolean,
): TileDescriptor | null {
  switch (item.type) {
    case "title":
      if (!item.text) return null;
      return {
        content: createTileContent(ContentType.TEXT, {
          text: makeTiptapDoc(item.text, true),
        }),
        w: 4,
        h: 2,
      };

    case "description":
      if (!item.text) return null;
      return {
        content: createTileContent(ContentType.TEXT, {
          text: makeTiptapDoc(item.text),
        }),
        w: 4,
        h: 3,
      };

    case "image":
      if (!item.src) return null;
      return {
        content: createTileContent(ContentType.IMAGE, { src: item.src }),
        w: isHeroImage ? 5 : 3,
        h: isHeroImage ? 5 : 3,
      };

    case "link":
      if (!item.url) return null;
      return {
        content: createTileContent(ContentType.LINK, {
          link: item.url,
          metaTitle: item.meta?.title,
          metaDescription: item.meta?.description,
          faviconUrl: item.meta?.faviconUrl,
          domain: item.meta?.domain,
          linkBackgroundEnabled: true,
        }),
        w: 3,
        h: 2,
      };

    case "youtube":
      if (!item.url) return null;
      return {
        content: createTileContentFromEmbedUrl(item.url),
        w: 4,
        h: 3,
      };

    case "music":
      if (!item.url) return null;
      return {
        content: createTileContentFromEmbedUrl(item.url),
        w: 3,
        h: 2,
      };

    case "video":
      if (!item.src) return null;
      return {
        content: createTileContent(ContentType.VIDEO, { src: item.src }),
        w: 4,
        h: 3,
      };

    case "embed":
      if (!item.url) return null;
      return {
        content: createTileContentFromEmbedUrl(item.url),
        w: 4,
        h: 4,
      };

    default:
      return null;
  }
}

const STAGGER_DELAY_MS = 250;

/**
 * Progressively adds tiles to the current grid from scraped items.
 * Each tile is added with a stagger delay so the user sees them appear one by one.
 */
export function buildGridFromScrapedItems(
  items: ScrapedItem[],
  addTileWithSize: (content: TileContent, w: number, h: number) => string | null,
): Promise<void> {
  return new Promise((resolve) => {
    let isFirstImage = true;
    let i = 0;

    function addNext() {
      while (i < items.length) {
        const item = items[i];
        i++;

        const isHero = item.type === "image" && isFirstImage;
        if (item.type === "image") isFirstImage = false;

        const descriptor = mapScrapedItemToTile(item, isHero);
        if (!descriptor) continue;

        addTileWithSize(descriptor.content, descriptor.w, descriptor.h);

        if (i < items.length) {
          setTimeout(addNext, STAGGER_DELAY_MS);
        } else {
          resolve();
        }
        return;
      }
      resolve();
    }

    addNext();
  });
}
