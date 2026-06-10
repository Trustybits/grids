#!/usr/bin/env node

/**
 * Read-only Firestore verification helper: count documents and nested
 * subcollections below a root collection.
 *
 * This is intended for migration verification, e.g. count `layouts`, copy to
 * `grids`, then count `grids` and compare totals.
 *
 * Important Firestore wrinkle:
 *   Some nested data may live below "virtual" tile documents, such as
 *   layouts/{layoutId}/tiles/{tileId}/messages/{messageId}, where the tile doc
 *   itself may not exist as a stored document. A plain recursive traversal can
 *   miss those paths. By default this script probes tile IDs from each root
 *   grid/layout document for tile types known to have nested collections.
 *
 * Usage from apps/firebase-functions:
 *   node scripts/grid-rename-migration/count-collection-tree.mjs --collection=layouts
 *   node scripts/grid-rename-migration/count-collection-tree.mjs --project-id=your-project-id --collection=grids --json
 */

/* eslint-disable no-console */

import admin from "firebase-admin";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_TILE_PROBE_CONCURRENCY = 25;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..", "..", "..");
const TILE_TYPES_WITH_NESTED_COLLECTIONS = new Set(["chat", "roadmap_feed"]);

function parseArgs(argv) {
  const options = {
    collection: null,
    pageSize: DEFAULT_PAGE_SIZE,
    startAfter: null,
    maxRootDocs: null,
    tileProbeConcurrency: DEFAULT_TILE_PROBE_CONCURRENCY,
    scanAllTileSubcollections: false,
    projectId: null,
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith("--collection=")) {
      options.collection = parseCollectionName(arg, "--collection");
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
    if (arg.startsWith("--project-id=")) {
      options.projectId = parseProjectId(arg);
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.collection) {
    throw new Error("--collection=<collectionId> is required.");
  }

  return options;
}

function printHelp() {
  console.warn(`
Count Firestore documents and nested subcollections below a root collection.

Usage:
  node scripts/grid-rename-migration/count-collection-tree.mjs --collection=layouts
  node scripts/grid-rename-migration/count-collection-tree.mjs --collection=grids --json

Options:
  --collection=<id>        Root collection ID to count. Required.
  --page-size=<n>          Documents to read per collection page. Default: ${DEFAULT_PAGE_SIZE}.
  --tile-probe-concurrency=<n>
                           Concurrent virtual tile subcollection checks. Default: ${DEFAULT_TILE_PROBE_CONCURRENCY}.
  --scan-all-tile-subcollections
                           Probe every tile ID instead of only known nested-data tile types.
  --start-after=<docId>    Resume root collection scan after this document ID.
  --max-root-docs=<n>      Stop after n root documents. Useful for testing.
  --project-id=<id>        Firebase/GCP project ID. Defaults to env vars, then .firebaserc default.
  --json                   Print final stats as JSON.
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

function createStats(rootCollection) {
  return {
    rootCollection,
    rootDocuments: 0,
    nestedDocuments: 0,
    totalDocuments: 0,
    subcollectionInstances: 0,
    virtualTileDocumentsConsidered: 0,
    virtualTileDocumentsWithSubcollections: 0,
    collectionsScanned: 0,
    collectionInstancesById: {},
    documentsByCollectionId: {},
    lastRootDocumentId: null,
  };
}

function increment(map, key, by = 1) {
  map[key] = (map[key] || 0) + by;
}

function isRootDocument(ref, rootCollection) {
  return ref.parent.id === rootCollection && ref.path.split("/").length === 2;
}

function createTraversalContext() {
  return {
    scannedCollectionPaths: new Set(),
    subcollectionPathsSeen: new Set(),
  };
}

async function countCollectionTree(
  collectionRef,
  stats,
  options,
  context,
  depth = 0,
) {
  if (context.scannedCollectionPaths.has(collectionRef.path)) return;
  context.scannedCollectionPaths.add(collectionRef.path);
  stats.collectionsScanned += 1;

  let query = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).limit(options.pageSize);
  if (depth === 0 && options.startAfter) {
    query = query.startAfter(options.startAfter);
  }

  let scannedRootDocs = 0;

  while (true) {
    const snap = await query.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      if (depth === 0 && options.maxRootDocs && scannedRootDocs >= options.maxRootDocs) {
        return;
      }

      const rootDoc = isRootDocument(docSnap.ref, options.collection);
      if (rootDoc) {
        stats.rootDocuments += 1;
        stats.lastRootDocumentId = docSnap.id;
        scannedRootDocs += 1;
      } else {
        stats.nestedDocuments += 1;
      }

      stats.totalDocuments += 1;
      increment(stats.documentsByCollectionId, docSnap.ref.parent.id);

      const subcollectionRefs = await listSubcollectionRefs(docSnap.ref);
      for (const subcollectionRef of subcollectionRefs) {
        registerSubcollectionInstance(subcollectionRef, stats, context);
        await countCollectionTree(
          subcollectionRef,
          stats,
          options,
          context,
          depth + 1,
        );
      }

      if (rootDoc) {
        await countVirtualTileSubcollections(docSnap, stats, options, context);
      }
    }

    const lastDoc = snap.docs.at(-1);
    if (!lastDoc || snap.size < options.pageSize) break;
    query = collectionRef
      .orderBy(admin.firestore.FieldPath.documentId())
      .startAfter(lastDoc.id)
      .limit(options.pageSize);
  }
}

async function countVirtualTileSubcollections(rootDocSnap, stats, options, context) {
  const tiles = Array.isArray(rootDocSnap.data()?.tiles)
    ? rootDocSnap.data().tiles
    : [];
  const tileRefs = [];

  for (const tile of tiles) {
    const tileId = typeof tile?.i === "string" ? tile.i : null;
    const tileType = typeof tile?.content?.type === "string" ? tile.content.type : null;
    if (!tileId) continue;
    if (
      !options.scanAllTileSubcollections &&
      !TILE_TYPES_WITH_NESTED_COLLECTIONS.has(tileType)
    ) {
      continue;
    }

    tileRefs.push(rootDocSnap.ref.collection("tiles").doc(tileId));
  }

  stats.virtualTileDocumentsConsidered += tileRefs.length;
  await runWithConcurrency(tileRefs, options.tileProbeConcurrency, async (tileRef) => {
    const subcollectionRefs = await listSubcollectionRefs(tileRef);
    if (subcollectionRefs.length === 0) return;

    stats.virtualTileDocumentsWithSubcollections += 1;
    for (const subcollectionRef of subcollectionRefs) {
      registerSubcollectionInstance(subcollectionRef, stats, context);
      await countCollectionTree(
        subcollectionRef,
        stats,
        options,
        context,
        2,
      );
    }
  });
}

async function runWithConcurrency(items, concurrency, worker) {
  let index = 0;

  async function runNext() {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, runNext));
}

async function listSubcollectionRefs(docRef) {
  return (await docRef.listCollections()).sort((a, b) =>
    a.path.localeCompare(b.path),
  );
}

function registerSubcollectionInstance(collectionRef, stats, context) {
  if (context.subcollectionPathsSeen.has(collectionRef.path)) return;
  context.subcollectionPathsSeen.add(collectionRef.path);
  stats.subcollectionInstances += 1;
  increment(stats.collectionInstancesById, collectionRef.id);
}

function printStats(stats, options, projectId) {
  if (options.json) {
    console.log(JSON.stringify({ projectId, ...stats }, null, 2));
    return;
  }

  console.log(`Counted collection tree in project ${projectId}`);
  console.log(`Root collection: ${stats.rootCollection}`);
  console.log("");
  console.log(`Root documents: ${stats.rootDocuments}`);
  console.log(`Nested documents: ${stats.nestedDocuments}`);
  console.log(`Total documents: ${stats.totalDocuments}`);
  console.log(`Subcollection instances: ${stats.subcollectionInstances}`);
  console.log(`Collections scanned: ${stats.collectionsScanned}`);
  console.log(`Virtual tile docs considered: ${stats.virtualTileDocumentsConsidered}`);
  console.log(
    `Virtual tile docs with subcollections: ${stats.virtualTileDocumentsWithSubcollections}`,
  );
  if (stats.lastRootDocumentId) {
    console.log(`Last root document ID: ${stats.lastRootDocumentId}`);
  }

  console.log("");
  console.log("Documents by collection ID:");
  for (const [collectionId, count] of Object.entries(stats.documentsByCollectionId).sort()) {
    console.log(`  ${collectionId}: ${count}`);
  }

  console.log("");
  console.log("Subcollection instances by collection ID:");
  for (const [collectionId, count] of Object.entries(stats.collectionInstancesById).sort()) {
    console.log(`  ${collectionId}: ${count}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectId = resolveProjectId(options.projectId);
  if (!projectId) {
    throw new Error(
      "Unable to resolve project ID. Pass --project-id=<id>, set GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT, or configure .firebaserc.",
    );
  }

  admin.initializeApp({ projectId });
  const db = admin.firestore();
  const stats = createStats(options.collection);
  const context = createTraversalContext();

  await countCollectionTree(
    db.collection(options.collection),
    stats,
    options,
    context,
  );
  printStats(stats, options, projectId);
}

main().catch((error) => {
  console.error("Collection count failed:", error);
  process.exitCode = 1;
});
