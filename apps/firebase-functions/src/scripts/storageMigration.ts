/**
 * Admin script: storage refactor migration tooling (Phase 7).
 *
 * Migrates existing production data from the legacy original-filename storage
 * scheme (`users/{uid}/{images|videos|documents|link-images}/{originalName}`)
 * into the canonical content-addressed scheme
 * (`users/{uid}/{images|videos|documents}/{sha256}.{ext}`), backed by upload
 * archive documents at `users/{uid}/uploads/{hash}`.
 *
 * This is intentionally a maintainer CLI (not a 540s Cloud Function) so it can
 * stream-hash and copy arbitrarily many/large objects without timeouts. The
 * pure reference-walking / classification logic lives in
 * `utils_storageMigration.ts` and is unit-tested there.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MODES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   inventory        Read-only. Scan every grid + every object under `users/`
 *                    and report referenced vs. unreferenced objects, dangling
 *                    references, foreign-owner references, and (with
 *                    --detect-duplicates) duplicate content per user.
 *
 *   count            Read-only. Concise summary of how many objects in the
 *                    `users/` bucket are referenced vs. unreferenced, across all
 *                    users (or one user with --user).
 *
 *   migrate          Copy every *referenced* legacy object into its canonical
 *                    hash location, create/refresh its archive document, and
 *                    rewrite all grid references (URLs + hash fields) to the new
 *                    canonical URL/hash. Bumps grid `rev` and stamps
 *                    `storageSchemaRev`. Also relocates referenced
 *                    `link-images/` objects into the canonical `images/` scheme
 *                    (LinkContent images now live under images/). Cross-user
 *                    references (a grid owned by one user pointing at another
 *                    user's object, e.g. from a duplicated grid) are copied into
 *                    the grid owner's own space + archive doc and rewritten to
 *                    that copy, so each owner's grid is self-contained and
 *                    deduped; the source object is never touched or deleted. By
 *                    default only grid-referenced legacy objects are copied
 *                    (orphans are left for gc); pass --include-unreferenced to
 *                    also copy every remaining legacy object into the archive as
 *                    a File Archive-only file. Defaults to a dry run; pass
 *                    --commit (and --confirm <project>) to write.
 *
 *   recompute-usage  Recompute `users/{uid}.storageUsed` from the user's active
 *                    archive documents (unique, deduped bytes). --user <uid> or
 *                    --all. Defaults to a dry run; pass --commit to write.
 *
 *   gc               Delete UNREFERENCED storage objects only. An object is
 *                    protected if any grid references it, if its hash is
 *                    referenced, or if it is a tracked (active archive doc)
 *                    file. Legacy objects orphaned by a completed migration and
 *                    untracked canonical orphans are eligible. Defaults to a dry
 *                    run; pass --commit and --confirm <project> to delete.
 *                    Writes a deletion manifest for audit/recovery. Run only as
 *                    a post-migration/grace maintainer op, NOT concurrently with
 *                    live uploads: an in-flight upload (pending archive doc +
 *                    object present, onFinalize not yet run) can look like an
 *                    untracked canonical orphan and be deleted.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS AND ISN'T A "USER FILE"
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Included (archive-backed, per notes/storage-refactor-grid-url-inventory.md):
 *     - Grid.backgroundImageSrc / backgroundImageHash
 *     - ImageContent.src / srcHash, VideoContent.src / srcHash
 *     - DocumentsContent.items[].url / hash
 *     - LinkContent.customImageUrl / customImageHash (user-uploaded only)
 *     - ProfileBioContent.profilePhotoUrl / profilePhotoHash
 *     - SmartTextContent inline images (Tiptap image nodes)
 *
 *   Ignored (never migrated, never counted, never rewritten):
 *     - External URLs, blob:/data: URLs, scraped link/meta/favicon images,
 *       YouTube/music/map metadata, embeds, thumbnails, demo assets.
 *     - Custom OG images (`og-images/custom/...`) and generated OG images:
 *       they live outside `users/` and are intentionally out of archive/quota.
 *     - Any object outside `users/{uid}/{images|videos|documents|link-images}/`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SAFETY MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   - Every write mode is dry-run by default. Writes require --commit.
 *   - Destructive modes (migrate --commit, gc --commit) additionally require
 *     --confirm <projectId> matching the resolved project.
 *   - Copied canonical objects are created WITHOUT the migration skip tag and
 *     their archive docs are written `active` BEFORE the copy, so the deployed
 *     onFinalize trigger short-circuits ("already-active": no double count, no
 *     deletion) and future onDelete accounting stays correct. `storageUsed` is
 *     never touched here — run recompute-usage after migrate.
 *   - refCounts are left to the deployed grid-reference reconciliation triggers,
 *     which fire when this script rewrites grids (archive docs are created
 *     first, so the increments land). Do not also set refCounts here.
 *   - gc deletions set the skip-accounting metadata tag before deleting so the
 *     onDelete trigger never decrements a legit user's storageUsed for an
 *     orphan/legacy object.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USAGE (from apps/firebase-functions/)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   npm run build
 *
 *   # Read-only reports
 *   node lib/scripts/storageMigration.js count      --project <project>
 *   node lib/scripts/storageMigration.js inventory  --project <project> --detect-duplicates
 *
 *   # Migration: dry run first, then commit
 *   node lib/scripts/storageMigration.js migrate --project <project>
 *   node lib/scripts/storageMigration.js migrate --project <project> --commit --confirm <project>
 *   # ...also preserving orphaned legacy objects as File Archive files:
 *   node lib/scripts/storageMigration.js migrate --project <project> --include-unreferenced
 *
 *   # Recompute storage usage
 *   node lib/scripts/storageMigration.js recompute-usage --project <project> --all
 *   node lib/scripts/storageMigration.js recompute-usage --project <project> --user <uid> --commit
 *
 *   # Garbage collect unreferenced objects (after migration + grace period)
 *   node lib/scripts/storageMigration.js gc --project <project>
 *   node lib/scripts/storageMigration.js gc --project <project> --commit --confirm <project>
 *
 *   Common options: --user <uid> (scope to one owner), --bucket <name>,
 *   --limit <n> (cap grids/objects for testing), --json (machine-readable
 *   report to stdout).
 *
 * Auth: `admin.ts` calls `initializeApp()` with no args, so the SDK uses
 * Application Default Credentials. Any ADC source works, as long as the
 * principal has Firestore read/write and Storage read/write/delete on the
 * target project:
 *   - `gcloud auth application-default login` (your own user credentials) —
 *     simplest for a supervised, one-off run; make sure
 *     GOOGLE_APPLICATION_CREDENTIALS is NOT also set, or it takes precedence.
 *   - GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON key
 *     (Firebase Console → Project Settings → Service Accounts) — better for CI
 *     or an unattended run.
 * `--project` is always required. Besides selecting the target, it drives the
 * SDK's project detection: `main()` copies it into GOOGLE_CLOUD_PROJECT /
 * GCLOUD_PROJECT before the first Firestore/Storage call (unless already set),
 * because user ADC credentials carry no project and Firestore would otherwise
 * fail with "Unable to detect a Project Id". An existing GOOGLE_CLOUD_PROJECT is
 * left untouched, so a service-account setup that already exports it still works.
 * Bucket defaults to `${project}.firebasestorage.app`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import admin from "../admin.js";
import {
  buildCanonicalUploadPath,
  type UploadKind,
} from "../storage/utils_uploadPaths.js";
import {
  buildDownloadUrl,
  ensureDownloadToken,
  uploadArchiveRef,
  type UploadArchiveDoc,
} from "../storage/utils_uploadArchive.js";
import { hashStorageObject } from "../storage/utils_storageHash.js";
import { SKIP_STORAGE_ACCOUNTING_METADATA_KEY } from "../storage/utils_storageUsage.js";
import {
  ARCHIVE_FOLDERS,
  STORAGE_SCHEMA_REV,
  classifyObject,
  decodeDisplayName,
  foreignMigrationKey,
  formatBytes,
  isObjectReferenced,
  processGrid,
  resolveExtension,
  resolveStorageRef,
  type CollectedRef,
  type Folder,
  type MigrationTarget,
  type ResolvedStorageRef,
} from "./utils_storageMigration.js";

// ── CLI types ────────────────────────────────────────────────────────────────

type Mode = "inventory" | "count" | "migrate" | "recompute-usage" | "gc";
const MODES: Mode[] = ["inventory", "count", "migrate", "recompute-usage", "gc"];

interface Args {
  mode: Mode;
  project: string;
  bucket: string;
  user?: string;
  all: boolean;
  commit: boolean;
  confirm?: string;
  limit?: number;
  detectDuplicates: boolean;
  includeUnreferenced: boolean;
  allowZeroing: boolean;
  json: boolean;
}

const db = () => admin.firestore();

// ── Firestore / Storage iteration helpers ────────────────────────────────────

interface GridRecord {
  id: string;
  data: Record<string, unknown>;
}

/** Async-iterate grids, optionally filtered to one owner and capped by limit. */
async function* iterateGrids(
  user: string | undefined,
  limit: number | undefined,
): AsyncGenerator<GridRecord> {
  let base: FirebaseFirestore.Query = db().collection("grids");
  if (user) base = base.where("userId", "==", user);
  base = base.orderBy(admin.firestore.FieldPath.documentId());

  let count = 0;
  const pageSize = 300;
  let lastId: string | undefined;
  for (;;) {
    let page = base.limit(pageSize);
    if (lastId) page = page.startAfter(lastId);
    const snap = await page.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      yield { id: doc.id, data: doc.data() };
      count += 1;
      if (limit && count >= limit) return;
    }
    lastId = snap.docs[snap.docs.length - 1].id;
    if (snap.size < pageSize) break;
  }
}

