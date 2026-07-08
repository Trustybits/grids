/**
 * Pure (I/O-free, side-effect-free) helpers for the storage migration script
 * (`storageMigration.ts`). Kept in a separate module so the legacy-aware
 * reference resolution, grid rewriting, object classification, and reference
 * matching can be unit-tested without initializing Firebase Admin or running
 * the CLI's `main()`.
 *
 * Unlike the runtime extractor in
 * `@grids/contracts/storage/GridStorageReferences`, this walker is
 * migration-aware: it resolves BOTH canonical (`{sha256}.{ext}`) and legacy
 * (original-filename) objects, and it knows about the `link-images/` folder
 * (whose objects migrate into the canonical `images/` scheme).
 */

import type { UploadKind } from "../storage/utils_uploadPaths.js";

/** Firestore marker written to every grid the migration rewrites. */
export const STORAGE_SCHEMA_REV = 1;

export const SHA256_HEX_RE = /^[a-f0-9]{64}$/;
export const EXT_RE = /^[a-z0-9][a-z0-9-]{0,15}$/;

export type Folder = "images" | "videos" | "documents" | "link-images";
export const ARCHIVE_FOLDERS = new Set<Folder>([
  "images",
  "videos",
  "documents",
  "link-images",
]);

/** Best-effort content-type → extension fallback for legacy objects whose
 *  filename carries no usable extension. */
export const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

// ── Reference resolution (legacy-aware) ──────────────────────────────────────

export interface ResolvedStorageRef {
  url: string;
  /** `users/{uid}/{folder}/{filename}` */
  path: string;
  uid: string;
  folder: Folder;
  /** Canonical destination kind (link-images collapse into images). */
  canonicalKind: UploadKind;
  filename: string;
  ext: string;
  isCanonical: boolean;
  /** Present only when the object is already canonically named. */
  hash?: string;
}

export interface MigrationTarget {
  newUrl: string;
  newHash: string;
  newPath: string;
}

/**
 * Key for the cross-user (foreign-owner) migration map. A foreign reference is
 * a grid owned by one user pointing at another user's storage object; the copy
 * destination depends on BOTH the grid owner (who gets the copy) and the source
 * path (what is copied), because the same source can be copied into different
 * owners' spaces. Keyed by (gridOwner, sourcePath). The NUL separator cannot
 * appear in a uid or a storage path, so the join is unambiguous.
 */
export function foreignMigrationKey(owner: string, sourcePath: string): string {
  return `${owner}\u0000${sourcePath}`;
}

/** One archive-backed reference discovered inside a grid. */
export interface CollectedRef {
  location: string;
  tileId?: string;
  documentItemId?: string;
  storedHash?: string;
  rawUrl?: string;
  resolved: ResolvedStorageRef | null;
  /** True when the URL resolved to a user path owned by someone else. */
  ownerMismatch: boolean;
}

export interface ProcessResult {
  collected: CollectedRef[];
  changed: boolean;
  newTiles: unknown[];
  newBackgroundSrc: unknown;
  newBackgroundHash: unknown;
  /** Human-readable descriptions of the rewrites applied (for reporting). */
  rewrites: string[];
}

export interface ClassifiedObject {
  path: string;
  size: number;
  uid: string;
  folder: Folder;
  isCanonical: boolean;
  hash?: string;
}

/** Pull the storage object path out of a stored path / gs:// / download URL.
 *  Mirrors the contracts extractor, but does not require a canonical name. */
