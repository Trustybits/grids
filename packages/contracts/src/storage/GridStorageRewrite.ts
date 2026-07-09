import type { Grid } from "../types/Grid.js";
import type { Tile } from "../types/Tile.js";
import { ContentType } from "../types/TileContent.js";

export interface GridStorageRewriteTarget {
  oldHash?: string;
  oldUrl?: string;
  newHash: string;
  newUrl: string;
}

export type GridStorageRewriteMap = Record<string, GridStorageRewriteTarget>;

export interface GridStorageRewritePlan {
  rewriteMap?: GridStorageRewriteMap;
  removeBackgroundImage?: boolean;
}

type DuplicateRewrite = NonNullable<GridStorageRewritePlan["rewriteMap"]>[string];

const getRewriteForHash = (
  hash: unknown,
  storagePlan?: GridStorageRewritePlan,
): DuplicateRewrite | null => {
  if (typeof hash !== "string" || !hash) return null;
  return storagePlan?.rewriteMap?.[hash] ?? null;
};

export const rewriteTiptapImages = (
  text: string,
  storagePlan?: GridStorageRewritePlan,
): string => {
  if (!storagePlan?.rewriteMap) return text;
  try {
    const root = JSON.parse(text) as unknown;
    let changed = false;
    const visit = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const record = node as {
        type?: unknown;
        attrs?: { hash?: unknown; src?: unknown };
        content?: unknown;
      };
      if (record.type === "image" && record.attrs) {
        const rewrite = getRewriteForHash(record.attrs.hash, storagePlan);
        if (rewrite) {
          record.attrs.hash = rewrite.newHash;
          record.attrs.src = rewrite.newUrl;
          changed = true;
        }
      }
      if (Array.isArray(record.content)) {
        for (const child of record.content) visit(child);
      }
    };
    visit(root);
    return changed ? JSON.stringify(root) : text;
  } catch {
    return text;
  }
};

export const rewriteArchiveBackedContent = (
  tile: Tile,
  storagePlan?: GridStorageRewritePlan,
): Tile => {
  if (!storagePlan?.rewriteMap) return tile;
  const content = tile.content as unknown as Record<string, unknown>;
  switch (content.type) {
    case ContentType.IMAGE:
    case ContentType.VIDEO: {
      const rewrite = getRewriteForHash(content.srcHash, storagePlan);
      if (rewrite) {
        content.srcHash = rewrite.newHash;
        content.src = rewrite.newUrl;
      }
      break;
    }
    case ContentType.DOCUMENT:
      if (Array.isArray(content.items)) {
        content.items = content.items.map((item) => {
          if (!item || typeof item !== "object") return item;
          const next = { ...(item as Record<string, unknown>) };
          const rewrite = getRewriteForHash(next.hash, storagePlan);
          if (rewrite) {
            next.hash = rewrite.newHash;
            next.url = rewrite.newUrl;
          }
          return next;
        });
      }
      break;
    case ContentType.LINK: {
      const rewrite = getRewriteForHash(content.customImageHash, storagePlan);
      if (rewrite) {
        content.customImageHash = rewrite.newHash;
        content.customImageUrl = rewrite.newUrl;
      }
      break;
    }
    case ContentType.PROFILE: {
      const rewrite = getRewriteForHash(content.profilePhotoHash, storagePlan);
      if (rewrite) {
        content.profilePhotoHash = rewrite.newHash;
        content.profilePhotoUrl = rewrite.newUrl;
      }
      break;
    }
    case ContentType.SMART_TEXT:
      if (typeof content.text === "string") {
        content.text = rewriteTiptapImages(content.text, storagePlan);
      }
      break;
  }
  return tile;
};

export const rewriteBackgroundImage = (
  sourceGrid: Pick<Grid, "backgroundImageSrc" | "backgroundImageHash">,
  storagePlan?: GridStorageRewritePlan,
): Pick<Grid, "backgroundImageSrc" | "backgroundImageHash"> => {
  if (storagePlan?.removeBackgroundImage) {
    return {
      backgroundImageSrc: "",
      backgroundImageHash: "",
    };
  }
  const rewrite = getRewriteForHash(sourceGrid.backgroundImageHash, storagePlan);
  if (!rewrite) {
    return {
      backgroundImageSrc: sourceGrid.backgroundImageSrc || "",
      backgroundImageHash: sourceGrid.backgroundImageHash,
    };
  }
  return {
    backgroundImageSrc: rewrite.newUrl,
    backgroundImageHash: rewrite.newHash,
  };
};