interface StorageObject {
  path: string;
  size: number;
  contentType: string;
  metadata: Record<string, string | undefined>;
}

/** Async-iterate every object under a prefix using manual pagination. */
async function* iterateStorageObjects(
  bucketName: string,
  prefix: string,
  limit: number | undefined,
): AsyncGenerator<StorageObject> {
  const bucket = admin.storage().bucket(bucketName);
  let pageToken: string | undefined;
  let count = 0;
  do {
    const [files, nextQuery] = (await bucket.getFiles({
      prefix,
      autoPaginate: false,
      maxResults: 500,
      pageToken,
    })) as unknown as [
      Array<{
        name: string;
        metadata: {
          size?: string | number;
          contentType?: string;
          metadata?: Record<string, string | undefined>;
        };
      }>,
      { pageToken?: string } | null,
    ];

    for (const file of files) {
      const rawSize = file.metadata.size;
      const size =
        typeof rawSize === "number" ? rawSize : parseInt(rawSize ?? "0", 10);
      yield {
        path: file.name,
        size: Number.isFinite(size) ? size : 0,
        contentType: file.metadata.contentType ?? "",
        metadata: file.metadata.metadata ?? {},
      };
      count += 1;
      if (limit && count >= limit) return;
    }

    pageToken = nextQuery?.pageToken;
  } while (pageToken);
}

// ── Reference scan (shared by count / inventory / migrate / gc) ──────────────

interface ReferenceScan {
  /** Every exact storage path a grid points at (legacy + canonical). */
  referencedPaths: Set<string>;
  /** Per-owner set of referenced hashes (from stored hash fields + canonical). */
  referencedHashes: Map<string, Set<string>>;
  /** Referenced legacy object paths → their (first-seen) resolution. */
  referencedLegacy: Map<string, ResolvedStorageRef>;
  /** References that resolve to a user path owned by someone else. */
  foreignRefs: Array<{ gridId: string; owner: string; ref: CollectedRef }>;
  /**
   * Cross-user copy jobs, deduped by (gridOwner, sourcePath). Each foreign
   * reference whose grid has a real owner becomes a job to copy the source
   * object into the grid owner's canonical space. `destUid` is the grid owner
   * (who receives the copy); `resolved.uid` is the source object's real owner.
   */
  foreignToMigrate: Map<string, { destUid: string; resolved: ResolvedStorageRef }>;
  gridsScanned: number;
}

/**
 * Build the reference-protection sets from grids.
 *
 * `allGrids` MUST be true for any mode that decides whether a storage object is
 * safe to delete or reports referenced/unreferenced (gc, inventory): an object
 * under users/{X}/ can be referenced by ANOTHER user's grid (e.g. a duplicated
 * grid), so protection must consider every grid, not just --user's. migrate
 * leaves it false: it only copies/rewrites the scoped owner's own grids, so
 * scanning all grids would copy objects it then never rewrites.
 */
