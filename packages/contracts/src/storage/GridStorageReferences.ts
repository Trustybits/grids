import type { Grid } from "../types/Grid.js";
import type {
  DocumentsContent,
  ImageContent,
  LinkContent,
  ProfileBioContent,
  SmartTextContent,
  VideoContent,
} from "../types/TileContent.js";
import { ContentType } from "../types/TileContent.js";
import type { UploadKind } from "../types/Storage.js";

export type GridStorageReferenceLocation =
  | "grid.backgroundImage"
  | "tile.image.src"
  | "tile.video.src"
  | "tile.document.item"
  | "tile.link.customImage"
  | "tile.profile.profilePhoto"
  | "tile.smartText.inlineImage";

export interface GridStorageReference {
  location: GridStorageReferenceLocation;
  tileId?: string;
  documentItemId?: string;
  url?: string;
  hash?: string;
  path?: string;
  ownerId: string;
  kind: UploadKind;
  source: "stored-hash" | "url-fallback";
}

const UPLOAD_KINDS = new Set<UploadKind>(["images", "videos", "documents"]);

export function extractGridStorageReferences(
  grid: Grid,
): GridStorageReference[] {
  const references: GridStorageReference[] = [];
  const ownerId = grid.userId;

  addReference(references, {
    location: "grid.backgroundImage",
    ownerId,
    kindHint: "images",
    url: grid.backgroundImageSrc,
    hash: grid.backgroundImageHash,
  });

  for (const tile of grid.tiles) {
    const content = tile.content;
    switch (content.type) {
      case ContentType.IMAGE: {
        const image = content as ImageContent;
        addReference(references, {
          location: "tile.image.src",
          tileId: tile.i,
          ownerId,
          kindHint: "images",
          url: image.src,
          hash: image.srcHash,
        });
        break;
      }
      case ContentType.VIDEO: {
        const video = content as VideoContent;
        addReference(references, {
          location: "tile.video.src",
          tileId: tile.i,
          ownerId,
          kindHint: "videos",
          url: video.src,
          hash: video.srcHash,
        });
        break;
      }
      case ContentType.DOCUMENT: {
        const documents = content as DocumentsContent;
        for (const item of documents.items ?? []) {
          addReference(references, {
            location: "tile.document.item",
            tileId: tile.i,
            documentItemId: item.id,
            ownerId,
            kindHint: "documents",
            url: item.url,
            hash: item.hash,
          });
        }
        break;
      }
      case ContentType.LINK: {
        const link = content as LinkContent;
        addReference(references, {
          location: "tile.link.customImage",
          tileId: tile.i,
          ownerId,
          kindHint: "images",
          url: link.customImageUrl,
          hash: link.customImageHash,
        });
        break;
      }
      case ContentType.PROFILE: {
        const profile = content as ProfileBioContent;
        addReference(references, {
          location: "tile.profile.profilePhoto",
          tileId: tile.i,
          ownerId,
          kindHint: "images",
          url: profile.profilePhotoUrl,
          hash: profile.profilePhotoHash,
        });
        break;
      }
      case ContentType.SMART_TEXT: {
        const smartText = content as SmartTextContent;
        for (const url of extractSmartTextImageUrls(smartText.text)) {
          addReference(references, {
            location: "tile.smartText.inlineImage",
            tileId: tile.i,
            ownerId,
            kindHint: "images",
            url,
          });
        }
        break;
      }
    }
  }

  return references;
}

function addReference(
  references: GridStorageReference[],
  input: {
    location: GridStorageReferenceLocation;
    ownerId: string;
    kindHint: UploadKind;
    tileId?: string;
    documentItemId?: string;
    url?: string;
    hash?: string;
  },
) {
  const hash = normalizeHash(input.hash);
  const parsed = parseUserUploadPath(input.url);
  const parsedForOwner = parsed?.ownerId === input.ownerId ? parsed : null;

  if (hash) {
    references.push({
      location: input.location,
      tileId: input.tileId,
      documentItemId: input.documentItemId,
      url: safeUrl(input.url),
      hash,
      path: parsedForOwner?.path,
      ownerId: input.ownerId,
      kind: parsedForOwner?.kind ?? input.kindHint,
      source: "stored-hash",
    });
    return;
  }

  if (!parsedForOwner) return;

  references.push({
    location: input.location,
    tileId: input.tileId,
    documentItemId: input.documentItemId,
    url: input.url,
    hash: parsedForOwner.hash,
    path: parsedForOwner.path,
    ownerId: input.ownerId,
    kind: parsedForOwner.kind,
    source: "url-fallback",
  });
}

function normalizeHash(hash: string | undefined): string | undefined {
  const trimmed = hash?.trim();
  return trimmed ? trimmed : undefined;
}

function safeUrl(url: string | undefined): string | undefined {
  if (!url || isTransientUrl(url)) return undefined;
  return url;
}

function isTransientUrl(url: string): boolean {
  return url.startsWith("blob:") || url.startsWith("data:");
}

function parseUserUploadPath(
  url: string | undefined,
): { ownerId: string; kind: UploadKind; path: string; hash?: string } | null {
  if (!url || isTransientUrl(url)) return null;

  const path = extractStoragePath(url);
  if (!path) return null;

  const parts = path.split("/");
  if (parts.length !== 4 || parts[0] !== "users") return null;

  const kind = parts[2] as UploadKind;
  if (!UPLOAD_KINDS.has(kind)) return null;

  const fileName = parts[3];
  const dot = fileName.lastIndexOf(".");
  const hash = dot > 0 ? fileName.slice(0, dot) : fileName;

  return {
    ownerId: parts[1] ?? "",
    kind,
    path,
    hash: hash || undefined,
  };
}

function extractStoragePath(url: string): string | null {
  if (url.startsWith("users/")) return url;
  if (url.startsWith("gs://")) {
    const pathStart = url.indexOf("/", "gs://".length);
    return pathStart >= 0 ? url.slice(pathStart + 1) : null;
  }

  try {
    const parsed = new URL(url);
    const objectMarker = "/o/";
    const objectIndex = parsed.pathname.indexOf(objectMarker);
    if (objectIndex >= 0) {
      return decodeURIComponent(parsed.pathname.slice(objectIndex + objectMarker.length));
    }
    return parsed.pathname.startsWith("/users/")
      ? parsed.pathname.slice(1)
      : null;
  } catch {
    return null;
  }
}

function extractSmartTextImageUrls(text: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  const urls: string[] = [];
  visitTiptapNode(parsed, urls);
  return urls;
}

function visitTiptapNode(value: unknown, urls: string[]) {
  if (!value || typeof value !== "object") return;

  const node = value as {
    type?: unknown;
    attrs?: { src?: unknown };
    content?: unknown;
  };
  if (node.type === "image" && typeof node.attrs?.src === "string") {
    urls.push(node.attrs.src);
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      visitTiptapNode(child, urls);
    }
  }
}