export function extractStoragePath(url: string): string | null {
  if (url.startsWith("users/")) return url;
  if (url.startsWith("gs://")) {
    const pathStart = url.indexOf("/", "gs://".length);
    return pathStart >= 0 ? url.slice(pathStart + 1) : null;
  }
  try {
    const parsed = new URL(url);
    const marker = "/o/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
    }
    return parsed.pathname.startsWith("/users/")
      ? parsed.pathname.slice(1)
      : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a stored URL/path into a user-owned archive-folder reference, or null
 * when it is not a user file (external, blob/data, thumbnail, OG image, an
 * object outside the four archive folders, or malformed). Foreign-owner
 * references (uid !== the grid owner) still resolve; the caller decides.
 */
export function resolveStorageRef(rawUrl: unknown): ResolvedStorageRef | null {
  if (typeof rawUrl !== "string" || !rawUrl) return null;
  if (rawUrl.startsWith("blob:") || rawUrl.startsWith("data:")) return null;

  const objectPath = extractStoragePath(rawUrl);
  if (!objectPath) return null;

  const parts = objectPath.split("/");
  if (parts.length !== 4 || parts[0] !== "users") return null;

  const uid = parts[1];
  const folder = parts[2] as Folder;
  const filename = parts[3];
  if (!uid || !filename || !ARCHIVE_FOLDERS.has(folder)) return null;

  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
  const isCanonical = SHA256_HEX_RE.test(base.toLowerCase());

  return {
    url: rawUrl,
    path: objectPath,
    uid,
    folder,
    canonicalKind: folder === "link-images" ? "images" : folder,
    filename,
    ext,
    isCanonical,
    hash: isCanonical ? base.toLowerCase() : undefined,
  };
}

function toLowerHash(value: unknown): string | undefined {
  return typeof value === "string" && value ? value.toLowerCase() : undefined;
}

/**
 * Walk a grid's archive-backed fields. Collects every reference; when
 * `migrationMap` is supplied, produces a deep-cloned tiles array + background
 * fields with legacy references rewritten to canonical URL/hash and missing
 * canonical hash fields backfilled. Never mutates the input.
 */
export function processGrid(
  gridData: Record<string, unknown>,
  migrationMap?: Map<string, MigrationTarget>,
  foreignMigrationMap?: Map<string, MigrationTarget>,
): ProcessResult {
  const owner = typeof gridData.userId === "string" ? gridData.userId : "";
  const collected: CollectedRef[] = [];
  const rewrites: string[] = [];
  let changed = false;

  const rawTiles = Array.isArray(gridData.tiles) ? gridData.tiles : [];
  const tiles = migrationMap
    ? (structuredClone(rawTiles) as unknown[])
    : (rawTiles as unknown[]);

  let backgroundSrc = gridData.backgroundImageSrc;
  let backgroundHash = gridData.backgroundImageHash;

  const handleSlot = (opts: {
    location: string;
    tileId?: string;
    documentItemId?: string;
    rawUrl: unknown;
    storedHash: unknown;
    setUrl?: (v: string) => void;
    setHash?: (v: string) => void;
  }): void => {
    const storedHash = toLowerHash(opts.storedHash);
    const resolved = resolveStorageRef(opts.rawUrl);
    const ownerMismatch = resolved != null && resolved.uid !== owner;

    collected.push({
      location: opts.location,
      tileId: opts.tileId,
      documentItemId: opts.documentItemId,
      storedHash,
      rawUrl: typeof opts.rawUrl === "string" ? opts.rawUrl : undefined,
      // Keep the resolution even on owner mismatch: callers need the path/hash
      // to protect the (foreign) object from GC. `ownerMismatch` gates rewrites.
      resolved,
      ownerMismatch,
    });

    if (!migrationMap || !resolved) return;

    // Foreign-owner reference: the object lives under another user's uid. Rewrite
    // only to a cross-user copy target created for THIS grid owner; never backfill
    // the foreign object's hash into this owner's grid.
    if (ownerMismatch) {
      const foreignTarget = foreignMigrationMap?.get(
        foreignMigrationKey(owner, resolved.path),
      );
      if (foreignTarget && opts.setUrl && opts.setHash) {
        opts.setUrl(foreignTarget.newUrl);
        opts.setHash(foreignTarget.newHash);
        changed = true;
        rewrites.push(
          `${opts.location}${opts.tileId ? ` [${opts.tileId}]` : ""}: ` +
            `${resolved.path} → ${foreignTarget.newPath} (cross-user copy)`,
        );
      }
      return;
    }

    const target = migrationMap.get(resolved.path);
    if (target && opts.setUrl && opts.setHash) {
      opts.setUrl(target.newUrl);
      opts.setHash(target.newHash);
      changed = true;
      rewrites.push(
        `${opts.location}${opts.tileId ? ` [${opts.tileId}]` : ""}: ` +
          `${resolved.path} → ${target.newPath}`,
      );
    } else if (
      resolved.isCanonical &&
      resolved.hash &&
      storedHash !== resolved.hash &&
      opts.setHash
    ) {
      // Backfill a missing hash, or repair a stale/wrong one to match the
      // canonical object the URL actually points at. The URL is the source of
      // truth (it is what renders); a divergent stored hash would make refCount
      // reconciliation track a hash nothing renders.
      opts.setHash(resolved.hash);
      changed = true;
      rewrites.push(
        `${opts.location}${opts.tileId ? ` [${opts.tileId}]` : ""}: ` +
          `${storedHash ? `repaired hash ${resolved.hash} (was ${storedHash})` : `backfilled hash ${resolved.hash}`}`,
      );
    }
  };

  handleSlot({
    location: "grid.backgroundImage",
    rawUrl: backgroundSrc,
    storedHash: backgroundHash,
    setUrl: (v) => {
      backgroundSrc = v;
    },
    setHash: (v) => {
      backgroundHash = v;
    },
  });

  for (const tile of tiles) {
    if (!tile || typeof tile !== "object") continue;
    const tileRecord = tile as { i?: unknown; content?: unknown };
    const tileId = typeof tileRecord.i === "string" ? tileRecord.i : undefined;
    const content = tileRecord.content;
    if (!content || typeof content !== "object") continue;
    const c = content as Record<string, unknown>;

    switch (c.type) {
      case "image":
        handleSlot({
          location: "tile.image.src",
          tileId,
          rawUrl: c.src,
          storedHash: c.srcHash,
          setUrl: (v) => {
            c.src = v;
          },
          setHash: (v) => {
            c.srcHash = v;
          },
        });
        break;
      case "video":
        handleSlot({
          location: "tile.video.src",
          tileId,
          rawUrl: c.src,
          storedHash: c.srcHash,
          setUrl: (v) => {
            c.src = v;
          },
          setHash: (v) => {
            c.srcHash = v;
          },
        });
        break;
      case "document":
        if (Array.isArray(c.items)) {
          for (const item of c.items) {
            if (!item || typeof item !== "object") continue;
            const it = item as Record<string, unknown>;
            handleSlot({
              location: "tile.document.item",
              tileId,
              documentItemId: typeof it.id === "string" ? it.id : undefined,
              rawUrl: it.url,
              storedHash: it.hash,
              setUrl: (v) => {
                it.url = v;
              },
              setHash: (v) => {
                it.hash = v;
              },
            });
          }
        }
        break;
      case "link":
        handleSlot({
          location: "tile.link.customImage",
          tileId,
          rawUrl: c.customImageUrl,
          storedHash: c.customImageHash,
          setUrl: (v) => {
            c.customImageUrl = v;
          },
          setHash: (v) => {
            c.customImageHash = v;
          },
        });
        break;
      case "profile":
        handleSlot({
          location: "tile.profile.profilePhoto",
          tileId,
          rawUrl: c.profilePhotoUrl,
          storedHash: c.profilePhotoHash,
          setUrl: (v) => {
            c.profilePhotoUrl = v;
          },
          setHash: (v) => {
            c.profilePhotoHash = v;
          },
        });
        break;
      case "smart_text":
        if (typeof c.text === "string") {
          const result = processSmartText(
            c.text,
            owner,
            tileId,
            collected,
            migrationMap,
            foreignMigrationMap,
          );
          if (result.changed) {
            c.text = result.text;
            changed = true;
            rewrites.push(...result.rewrites);
          }
        }
        break;
    }
  }

  return {
    collected,
    changed,
    newTiles: tiles,
    newBackgroundSrc: backgroundSrc,
    newBackgroundHash: backgroundHash,
    rewrites,
  };
}

interface SmartTextResult {
  changed: boolean;
  text: string;
  rewrites: string[];
}

/** Collect (and optionally rewrite) inline images inside a Tiptap JSON blob. */
function processSmartText(
  text: string,
  owner: string,
  tileId: string | undefined,
  collected: CollectedRef[],
  migrationMap?: Map<string, MigrationTarget>,
  foreignMigrationMap?: Map<string, MigrationTarget>,
): SmartTextResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { changed: false, text, rewrites: [] };
  }

  const rewrites: string[] = [];
  let changed = false;

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as {
      type?: unknown;
      attrs?: { src?: unknown; hash?: unknown };
      content?: unknown;
    };
    if (n.type === "image" && n.attrs && typeof n.attrs.src === "string") {
      const storedHash = toLowerHash(n.attrs.hash);
      const resolved = resolveStorageRef(n.attrs.src);
      const ownerMismatch = resolved != null && resolved.uid !== owner;
      collected.push({
        location: "tile.smartText.inlineImage",
        tileId,
        storedHash,
        rawUrl: n.attrs.src,
        // Keep the resolution even on owner mismatch: callers need the path/hash
      // to protect the (foreign) object from GC. `ownerMismatch` gates rewrites.
      resolved,
        ownerMismatch,
      });

      if (resolved && ownerMismatch) {
        // Foreign inline image: rewrite only to a cross-user copy made for this
        // grid owner; never backfill the foreign object's hash.
        const foreignTarget = foreignMigrationMap?.get(
          foreignMigrationKey(owner, resolved.path),
        );
        if (foreignTarget) {
          n.attrs.src = foreignTarget.newUrl;
          n.attrs.hash = foreignTarget.newHash;
          changed = true;
          rewrites.push(
            `tile.smartText.inlineImage${tileId ? ` [${tileId}]` : ""}: ` +
              `${resolved.path} → ${foreignTarget.newPath} (cross-user copy)`,
          );
        }
      } else if (migrationMap && resolved && !ownerMismatch) {
        const target = migrationMap.get(resolved.path);
        if (target) {
          n.attrs.src = target.newUrl;
          n.attrs.hash = target.newHash;
          changed = true;
          rewrites.push(
            `tile.smartText.inlineImage${tileId ? ` [${tileId}]` : ""}: ` +
              `${resolved.path} → ${target.newPath}`,
          );
        } else if (resolved.isCanonical && resolved.hash && storedHash !== resolved.hash) {
          // Backfill missing / repair stale hash to match the canonical URL.
          n.attrs.hash = resolved.hash;
          changed = true;
          rewrites.push(
            `tile.smartText.inlineImage${tileId ? ` [${tileId}]` : ""}: ` +
              `${storedHash ? `repaired hash ${resolved.hash} (was ${storedHash})` : `backfilled hash ${resolved.hash}`}`,
          );
        }
      }
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) visit(child);
    }
  };

  visit(parsed);
  return { changed, text: changed ? JSON.stringify(parsed) : text, rewrites };
}