async function scanReferences(
  args: Args,
  allGrids = false,
): Promise<ReferenceScan> {
  const referencedPaths = new Set<string>();
  const referencedHashes = new Map<string, Set<string>>();
  const referencedLegacy = new Map<string, ResolvedStorageRef>();
  const foreignRefs: ReferenceScan["foreignRefs"] = [];
  const foreignToMigrate: ReferenceScan["foreignToMigrate"] = new Map();
  let gridsScanned = 0;

  const gridOwner = allGrids ? undefined : args.user;
  for await (const grid of iterateGrids(gridOwner, args.limit)) {
    gridsScanned += 1;
    const owner = typeof grid.data.userId === "string" ? grid.data.userId : "";
    const { collected } = processGrid(grid.data);
    for (const ref of collected) {
      // Always protect the physically-referenced object (so gc never deletes a
      // live file), keyed by the object's real owner. Foreign-owner references
      // are protected but never migrated (we don't copy another user's file).
      if (ref.resolved) {
        referencedPaths.add(ref.resolved.path);
        if (ref.resolved.hash) {
          addHash(referencedHashes, ref.resolved.uid, ref.resolved.hash);
        }
      }

      if (ref.ownerMismatch) {
        foreignRefs.push({ gridId: grid.id, owner, ref });
        // Queue a cross-user copy into the grid owner's space. Skip grids with
        // no real owner (nothing to own the copy) and refs that failed to
        // resolve. Dedupe by (owner, sourcePath): the same source referenced by
        // several of this owner's grids copies once.
        if (owner && ref.resolved) {
          const key = foreignMigrationKey(owner, ref.resolved.path);
          if (!foreignToMigrate.has(key)) {
            foreignToMigrate.set(key, { destUid: owner, resolved: ref.resolved });
          }
        }
        continue;
      }

      if (ref.storedHash) addHash(referencedHashes, owner, ref.storedHash);
      if (
        ref.resolved &&
        !ref.resolved.hash &&
        !referencedLegacy.has(ref.resolved.path)
      ) {
        referencedLegacy.set(ref.resolved.path, ref.resolved);
      }
    }
  }

  return {
    referencedPaths,
    referencedHashes,
    referencedLegacy,
    foreignRefs,
    foreignToMigrate,
    gridsScanned,
  };
}

function addHash(
  map: Map<string, Set<string>>,
  uid: string,
  hash: string,
): void {
  let set = map.get(uid);
  if (!set) {
    set = new Set<string>();
    map.set(uid, set);
  }
  set.add(hash);
}

// ── Mode: count / inventory ──────────────────────────────────────────────────

interface InventoryStats {
  totalObjects: number;
  totalBytes: number;
  referencedObjects: number;
  referencedBytes: number;
  unreferencedObjects: number;
  unreferencedBytes: number;
  canonicalObjects: number;
  legacyObjects: number;
  byFolder: Record<Folder, { total: number; referenced: number }>;
  perUser: Map<
    string,
    { total: number; referenced: number; unreferenced: number; bytes: number }
  >;
  danglingReferences: Array<{ path: string }>;
  foreignReferences: number;
  /** Cross-user references: a grid owned by one user pointing at another
   *  user's storage object. These are what the cross-user copy would target. */
  foreignReferenceDetails: Array<{
    gridId: string;
    owner: string;
    foreignOwner: string;
    path: string;
    location: string;
    isCanonical: boolean;
  }>;
  duplicateGroups: Array<{ uid: string; hash: string; paths: string[] }>;
}

async function runInventory(args: Args): Promise<InventoryStats> {
  // Protection/reference determination must consider every grid, even when
  // --user scopes which objects we report on (a user's object can be referenced
  // by another user's grid).
  const scan = await scanReferences(args, true);

  const stats: InventoryStats = {
    totalObjects: 0,
    totalBytes: 0,
    referencedObjects: 0,
    referencedBytes: 0,
    unreferencedObjects: 0,
    unreferencedBytes: 0,
    canonicalObjects: 0,
    legacyObjects: 0,
    byFolder: {
      images: { total: 0, referenced: 0 },
      videos: { total: 0, referenced: 0 },
      documents: { total: 0, referenced: 0 },
      "link-images": { total: 0, referenced: 0 },
    },
    perUser: new Map(),
    danglingReferences: [],
    foreignReferences: scan.foreignRefs.length,
    foreignReferenceDetails: scan.foreignRefs.map(({ gridId, owner, ref }) => ({
      gridId,
      owner,
      foreignOwner: ref.resolved?.uid ?? "",
      path: ref.resolved?.path ?? "",
      location: ref.location,
      isCanonical: ref.resolved?.isCanonical ?? false,
    })),
    duplicateGroups: [],
  };

  const seenPaths = new Set<string>();
  // For --detect-duplicates: uid → contentHash → paths[]
  const contentGroups = new Map<string, Map<string, string[]>>();

  const prefix = args.user ? `users/${args.user}/` : "users/";
  for await (const obj of iterateStorageObjects(args.bucket, prefix, args.limit)) {
    const cls = classifyObject(obj);
    if (!cls) continue;
    seenPaths.add(obj.path);

    stats.totalObjects += 1;
    stats.totalBytes += obj.size;
    stats.byFolder[cls.folder].total += 1;
    if (cls.isCanonical) stats.canonicalObjects += 1;
    else stats.legacyObjects += 1;

    const perUser = getPerUser(stats.perUser, cls.uid);
    perUser.total += 1;
    perUser.bytes += obj.size;

    const referenced = isObjectReferenced(
      cls,
      scan.referencedPaths,
      scan.referencedHashes,
    );
    if (referenced) {
      stats.referencedObjects += 1;
      stats.referencedBytes += obj.size;
      stats.byFolder[cls.folder].referenced += 1;
      perUser.referenced += 1;
    } else {
      stats.unreferencedObjects += 1;
      stats.unreferencedBytes += obj.size;
      perUser.unreferenced += 1;
    }

    if (args.detectDuplicates) {
      try {
        const contentHash = await hashStorageObject(obj.path, args.bucket);
        let byHash = contentGroups.get(cls.uid);
        if (!byHash) {
          byHash = new Map();
          contentGroups.set(cls.uid, byHash);
        }
        const list = byHash.get(contentHash) ?? [];
        list.push(obj.path);
        byHash.set(contentHash, list);
      } catch (err) {
        console.warn(`  ! failed to hash ${obj.path}: ${String(err)}`);
      }
    }
  }

  // Dangling references: grid points at a path that no longer exists in storage.
  // Only flag paths within the reported object scope — with a global reference
  // scan, referencedPaths includes other users' objects we did not enumerate
  // (out of --user scope), which are not dangling, just unseen.
  for (const refPath of scan.referencedPaths) {
    if (!refPath.startsWith(prefix)) continue;
    if (!seenPaths.has(refPath)) stats.danglingReferences.push({ path: refPath });
  }

  if (args.detectDuplicates) {
    for (const [uid, byHash] of contentGroups) {
      for (const [hash, paths] of byHash) {
        if (paths.length > 1) stats.duplicateGroups.push({ uid, hash, paths });
      }
    }
  }

  return stats;
}

