// Scope boundary: this module is the RUNTIME archive-reference extractor used
// for refCount reconciliation, quota, and grid duplication. It resolves only
// the canonical scheme — a stored SHA-256 hash, or a URL pointing at a
// canonical `users/{uid}/{kind}/{sha256}.{ext}` object whose hash field is
// missing. It intentionally skips pre-migration original-filename objects
// (e.g. `users/{uid}/images/my-photo.png`), which carry no archive doc and
// cannot be a valid refCount key until backfilled.
//
// This is NOT the migration inventory. The Phase 7 backfill (see
// `notes/storage-refactor-implementation-plan.md`) is a separate concern: it
// reads object bytes, stream-hashes them, creates `users/{uid}/uploads/{hash}`,
// and rewrites grids into the canonical scheme. It must handle legacy paths
// this extractor ignores. Web rendering / read-tolerance is also separate — it
// renders the raw `src`/`url` field directly and never goes through here — so
// keeping legacy content displayable does not depend on this module.

import type { Grid } from "../types/Grid.js";
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

/**
 * A single archive-backed file reference found inside a grid.
 *
 * `hash` is always a validated lowercase SHA-256 digest and is the
 * authoritative key into `users/{ownerId}/uploads/{hash}`. References whose
 * hash cannot be resolved (external URLs, transient blob/data URLs, legacy
 * original-filename paths, or another owner's files) are omitted entirely, so
 * every returned reference is safe to use as a refCount / archive lookup key.
 */
export interface GridStorageReference {
  location: GridStorageReferenceLocation;
  tileId?: string;
  documentItemId?: string;
  url?: string;
  hash: string;
  path?: string;
  ownerId: string;
  kind: UploadKind;
  source: "stored-hash" | "url-fallback";
}

const UPLOAD_KINDS = new Set<UploadKind>(["images", "videos", "documents"]);
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;

/**
 * Permissive view of a grid document. Typed callers pass a real {@link Grid};
 * server callers pass raw Firestore snapshot data. Every field is treated as
 * `unknown` and guarded, so malformed documents never throw.
 */
type GridRecordLike = {
  userId?: unknown;
  backgroundImageSrc?: unknown;
  backgroundImageHash?: unknown;
  tiles?: unknown;
};

/**
 * Extract archive-backed storage references from a fully-typed {@link Grid}.
 * Intended for web/migration callers that already hold a domain object.
 */
export function extractGridStorageReferences(
  grid: Grid,
): GridStorageReference[] {
  return extractReferences(grid as unknown as GridRecordLike);
}

/**
 * Extract archive-backed storage references from raw grid document data (e.g. a
 * Firestore `snapshot.data()`), tolerating missing or malformed fields.
 * Behaves identically to {@link extractGridStorageReferences} on well-formed
 * input.
 */
export function extractGridStorageReferencesFromRecord(
  record: unknown,
): GridStorageReference[] {
  if (!record || typeof record !== "object") return [];
  return extractReferences(record as GridRecordLike);
}

/**
 * Count how many times each archive hash is referenced. The result is the
 * per-hash reference multiset used to reconcile `refCount` deltas.
 */
export function countReferencesByHash(
  references: GridStorageReference[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const reference of references) {
    counts.set(reference.hash, (counts.get(reference.hash) ?? 0) + 1);
  }
  return counts;
}

