#!/usr/bin/env node

/**
 * One-time migration helper: recursively copy Firestore documents from
 * `layouts` to `grids`, preserving document IDs and all nested subcollections.
 *
 * Safe defaults:
 *   - dry-run unless `--write --confirm=layouts-to-grids` is provided
 *   - idempotent set writes; re-running refreshes destination docs from source
 *   - never deletes source docs or extra destination docs
 *
 * Usage from apps/firebase-functions:
 *   node scripts/grid-rename-migration/copy-layouts-to-grids.mjs --dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
 *     node scripts/grid-rename-migration/copy-layouts-to-grids.mjs --project-id=your-project-id --write --confirm=layouts-to-grids
 *
 * Useful resume/testing options:
 *   --project-id=your-project-id
 *   --page-size=50
 *   --tile-probe-concurrency=25
 *   --scan-all-tile-subcollections
 *   --start-after=<layoutDocId>
 *   --max-root-docs=10
 */

import admin from "firebase-admin";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_TILE_PROBE_CONCURRENCY = 25;
const MAX_WRITE_RETRIES = 5;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..", "..", "..");
const TILE_TYPES_WITH_NESTED_COLLECTIONS = new Set(["chat", "roadmap_feed"]);

function parseArgs(argv) {
  const options = {
    dryRun: true,
    pageSize: DEFAULT_PAGE_SIZE,
    startAfter: null,
    maxRootDocs: null,
    tileProbeConcurrency: DEFAULT_TILE_PROBE_CONCURRENCY,
    scanAllTileSubcollections: false,
    sourceCollection: "layouts",
    destinationCollection: "grids",
    projectId: null,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--write") {
      options.dryRun = false;
      continue;
    }
    if (arg.startsWith("--page-size=")) {
      options.pageSize = parsePositiveInt(arg, "--page-size");
      continue;
    }
    if (arg.startsWith("--start-after=")) {
      options.startAfter = arg.slice("--start-after=".length) || null;
      continue;
    }
    if (arg.startsWith("--max-root-docs=")) {
      options.maxRootDocs = parsePositiveInt(arg, "--max-root-docs");
      continue;
    }
    if (arg.startsWith("--tile-probe-concurrency=")) {
      options.tileProbeConcurrency = parsePositiveInt(
        arg,
        "--tile-probe-concurrency",
      );
      continue;
    }
    if (arg === "--scan-all-tile-subcollections") {
      options.scanAllTileSubcollections = true;
      continue;
    }
    if (arg.startsWith("--source=")) {
      options.sourceCollection = parseCollectionName(arg, "--source");
      continue;
    }
    if (arg.startsWith("--dest=")) {
      options.destinationCollection = parseCollectionName(arg, "--dest");
      continue;
    }
    if (arg.startsWith("--project-id=")) {
      options.projectId = parseProjectId(arg);
      continue;
    }
    if (arg.startsWith("--confirm=")) {
      options.confirm = arg.slice("--confirm=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.sourceCollection === options.destinationCollection) {
    throw new Error("Source and destination collections must be different.");
  }

  if (!options.dryRun && options.confirm !== "layouts-to-grids") {
    throw new Error(
      "Refusing to write without --confirm=layouts-to-grids. Run with --dry-run first.",
    );
  }

  return options;
}

function printHelp() {
  console.warn(`
Recursively copy Firestore documents from layouts to grids.

Usage:
  node scripts/grid-rename-migration/copy-layouts-to-grids.mjs --dry-run
  node scripts/grid-rename-migration/copy-layouts-to-grids.mjs --write --confirm=layouts-to-grids

Options:
  --dry-run                Print planned copies without writing. Default.
  --write                  Write copied documents to the destination collection.
  --confirm=layouts-to-grids
                           Required with --write.
  --page-size=<n>          Documents to read per collection page. Default: ${DEFAULT_PAGE_SIZE}.
  --tile-probe-concurrency=<n>
                           Concurrent virtual tile subcollection checks. Default: ${DEFAULT_TILE_PROBE_CONCURRENCY}.
  --scan-all-tile-subcollections
                           Probe every tile ID instead of only known nested-data tile types.
  --start-after=<docId>    Resume root collection scan after this document ID.
  --max-root-docs=<n>      Stop after n root layout documents. Useful for testing.
  --source=<collection>    Source root collection. Default: layouts.
  --dest=<collection>      Destination root collection. Default: grids.
  --project-id=<id>        Firebase/GCP project ID. Defaults to env vars, then .firebaserc default.
`);
}

function parsePositiveInt(arg, flagName) {
  const raw = arg.slice(`${flagName}=`.length);
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flagName} must be a positive integer. Received: ${raw}`);
  }
  return value;
}

function parseCollectionName(arg, flagName) {
  const value = arg.slice(`${flagName}=`.length);
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(
      `${flagName} must be a simple collection ID. Received: ${value}`,
    );
  }
  return value;
}

function parseProjectId(arg) {
  const value = arg.slice("--project-id=".length);
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value)) {
    throw new Error(
      `--project-id does not look like a valid project ID: ${value}`,
    );
  }
  return value;
}

function readFirebaseRcDefaultProject() {
  const path = join(REPO_ROOT, ".firebaserc");
  if (!existsSync(path)) return null;

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const projectId = parsed?.projects?.default;
    return typeof projectId === "string" ? projectId : null;
  } catch (error) {
    console.warn(`Could not parse .firebaserc for default project: ${error}`);
    return null;
  }
}

function resolveProjectId(projectIdArg) {
  return (
    projectIdArg ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    readFirebaseRcDefaultProject()
  );
}

function createStats() {
  return {
    collectionsScanned: 0,
    collectionsSkippedAsAlreadyScanned: 0,
    documentsScanned: 0,
    rootDocumentsScanned: 0,
    virtualTileDocumentsConsidered: 0,
    virtualTileDocumentsScanned: 0,
    writesQueued: 0,
    writesSucceeded: 0,
    writesFailed: 0,
  };
}

function createBulkWriter(db, stats) {
  const bulkWriter = db.bulkWriter();

  bulkWriter.onWriteResult(() => {
    stats.writesSucceeded += 1;
  });

  bulkWriter.onWriteError((error) => {
    if (error.failedAttempts < MAX_WRITE_RETRIES) {
      console.warn(
        `Retrying ${error.documentRef.path}; attempt ${error.failedAttempts}`,
      );
      return true;
    }

    stats.writesFailed += 1;
    console.error(`Failed to write ${error.documentRef.path}:`, error.message);
    return false;
  });

  return bulkWriter;
}

async function queueDocumentCopy(sourceSnap, destRef, context) {
  const sourcePath = sourceSnap.ref.path;
  const destPath = destRef.path;

  if (context.options.dryRun) {
    console.warn(`[dry-run] would copy ${sourcePath} -> ${destPath}`);
    return;
  }

  context.bulkWriter.set(destRef, sourceSnap.data());
  context.stats.writesQueued += 1;
}

async function copyDocumentRecursively(sourceSnap, destRef, context, depth) {
  context.stats.documentsScanned += 1;
  await queueDocumentCopy(sourceSnap, destRef, context);

  const subcollections = await sourceSnap.ref.listCollections();
  for (const sourceSubcollection of subcollections) {
    const destSubcollection = destRef.collection(sourceSubcollection.id);
    await copyCollectionRecursively(
      sourceSubcollection,
      destSubcollection,
      context,
      depth + 1,
    );
  }

  if (isRootSourceDocument(sourceSnap, context, depth)) {
    await copyVirtualTileSubcollections(sourceSnap, destRef, context, depth);
  }
}

function isRootSourceDocument(sourceSnap, context, depth) {
  return (
    depth === 0 &&
    sourceSnap.ref.parent.id === context.options.sourceCollection
  );
}

function getTileIdsFromLayoutData(data, options) {
  if (!Array.isArray(data?.tiles)) return [];

  const ids = new Set();
  for (const tile of data.tiles) {
    const id = tile?.i;
    if (typeof id !== "string" || id.length === 0 || id.includes("/")) continue;

    const tileType = tile?.content?.type;
    if (
      !options.scanAllTileSubcollections &&
      !TILE_TYPES_WITH_NESTED_COLLECTIONS.has(tileType)
    ) {
      continue;
    }

    ids.add(id);
  }
  return [...ids];
}

async function mapWithConcurrency(items, concurrency, worker) {
  const executing = new Set();

  for (const item of items) {
    const promise = Promise.resolve()
      .then(() => worker(item))
      .finally(() => {
        executing.delete(promise);
      });

    executing.add(promise);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

async function copyVirtualTileSubcollections(
  sourceSnap,
  destRef,
  context,
  depth,
) {
  const tileIds = getTileIdsFromLayoutData(sourceSnap.data(), context.options);
  if (tileIds.length === 0) return;

  context.stats.virtualTileDocumentsConsidered += tileIds.length;
  const sourceTilesCollection = sourceSnap.ref.collection("tiles");
  const destTilesCollection = destRef.collection("tiles");

  await mapWithConcurrency(tileIds, context.options.tileProbeConcurrency, async (tileId) => {
    const sourceTileRef = sourceTilesCollection.doc(tileId);
    const destTileRef = destTilesCollection.doc(tileId);
    const tileSubcollections = await sourceTileRef.listCollections();

    if (tileSubcollections.length === 0) return;

    context.stats.virtualTileDocumentsScanned += 1;
    console.warn(
      `Discovered ${tileSubcollections.length} subcollection(s) under virtual tile doc ${sourceTileRef.path}`,
    );

    for (const sourceSubcollection of tileSubcollections) {
      await copyCollectionRecursively(
        sourceSubcollection,
        destTileRef.collection(sourceSubcollection.id),
        context,
        depth + 2,
      );
    }
  });
}

async function copyCollectionRecursively(
  sourceCollection,
  destCollection,
  context,
  depth,
) {
  const sourceCollectionPath = sourceCollection.path || sourceCollection.id;
  if (context.visitedCollectionPaths.has(sourceCollectionPath)) {
    context.stats.collectionsSkippedAsAlreadyScanned += 1;
    return;
  }
  context.visitedCollectionPaths.add(sourceCollectionPath);
  context.stats.collectionsScanned += 1;

  let lastDocId = depth === 0 ? context.options.startAfter : null;
  let copiedAtThisLevel = 0;
  let rootLimitReached = false;

  while (true) {
    let query = sourceCollection
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(context.options.pageSize);

    if (lastDocId) {
      query = query.startAfter(lastDocId);
    }

    const page = await query.get();
    if (page.empty) break;

    for (const sourceSnap of page.docs) {
      if (
        depth === 0 &&
        context.options.maxRootDocs != null &&
        context.stats.rootDocumentsScanned >= context.options.maxRootDocs
      ) {
        rootLimitReached = true;
        break;
      }

      const destRef = destCollection.doc(sourceSnap.id);
      if (depth === 0) {
        context.stats.rootDocumentsScanned += 1;
      }
      copiedAtThisLevel += 1;

      await copyDocumentRecursively(sourceSnap, destRef, context, depth);
      lastDocId = sourceSnap.id;
    }

    if (!context.options.dryRun) {
      await context.bulkWriter.flush();
    }

    console.warn(
      `Scanned ${copiedAtThisLevel} docs from ${sourceCollectionPath}`,
    );

    if (rootLimitReached || page.size < context.options.pageSize) break;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectId = resolveProjectId(options.projectId);
  if (!projectId) {
    throw new Error(
      "Unable to determine project ID. Pass --project-id=<id> or set GOOGLE_CLOUD_PROJECT.",
    );
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const stats = createStats();
  const bulkWriter = createBulkWriter(db, stats);

  console.warn(
    `${options.dryRun ? "Dry run" : "WRITE MODE"}: copying ${options.sourceCollection} -> ${options.destinationCollection} in project ${projectId}`,
  );
  if (options.startAfter) {
    console.warn(`Starting after root document ID: ${options.startAfter}`);
  }
  if (options.maxRootDocs != null) {
    console.warn(`Stopping after ${options.maxRootDocs} root document(s).`);
  }

  await copyCollectionRecursively(
    db.collection(options.sourceCollection),
    db.collection(options.destinationCollection),
    {
      options,
      stats,
      bulkWriter,
      visitedCollectionPaths: new Set(),
    },
    0,
  );

  await bulkWriter.close();

  console.warn("Migration copy complete.");
  console.warn(JSON.stringify(stats, null, 2));

  if (stats.writesFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Migration copy failed:", error);
  process.exitCode = 1;
});