function getPerUser(
  map: InventoryStats["perUser"],
  uid: string,
): { total: number; referenced: number; unreferenced: number; bytes: number } {
  let entry = map.get(uid);
  if (!entry) {
    entry = { total: 0, referenced: 0, unreferenced: 0, bytes: 0 };
    map.set(uid, entry);
  }
  return entry;
}

function printInventory(stats: InventoryStats, mode: Mode): void {
  const fmt = (n: number) => n.toLocaleString();
  console.warn("");
  console.warn("=== Storage inventory ===");
  console.warn(`Objects under users/:        ${fmt(stats.totalObjects)} (${formatBytes(stats.totalBytes)})`);
  console.warn(`  referenced by a grid:      ${fmt(stats.referencedObjects)} (${formatBytes(stats.referencedBytes)})`);
  console.warn(`  unreferenced:              ${fmt(stats.unreferencedObjects)} (${formatBytes(stats.unreferencedBytes)})`);
  console.warn(`  canonical (hash-named):    ${fmt(stats.canonicalObjects)}`);
  console.warn(`  legacy (original name):    ${fmt(stats.legacyObjects)}`);

  if (mode === "inventory") {
    console.warn("");
    console.warn("By folder (referenced / total):");
    for (const folder of ARCHIVE_FOLDERS) {
      const f = stats.byFolder[folder];
      console.warn(`  ${folder.padEnd(12)} ${fmt(f.referenced)} / ${fmt(f.total)}`);
    }
    console.warn("");
    console.warn(`Users with objects:          ${fmt(stats.perUser.size)}`);
    console.warn(`Dangling references:         ${fmt(stats.danglingReferences.length)}`);
    for (const d of stats.danglingReferences.slice(0, 25)) {
      console.warn(`  ! missing object: ${d.path}`);
    }
    if (stats.danglingReferences.length > 25) {
      console.warn(`  ...and ${stats.danglingReferences.length - 25} more`);
    }
    console.warn(`Foreign-owner references:    ${fmt(stats.foreignReferences)}`);
    for (const f of stats.foreignReferenceDetails.slice(0, 25)) {
      console.warn(
        `  ! grid ${f.gridId} (owner ${f.owner}) ${f.location} → ${f.path} ` +
          `(owned by ${f.foreignOwner}, ${f.isCanonical ? "canonical" : "legacy"})`,
      );
    }
    if (stats.foreignReferenceDetails.length > 25) {
      console.warn(`  ...and ${stats.foreignReferenceDetails.length - 25} more`);
    }
    if (stats.duplicateGroups.length) {
      console.warn("");
      console.warn(`Duplicate content groups:    ${fmt(stats.duplicateGroups.length)}`);
      for (const g of stats.duplicateGroups.slice(0, 25)) {
        console.warn(`  ${g.uid} ${g.hash.slice(0, 12)}… ×${g.paths.length}`);
      }
    }
  }
  console.warn("");
}

function printInventoryJson(stats: InventoryStats): void {
  const perUser: Record<string, unknown> = {};
  for (const [uid, v] of stats.perUser) perUser[uid] = v;
  // Machine-readable report goes to stdout (human logs use console.warn/stderr).
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        totalObjects: stats.totalObjects,
        totalBytes: stats.totalBytes,
        referencedObjects: stats.referencedObjects,
        referencedBytes: stats.referencedBytes,
        unreferencedObjects: stats.unreferencedObjects,
        unreferencedBytes: stats.unreferencedBytes,
        canonicalObjects: stats.canonicalObjects,
        legacyObjects: stats.legacyObjects,
        byFolder: stats.byFolder,
        users: stats.perUser.size,
        danglingReferences: stats.danglingReferences,
        foreignReferences: stats.foreignReferences,
        foreignReferenceDetails: stats.foreignReferenceDetails,
        duplicateGroups: stats.duplicateGroups,
        perUser,
      },
      null,
      2,
    ),
  );
}

// ── Mode: migrate ────────────────────────────────────────────────────────────

interface MigrateStats {
  referencedLegacyObjects: number;
  /** Extra unreferenced legacy objects pulled in by --include-unreferenced. */
  unreferencedIncluded: number;
  /** Objects copied (commit) or planned to copy (dry-run) to canonical. */
  copied: number;
  skippedExisting: number;
  dangling: number;
  unmigratable: number;
  /** Cross-user (foreign-owner) copy jobs: a grid referencing another user's
   *  object, copied into the grid owner's space. */
  foreignObjects: number;
  foreignCopied: number;
  foreignDeduped: number;
  foreignDangling: number;
  foreignUnmigratable: number;
  gridsRewritten: number;
  gridsScanned: number;
}