function extractReferences(grid: GridRecordLike): GridStorageReference[] {
  if (typeof grid.userId !== "string") return [];
  const ownerId = grid.userId;
  const references: GridStorageReference[] = [];

  addReference(references, {
    location: "grid.backgroundImage",
    ownerId,
    kindHint: "images",
    url: grid.backgroundImageSrc,
    hash: grid.backgroundImageHash,
  });

  if (!Array.isArray(grid.tiles)) return references;

  for (const tile of grid.tiles) {
    if (!tile || typeof tile !== "object") continue;
    const tileRecord = tile as { i?: unknown; content?: unknown };
    const tileId = typeof tileRecord.i === "string" ? tileRecord.i : undefined;
    const content = tileRecord.content;
    if (!content || typeof content !== "object") continue;
    const c = content as Record<string, unknown>;

    switch (c.type) {
      case ContentType.IMAGE:
        addReference(references, {
          location: "tile.image.src",
          tileId,
          ownerId,
          kindHint: "images",
          url: c.src,
          hash: c.srcHash,
        });
        break;
      case ContentType.VIDEO:
        addReference(references, {
          location: "tile.video.src",
          tileId,
          ownerId,
          kindHint: "videos",
          url: c.src,
          hash: c.srcHash,
        });
        break;
      case ContentType.DOCUMENT:
        if (Array.isArray(c.items)) {
          for (const item of c.items) {
            if (!item || typeof item !== "object") continue;
            const itemRecord = item as Record<string, unknown>;
            addReference(references, {
              location: "tile.document.item",
              tileId,
              documentItemId:
                typeof itemRecord.id === "string" ? itemRecord.id : undefined,
              ownerId,
              kindHint: "documents",
              url: itemRecord.url,
              hash: itemRecord.hash,
            });
          }
        }
        break;
      case ContentType.LINK:
        addReference(references, {
          location: "tile.link.customImage",
          tileId,
          ownerId,
          kindHint: "images",
          url: c.customImageUrl,
          hash: c.customImageHash,
        });
        break;
      case ContentType.PROFILE:
        addReference(references, {
          location: "tile.profile.profilePhoto",
          tileId,
          ownerId,
          kindHint: "images",
          url: c.profilePhotoUrl,
          hash: c.profilePhotoHash,
        });
        break;
      case ContentType.SMART_TEXT:
        if (typeof c.text === "string") {
          for (const url of extractSmartTextImageUrls(c.text)) {
            addReference(references, {
              location: "tile.smartText.inlineImage",
              tileId,
              ownerId,
              kindHint: "images",
              url,
            });
          }
        }
        break;
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
    url?: unknown;
    hash?: unknown;
  },
) {
  const url = typeof input.url === "string" ? input.url : undefined;
  const hash = normalizeStoredHash(input.hash);
  const parsed = parseCanonicalUploadPath(url);
  const parsedForOwner = parsed?.ownerId === input.ownerId ? parsed : null;

  if (hash) {
    references.push({
      location: input.location,
      tileId: input.tileId,
      documentItemId: input.documentItemId,
      url: safeUrl(url),
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
    url,
    hash: parsedForOwner.hash,
    path: parsedForOwner.path,
    ownerId: input.ownerId,
    kind: parsedForOwner.kind,
    source: "url-fallback",
  });
}

function normalizeStoredHash(hash: unknown): string | null {
  if (typeof hash !== "string") return null;
  const trimmed = hash.trim().toLowerCase();
  return SHA256_HEX_RE.test(trimmed) ? trimmed : null;
}

function safeUrl(url: string | undefined): string | undefined {
  if (!url || isTransientUrl(url)) return undefined;
  return url;
}

function isTransientUrl(url: string): boolean {
  return url.startsWith("blob:") || url.startsWith("data:");
}

/**
 * Resolve a canonical `users/{uid}/{kind}/{sha256}.{ext}` reference from a
 * stored path, `gs://` URI, or Firebase download URL. Only canonical
 * SHA-256-named objects resolve; legacy original-filename paths return `null`
 * (they carry no archive doc and are handled by migration/backfill).
 */
function parseCanonicalUploadPath(
  url: string | undefined,
): { ownerId: string; kind: UploadKind; path: string; hash: string } | null {
  if (!url || isTransientUrl(url)) return null;

  const path = extractStoragePath(url);
  if (!path) return null;

  const parts = path.split("/");
  if (parts.length !== 4 || parts[0] !== "users") return null;

  const ownerId = parts[1];
  const kind = parts[2] as UploadKind;
  if (!ownerId || !UPLOAD_KINDS.has(kind)) return null;

  const fileName = parts[3];
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return null;
  const hash = fileName.slice(0, dot).toLowerCase();
  if (!SHA256_HEX_RE.test(hash)) return null;

  return { ownerId, kind, path, hash };
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
      return decodeURIComponent(
        parsed.pathname.slice(objectIndex + objectMarker.length),
      );
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