// ── Object classification & reference matching ───────────────────────────────

/** Classify a `users/...` object, or null if it is not an archive-folder file. */
export function classifyObject(obj: {
  path: string;
  size: number;
}): ClassifiedObject | null {
  const parts = obj.path.split("/");
  if (parts.length !== 4 || parts[0] !== "users") return null;
  const uid = parts[1];
  const folder = parts[2] as Folder;
  const filename = parts[3];
  if (!uid || !filename || !ARCHIVE_FOLDERS.has(folder)) return null;
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const isCanonical = SHA256_HEX_RE.test(base.toLowerCase());
  return {
    path: obj.path,
    size: obj.size,
    uid,
    folder,
    isCanonical,
    hash: isCanonical ? base.toLowerCase() : undefined,
  };
}

/**
 * True when a storage object is referenced by a grid: either its exact path is
 * pointed at, or (for canonical objects) its content hash is referenced by the
 * same owner.
 */
export function isObjectReferenced(
  cls: ClassifiedObject,
  referencedPaths: Set<string>,
  referencedHashes: Map<string, Set<string>>,
): boolean {
  if (referencedPaths.has(cls.path)) return true;
  if (cls.isCanonical && cls.hash) {
    return referencedHashes.get(cls.uid)?.has(cls.hash) === true;
  }
  return false;
}

// ── Migration field helpers ──────────────────────────────────────────────────

/** Map a raw legacy extension (or content-type) to a safe canonical ext. */
export function resolveExtension(
  rawExt: string,
  contentType: string,
): string | null {
  const ext = rawExt.trim().toLowerCase().replace(/^\./, "");
  if (EXT_RE.test(ext)) return ext;
  const fromType = CONTENT_TYPE_EXT[contentType];
  return fromType && EXT_RE.test(fromType) ? fromType : null;
}

/** Best-effort human-readable display name from a legacy filename. */
export function decodeDisplayName(filename: string): string {
  let name = filename;
  try {
    name = decodeURIComponent(filename);
  } catch {
    name = filename;
  }
  // Strip a leading `<epochMillis>_` prefix used by the old upload path.
  return name.replace(/^\d{10,}_/, "").slice(0, 255) || filename.slice(0, 255);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}