async function runMigrate(args: Args): Promise<MigrateStats> {
  const scan = await scanReferences(args);

  // Start from legacy objects referenced by a grid, then optionally add every
  // remaining legacy object in storage (orphans) when --include-unreferenced.
  const toMigrate = new Map<string, ResolvedStorageRef>(scan.referencedLegacy);
  let unreferencedIncluded = 0;
  if (args.includeUnreferenced) {
    const prefix = args.user ? `users/${args.user}/` : "users/";
    for await (const obj of iterateStorageObjects(args.bucket, prefix, args.limit)) {
      const cls = classifyObject(obj);
      if (!cls || cls.isCanonical) continue; // canonical objects need no copy
      if (toMigrate.has(obj.path)) continue; // already covered (referenced)
      const resolved = resolveStorageRef(obj.path);
      if (!resolved) continue;
      toMigrate.set(obj.path, resolved);
      unreferencedIncluded += 1;
    }
  }

  console.warn(
    `Scanned ${scan.gridsScanned} grid(s); ${scan.referencedLegacy.size} ` +
      `referenced legacy object(s)` +
      (args.includeUnreferenced
        ? ` + ${unreferencedIncluded} unreferenced orphan(s)`
        : "") +
      ` to migrate` +
      (scan.foreignToMigrate.size
        ? `; ${scan.foreignToMigrate.size} cross-user copy job(s)`
        : "") +
      `.`,
  );

  const migrationMap = new Map<string, MigrationTarget>();
  // Foreign copies rewrite keyed by (gridOwner, sourcePath); see
  // foreignMigrationKey. A source referenced by several owners lands one target
  // per owner.
  const foreignMigrationMap = new Map<string, MigrationTarget>();
  // One shared target per canonical destination, so every object with identical
  // content — whether an owner's own legacy file or a cross-user copy into the
  // same owner — rewrites to the SAME url/token (the object only carries one
  // token) and is copied only once.
  const canonicalTargets = new Map<string, MigrationTarget>();

  const ownCounters: CopyCounters = {
    copied: 0,
    deduped: 0,
    dangling: 0,
    unmigratable: 0,
  };
  const foreignCounters: CopyCounters = {
    copied: 0,
    deduped: 0,
    dangling: 0,
    unmigratable: 0,
  };

  // ── Phase 1a: copy an owner's own legacy objects → canonical + archive docs.
  //    Orphans get an archive doc + canonical object but no grid rewrite
  //    (nothing points at them), which is exactly how a File Archive-only file
  //    looks.
  for (const [legacyPath, ref] of toMigrate) {
    const target = await copyObjectToCanonical({
      bucketName: args.bucket,
      sourcePath: legacyPath,
      destUid: ref.uid,
      resolved: ref,
      commit: args.commit,
      crossUser: false,
      canonicalTargets,
      counters: ownCounters,
    });
    if (target) migrationMap.set(legacyPath, target);
  }

  // ── Phase 1b: cross-user copies. Copy each foreign-owned source object into
  //    the referencing grid owner's canonical space + archive doc. The source
  //    (another user's object) is never touched or deleted. Shares
  //    canonicalTargets with 1a so identical content already present under the
  //    owner is reused instead of re-copied.
  for (const [key, job] of scan.foreignToMigrate) {
    const target = await copyObjectToCanonical({
      bucketName: args.bucket,
      sourcePath: job.resolved.path,
      destUid: job.destUid,
      resolved: job.resolved,
      commit: args.commit,
      crossUser: true,
      canonicalTargets,
      counters: foreignCounters,
    });
    if (target) foreignMigrationMap.set(key, target);
  }

  // ── Phase 2: rewrite grid references (own legacy → canonical, foreign → the
  //    owner's cross-user copy) + canonical hash backfill. Re-reads each grid
  //    inside a transaction so concurrent edits are not clobbered.
  let gridsRewritten = 0;
  for await (const grid of iterateGrids(args.user, args.limit)) {
    const preview = processGrid(grid.data, migrationMap, foreignMigrationMap);
    if (!preview.changed) continue;

    if (!args.commit) {
      gridsRewritten += 1;
      console.warn(`  WOULD rewrite grid ${grid.id}:`);
      for (const line of preview.rewrites) console.warn(`      ${line}`);
      continue;
    }

    const wrote = await rewriteGridTransaction(
      grid.id,
      migrationMap,
      foreignMigrationMap,
    );
    if (wrote) {
      gridsRewritten += 1;
      console.warn(`  REWROTE grid ${grid.id}`);
    }
  }

  return {
    referencedLegacyObjects: scan.referencedLegacy.size,
    unreferencedIncluded,
    copied: ownCounters.copied,
    skippedExisting: ownCounters.deduped,
    dangling: ownCounters.dangling,
    unmigratable: ownCounters.unmigratable,
    foreignObjects: scan.foreignToMigrate.size,
    foreignCopied: foreignCounters.copied,
    foreignDeduped: foreignCounters.deduped,
    foreignDangling: foreignCounters.dangling,
    foreignUnmigratable: foreignCounters.unmigratable,
    gridsRewritten,
    gridsScanned: scan.gridsScanned,
  };
}

/** Mutable per-pass copy counters shared by the own and cross-user passes. */
interface CopyCounters {
  copied: number;
  deduped: number;
  dangling: number;
  unmigratable: number;
}

/**
 * Copy one source object into `destUid`'s canonical space (creating/refreshing
 * its archive doc), deduping via the shared `canonicalTargets` map. Returns the
 * resolved target so the caller can record the appropriate grid-rewrite mapping,
 * or null when the object was skipped (dangling / unmigratable / failed). Used
 * for both an owner's own legacy objects (`crossUser: false`, destUid ==
 * source owner) and cross-user copies (`crossUser: true`, destUid == grid
 * owner, source owned by someone else).
 */
async function copyObjectToCanonical(opts: {
  bucketName: string;
  sourcePath: string;
  destUid: string;
  resolved: ResolvedStorageRef;
  commit: boolean;
  crossUser: boolean;
  canonicalTargets: Map<string, MigrationTarget>;
  counters: CopyCounters;
}): Promise<MigrationTarget | null> {
  const { sourcePath, destUid, resolved, canonicalTargets, counters } = opts;
  const tag = opts.crossUser ? "cross-user " : "";
  const bucket = admin.storage().bucket(opts.bucketName);
  const file = bucket.file(sourcePath);

  const [exists] = await file.exists();
  if (!exists) {
    counters.dangling += 1;
    console.warn(`  ! dangling (no object): ${sourcePath}`);
    return null;
  }

  const [meta] = await file.getMetadata();
  const size =
    typeof meta.size === "number" ? meta.size : parseInt(meta.size ?? "0", 10);
  const contentType = (meta.contentType ?? "").toLowerCase();

  const ext = resolveExtension(resolved.ext, contentType);
  if (!ext) {
    counters.unmigratable += 1;
    console.warn(
      `  ! unmigratable (no usable extension): ${sourcePath} (${contentType})`,
    );
    return null;
  }

  let hash: string;
  try {
    hash = await hashStorageObject(sourcePath, opts.bucketName);
  } catch (err) {
    counters.unmigratable += 1;
    console.warn(`  ! failed to hash ${sourcePath}: ${String(err)}`);
    return null;
  }

  const canonicalPath = buildCanonicalUploadPath(destUid, {
    kind: resolved.canonicalKind,
    hash,
    ext,
    size,
    contentType,
  });

  // Identical content already migrated into this dest in this run → reuse. Keyed
  // by (destUid, hash), NOT the full canonical path: the same bytes under two
  // legacy names with different extensions/kinds must collapse to ONE canonical
  // object + ONE archive doc (the doc is keyed by hash), matching the runtime
  // one-archive-doc-per-hash invariant. First-seen kind/ext wins.
  const dedupKey = `${destUid}\u0000${hash}`;
  const existingTarget = canonicalTargets.get(dedupKey);
  if (existingTarget) {
    counters.deduped += 1;
    return existingTarget;
  }

  // An existing ACTIVE archive doc for (destUid, hash) is the authoritative
  // canonical location for this content. Reuse its path/url and do NOT create a
  // second object or overwrite the doc with a different-ext/kind variant -- the
  // doc is keyed by hash and runtime enforces one archive doc per hash. Falls
  // through for pending/failed docs (a stale reservation we may safely replace).
  const archiveSnap = await uploadArchiveRef(destUid, hash).get();
  const archiveData = archiveSnap.exists
    ? (archiveSnap.data() as Partial<UploadArchiveDoc>)
    : null;
  if (
    archiveData?.status === "active" &&
    typeof archiveData.path === "string" &&
    archiveData.path &&
    typeof archiveData.url === "string" &&
    archiveData.url
  ) {
    const reuseTarget: MigrationTarget = {
      newUrl: archiveData.url,
      newHash: hash,
      newPath: archiveData.path,
    };
    canonicalTargets.set(dedupKey, reuseTarget);
    counters.deduped += 1;
    console.warn(
      `  REUSE existing archive ${tag}${sourcePath} -> ${archiveData.path}`,
    );
    return reuseTarget;
  }

  // No active archive doc. If the canonical object nonetheless already exists
  // (an untracked orphan, or a prior interrupted run), preserve ITS download
  // token so we never break URLs referencing it, and skip re-copy/publish.
  const destFile = bucket.file(canonicalPath);
  const [destExists] = await destFile.exists();
  let token: string;
  if (destExists) {
    const [destMeta] = await destFile.getMetadata();
    token = ensureDownloadToken(destMeta.metadata ?? {});
  } else {
    // Reuse the source's token so the object, its archive doc url, and every
    // rewritten grid url all agree with the token the live onFinalize trigger
    // restamps (it derives the token from the copied-over source metadata).
    token = ensureDownloadToken(meta.metadata ?? {});
  }

  const displayName = decodeDisplayName(resolved.filename);
  const newUrl = buildDownloadUrl(bucket.name, canonicalPath, token);
  const target: MigrationTarget = {
    newUrl,
    newHash: hash,
    newPath: canonicalPath,
  };
  const linkNote = resolved.folder === "link-images" ? ", link-image" : "";

  if (!opts.commit) {
    canonicalTargets.set(dedupKey, target);
    counters.copied += 1;
    console.warn(
      `  WOULD copy ${tag}${sourcePath} → ${canonicalPath} ` +
        `(${formatBytes(size)}${linkNote})`,
    );
    return target;
  }

  try {
    await copyToCanonical({
      bucketName: opts.bucketName,
      uid: destUid,
      legacyPath: sourcePath,
      canonicalPath,
      hash,
      kind: resolved.canonicalKind,
      ext,
      size,
      contentType,
      displayName,
      token,
      url: newUrl,
      destAlreadyExists: destExists,
    });
    canonicalTargets.set(dedupKey, target);
    counters.copied += 1;
    console.warn(`  COPIED ${tag}${sourcePath} → ${canonicalPath}`);
    return target;
  } catch (err) {
    console.error(`  FAILED copy ${tag}${sourcePath}: ${String(err)}`);
    // Return null so grids are not rewritten to a missing object.
    counters.unmigratable += 1;
    return null;
  }
}

interface CopyParams {
  bucketName: string;
  uid: string;
  legacyPath: string;
  canonicalPath: string;
  hash: string;
  kind: UploadKind;
  ext: string;
  size: number;
  contentType: string;
  displayName: string;
  token: string;
  url: string;
  /** Caller already determined the canonical object exists; if so we neither
   *  re-copy nor overwrite its metadata (preserving its published token). */
  destAlreadyExists: boolean;
}

/**
 * Create the active archive doc FIRST (so the deployed onFinalize trigger sees
 * an already-active doc and short-circuits without double-counting or
 * deleting), then copy the object into its canonical location and publish it.
 * No migration skip-tag is set, so future onDelete accounting stays correct.
 * refCount / shareable are preserved when the doc already exists (idempotent).
 *
 * If copying/publishing fails, roll back a doc WE created (it did not pre-exist)
 * when no object backs it, so a failed copy never leaves an orphaned active
 * archive doc that recompute-usage would count and File Archive would show.
 */
async function copyToCanonical(p: CopyParams): Promise<void> {
  const ref = uploadArchiveRef(p.uid, p.hash);
  const existing = await ref.get();
  const existingData = existing.exists
    ? (existing.data() as Partial<UploadArchiveDoc>)
    : null;
  const docPreExisted = existing.exists;

  const doc: Record<string, unknown> = {
    uid: p.uid,
    hash: p.hash,
    kind: p.kind,
    path: p.canonicalPath,
    url: p.url,
    displayName:
      existingData?.displayName && existingData.displayName.trim()
        ? existingData.displayName
        : p.displayName,
    size: p.size,
    contentType: p.contentType,
    ext: p.ext,
    status: "active",
    refCount:
      typeof existingData?.refCount === "number" ? existingData.refCount : 0,
    shareable: existingData?.shareable === true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    activatedAt:
      existingData?.activatedAt ?? admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!docPreExisted) {
    doc.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await ref.set(doc, { merge: true });

  const bucket = admin.storage().bucket(p.bucketName);
  const source = bucket.file(p.legacyPath);
  const dest = bucket.file(p.canonicalPath);

  try {
    // Skip the copy when the object already exists: its token/publish state are
    // authoritative and overwriting them would break URLs that reference it.
    if (!p.destAlreadyExists) {
      // Copy WITH the destination metadata in a single operation, so the object
      // is created already-published and already-tokened. This removes the
      // partial-failure window of a separate setMetadata (a successful copy +
      // failed publish would otherwise leave an active doc whose url token was
      // never applied), and guarantees the token in `url` matches the object so
      // the live onFinalize reads the same token instead of minting a new one.
      await source.copy(dest, {
        contentType: p.contentType || undefined,
        metadata: {
          published: "true",
          firebaseStorageDownloadTokens: p.token,
        },
      });
    }
  } catch (err) {
    if (!docPreExisted) {
      const [nowExists] = await dest.exists().catch(() => [false] as [boolean]);
      if (!nowExists) await ref.delete().catch(() => undefined);
    }
    throw err;
  }
}

/** Rewrite one grid inside a transaction (fresh read), bump rev, stamp marker. */
async function rewriteGridTransaction(
  gridId: string,
  migrationMap: Map<string, MigrationTarget>,
  foreignMigrationMap: Map<string, MigrationTarget>,
): Promise<boolean> {
  const ref = db().collection("grids").doc(gridId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const data = snap.data() as Record<string, unknown>;
    const result = processGrid(data, migrationMap, foreignMigrationMap);
    if (!result.changed) return false;

    const update: Record<string, unknown> = {
      tiles: result.newTiles,
      backgroundImageSrc: result.newBackgroundSrc ?? "",
      rev: (typeof data.rev === "number" ? data.rev : 0) + 1,
      storageSchemaRev: STORAGE_SCHEMA_REV,
    };
    if (typeof result.newBackgroundHash === "string") {
      update.backgroundImageHash = result.newBackgroundHash;
    }
    tx.update(ref, update);
    return true;
  });
}

// ── Mode: recompute-usage ────────────────────────────────────────────────────

interface UsageChange {
  uid: string;
  before: number;
  after: number;
}

async function runRecomputeUsage(args: Args): Promise<UsageChange[]> {
  const uids = args.user ? [args.user] : await listUserIds(args.limit);
  const changes: UsageChange[] = [];

  for (const uid of uids) {
    const userSnap = await db().collection("users").doc(uid).get();
    const before =
      typeof userSnap.data()?.storageUsed === "number"
        ? (userSnap.data()?.storageUsed as number)
        : 0;

    // Sum unique, active archive doc bytes (each doc is one deduped object).
    const uploads = await db()
      .collection("users")
      .doc(uid)
      .collection("uploads")
      .where("status", "==", "active")
      .get();
    let after = 0;
    for (const doc of uploads.docs) {
      const size = doc.data().size;
      if (typeof size === "number" && size > 0) after += size;
    }

    changes.push({ uid, before, after });
    const delta = after - before;
    const flag = delta !== 0 ? (delta < 0 ? " ↓" : " ↑") : "";

    // Guard against zeroing out a user who has usage but no active archive docs
    // (e.g. running recompute before the migration created them). Skip unless
    // explicitly allowed.
    const wouldZero = before > 0 && after === 0;
    if (wouldZero && !args.allowZeroing) {
      console.warn(
        `  SKIP ${uid}: ${formatBytes(before)} → 0 (no active archive docs; ` +
          `pass --allow-zeroing to force — run migrate first?)`,
      );
      continue;
    }

    console.warn(
      `  ${args.commit ? "SET " : "WOULD SET "}${uid}: ` +
        `${formatBytes(before)} → ${formatBytes(after)}${flag}`,
    );

    if (args.commit && before !== after) {
      await db()
        .collection("users")
        .doc(uid)
        .set({ storageUsed: Math.max(0, after) }, { merge: true });
    }
  }

  return changes;
}

async function listUserIds(limit: number | undefined): Promise<string[]> {
  const ids: string[] = [];
  const pageSize = 500;
  let lastId: string | undefined;
  for (;;) {
    let query = db()
      .collection("users")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);
    if (lastId) query = query.startAfter(lastId);
    const snap = await query.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      ids.push(doc.id);
      if (limit && ids.length >= limit) return ids;
    }
    lastId = snap.docs[snap.docs.length - 1].id;
    if (snap.size < pageSize) break;
  }
  return ids;
}

// ── Mode: gc ─────────────────────────────────────────────────────────────────

interface GcStats {
  scannedObjects: number;
  deletable: number;
  deletedBytes: number;
  protectedReferenced: number;
  protectedArchived: number;
  manifestPath?: string;
}

async function runGc(args: Args): Promise<GcStats> {
  // Protection MUST come from every grid (allGrids), never just --user's: an
  // object under users/{X}/ referenced only by another user's grid must not look
  // deletable.
  const scan = await scanReferences(args, true);
  const bucket = admin.storage().bucket(args.bucket);

  const stats: GcStats = {
    scannedObjects: 0,
    deletable: 0,
    deletedBytes: 0,
    protectedReferenced: 0,
    protectedArchived: 0,
  };
  const manifest: Array<{ path: string; size: number; reason: string }> = [];

  const prefix = args.user ? `users/${args.user}/` : "users/";
  for await (const obj of iterateStorageObjects(args.bucket, prefix, args.limit)) {
    const cls = classifyObject(obj);
    if (!cls) continue;
    stats.scannedObjects += 1;

    if (isObjectReferenced(cls, scan.referencedPaths, scan.referencedHashes)) {
      stats.protectedReferenced += 1;
      continue;
    }

    // Canonical objects backed by an active archive doc are tracked user files
    // (they show in File Archive even at refCount 0) — never GC them.
    const reason = cls.isCanonical ? "canonical-orphan" : "legacy-orphan";
    if (cls.isCanonical && cls.hash) {
      const archive = await uploadArchiveRef(cls.uid, cls.hash).get();
      const data = archive.exists
        ? (archive.data() as Partial<UploadArchiveDoc>)
        : null;
      if (data && data.status === "active") {
        stats.protectedArchived += 1;
        continue;
      }
      if (data && typeof data.refCount === "number" && data.refCount > 0) {
        // refCount says referenced but the grid scan disagreed — protect and
        // flag rather than risk deleting a live file.
        stats.protectedArchived += 1;
        console.warn(
          `  ? protecting ${obj.path}: archive refCount=${data.refCount} ` +
            `but no grid reference found`,
        );
        continue;
      }
    }

    stats.deletable += 1;
    stats.deletedBytes += obj.size;
    manifest.push({ path: obj.path, size: obj.size, reason });

    if (!args.commit) {
      console.warn(`  WOULD delete ${obj.path} (${formatBytes(obj.size)}, ${reason})`);
      continue;
    }

    // Tag skip-accounting BEFORE delete so the onDelete trigger never
    // decrements storageUsed for an object that authoritative usage excludes.
    const file = bucket.file(obj.path);
    await file.setMetadata({
      metadata: { [SKIP_STORAGE_ACCOUNTING_METADATA_KEY]: "true" },
    });
    await file.delete({ ignoreNotFound: true });
    console.warn(`  DELETED ${obj.path} (${formatBytes(obj.size)})`);
  }

  // Always write a manifest (dry-run manifests document the plan).
  if (manifest.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const manifestPath = path.resolve(
      process.cwd(),
      `storage-gc-manifest-${args.commit ? "deleted" : "dryrun"}-${stamp}.json`,
    );
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        { project: args.project, bucket: args.bucket, committed: args.commit, manifest },
        null,
        2,
      ),
    );
    stats.manifestPath = manifestPath;
  }

  return stats;
}

// ── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Args {
  const [modeRaw, ...rest] = argv;
  if (!modeRaw || !MODES.includes(modeRaw as Mode)) {
    throw new Error(
      `Mode must be one of: ${MODES.join(" | ")} (got: ${modeRaw ?? "<missing>"})`,
    );
  }
  const mode = modeRaw as Mode;

  const getFlag = (name: string): string | undefined => {
    const idx = rest.indexOf(`--${name}`);
    if (idx === -1) return undefined;
    const value = rest[idx + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`--${name} requires a value`);
    }
    return value;
  };
  const hasFlag = (name: string): boolean => rest.includes(`--${name}`);

  const project =
    getFlag("project") ??
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    "";
  if (!project) {
    throw new Error("--project <projectId> is required (or set GCLOUD_PROJECT).");
  }

  const bucket = getFlag("bucket") ?? `${project}.firebasestorage.app`;

  const limitRaw = getFlag("limit");
  let limit: number | undefined;
  if (limitRaw !== undefined) {
    limit = Number.parseInt(limitRaw, 10);
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(`--limit must be a positive integer (got: ${limitRaw})`);
    }
  }

  const all = hasFlag("all");
  const user = getFlag("user");
  if (mode === "recompute-usage" && !user && !all) {
    throw new Error("recompute-usage requires --all or --user <uid>.");
  }

  return {
    mode,
    project,
    bucket,
    user,
    all,
    commit: hasFlag("commit"),
    confirm: getFlag("confirm"),
    limit,
    detectDuplicates: hasFlag("detect-duplicates"),
    includeUnreferenced: hasFlag("include-unreferenced"),
    allowZeroing: hasFlag("allow-zeroing"),
    json: hasFlag("json"),
  };
}

/** Destructive modes require an explicit typed project confirmation. */
function assertConfirmed(args: Args): void {
  const destructive = args.mode === "migrate" || args.mode === "gc";
  if (args.commit && destructive && args.confirm !== args.project) {
    throw new Error(
      `${args.mode} --commit requires --confirm ${args.project} ` +
        `(typed confirmation of the target project).`,
    );
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertConfirmed(args);

  // `admin.ts` calls initializeApp() with no args, so Firestore/Storage detect
  // the project from the environment. Under user ADC (gcloud application-default
  // login) the credentials carry no project id, so propagate --project here.
  // Set before the first db()/storage() call; do not override an existing value.
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    process.env.GOOGLE_CLOUD_PROJECT = args.project;
  }
  if (!process.env.GCLOUD_PROJECT) {
    process.env.GCLOUD_PROJECT = args.project;
  }

  console.warn(
    `storageMigration  mode=${args.mode}  project=${args.project}  ` +
      `bucket=${args.bucket}  ${args.commit ? "COMMIT" : "dry-run"}` +
      `${args.user ? `  user=${args.user}` : ""}` +
      `${args.limit ? `  limit=${args.limit}` : ""}`,
  );

  switch (args.mode) {
    case "count":
    case "inventory": {
      const stats = await runInventory(args);
      if (args.json) printInventoryJson(stats);
      else printInventory(stats, args.mode);
      break;
    }
    case "migrate": {
      const stats = await runMigrate(args);
      console.warn("");
      console.warn("=== Migration summary ===");
      console.warn(`Grids scanned:               ${stats.gridsScanned}`);
      console.warn(`Referenced legacy objects:   ${stats.referencedLegacyObjects}`);
      if (args.includeUnreferenced) {
        console.warn(`Unreferenced orphans added:  ${stats.unreferencedIncluded}`);
      }
      console.warn(`${args.commit ? "Copied" : "Would copy"} to canonical:      ${stats.copied}`);
      console.warn(`Deduped (same content):      ${stats.skippedExisting}`);
      console.warn(`Dangling (missing object):   ${stats.dangling}`);
      console.warn(`Unmigratable:                ${stats.unmigratable}`);
      if (stats.foreignObjects) {
        console.warn(`Cross-user copy jobs:        ${stats.foreignObjects}`);
        console.warn(`  ${args.commit ? "copied" : "would copy"} to owner:          ${stats.foreignCopied}`);
        console.warn(`  deduped (same content):    ${stats.foreignDeduped}`);
        console.warn(`  dangling (missing object): ${stats.foreignDangling}`);
        console.warn(`  unmigratable:              ${stats.foreignUnmigratable}`);
      }
      console.warn(`Grids ${args.commit ? "rewritten" : "to rewrite"}:            ${stats.gridsRewritten}`);
      if (!args.commit) {
        console.warn("");
        console.warn("Dry run — no writes performed. Re-run with --commit --confirm <project>.");
        console.warn("After a committed migration, run: recompute-usage --all --commit");
      }
      break;
    }
    case "recompute-usage": {
      const changes = await runRecomputeUsage(args);
      const lowered = changes.filter((c) => c.after < c.before).length;
      console.warn("");
      console.warn("=== Recompute summary ===");
      console.warn(`Users processed:             ${changes.length}`);
      console.warn(`Users with lowered usage:    ${lowered}`);
      if (!args.commit) {
        console.warn("Dry run — no writes performed. Re-run with --commit.");
      }
      break;
    }
    case "gc": {
      const stats = await runGc(args);
      console.warn("");
      console.warn("=== GC summary ===");
      console.warn(`Objects scanned:             ${stats.scannedObjects}`);
      console.warn(`Protected (referenced):      ${stats.protectedReferenced}`);
      console.warn(`Protected (archived file):   ${stats.protectedArchived}`);
      console.warn(`${args.commit ? "Deleted" : "Deletable"}:                   ${stats.deletable} (${formatBytes(stats.deletedBytes)})`);
      if (stats.manifestPath) {
        console.warn(`Manifest:                    ${stats.manifestPath}`);
      }
      if (!args.commit) {
        console.warn("");
        console.warn("Dry run — no deletions performed. Re-run with --commit --confirm <project>.");
      }
      break;
    }
  }

  console.warn("\nDone.");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
