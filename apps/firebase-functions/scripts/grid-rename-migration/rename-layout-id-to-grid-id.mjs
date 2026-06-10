#!/usr/bin/env node

/**
 * One-time migration helper: rename top-level Firestore fields that still use
 * layout terminology. This updates documents in place and does not create
 * replacement collections.
 *
 * Default collections are the current known stored-field locations:
 *   - analyticsEvents
 *   - gridStats
 *   - notification_tracking
 *   - users
 *
 * Safe defaults:
 *   - dry-run unless `--write --confirm=layout-id-to-grid-id` is provided
 *   - skips docs where the destination field already exists with a different
 *     value unless `--overwrite-destination-fields` is explicitly provided
 *   - optional `--field-renames=old:new,old2:new2` override for dummy/test
 *     collections or one-off collection-specific runs
 *
 * Usage from apps/firebase-functions:
 *   node scripts/grid-rename-migration/rename-layout-id-to-grid-id.mjs --dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
 *     node scripts/grid-rename-migration/rename-layout-id-to-grid-id.mjs --project-id=your-project-id --write --confirm=layout-id-to-grid-id
 */

import admin from "firebase-admin";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PAGE_SIZE = 250;
const MAX_WRITE_RETRIES = 5;
const DEFAULT_COLLECTIONS = [
  "analyticsEvents",
  "gridStats",
  "notification_tracking",
  "users",
];
const FIELD_RENAMES_BY_COLLECTION = {
  analyticsEvents: [["layoutId", "gridId"]],
  gridStats: [["layoutId", "gridId"]],
  notification_tracking: [["layoutId", "gridId"]],
  users: [
    ["recentLayoutIds", "recentGridIds"],
    ["starredLayoutIds", "starredGridIds"],
  ],
};
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..", "..", "..");
const FieldValue = admin.firestore.FieldValue;

function parseArgs(argv) {
  const options = {
    dryRun: true,
    pageSize: DEFAULT_PAGE_SIZE,
    maxDocs: null,
    overwriteDestinationFields: false,
    collections: DEFAULT_COLLECTIONS,
    fieldRenames: null,
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
    if (arg === "--overwrite-destination-fields" || arg === "--overwrite-grid-id") {
      options.overwriteDestinationFields = true;
      continue;
    }
    if (arg.startsWith("--page-size=")) {
      options.pageSize = parsePositiveInt(arg, "--page-size");
      continue;
    }
    if (arg.startsWith("--max-docs=")) {
      options.maxDocs = parsePositiveInt(arg, "--max-docs");
      continue;
    }
    if (arg.startsWith("--collections=")) {
      options.collections = parseCollections(arg);
      continue;
    }
    if (arg.startsWith("--field-renames=")) {
      options.fieldRenames = parseFieldRenames(arg);
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

  if (!options.dryRun && options.confirm !== "layout-id-to-grid-id") {
    throw new Error(
      "Refusing to write without --confirm=layout-id-to-grid-id. Run with --dry-run first.",
    );
  }

  return options;
}

function printHelp() {
  console.warn(`
Rename top-level Firestore fields that still use layout terminology.

Usage:
  node scripts/grid-rename-migration/rename-layout-id-to-grid-id.mjs --dry-run
  node scripts/grid-rename-migration/rename-layout-id-to-grid-id.mjs --write --confirm=layout-id-to-grid-id

Default field renames:
  analyticsEvents.layoutId -> gridId
  gridStats.layoutId -> gridId
  notification_tracking.layoutId -> gridId
  users.recentLayoutIds -> recentGridIds
  users.starredLayoutIds -> starredGridIds

Options:
  --dry-run                Print planned updates without writing. Default.
  --write                  Update documents in place.
  --confirm=layout-id-to-grid-id
                           Required with --write.
  --overwrite-destination-fields
                           If a destination field already exists with a different value,
                           overwrite it. Default is to skip conflicting documents.
  --page-size=<n>          Documents to scan per collection page. Default: ${DEFAULT_PAGE_SIZE}.
  --max-docs=<n>           Stop after scanning n documents total. Useful for testing.
  --collections=<a,b,c>    Root collections to scan. Default: ${DEFAULT_COLLECTIONS.join(",")}.
  --field-renames=<a:b,c:d>
                           Override default collection mappings and apply these top-level
                           field renames to every scanned collection. Useful for dummy
                           collections, e.g. --collections=dummy --field-renames=layoutId:gridId.
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

function parseCollections(arg) {
  const raw = arg.slice("--collections=".length);
  const collections = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (collections.length === 0) {
    throw new Error("--collections must include at least one collection ID.");
  }

  for (const collection of collections) {
    if (!/^[A-Za-z0-9_-]+$/.test(collection)) {
      throw new Error(
        `--collections only supports root collection IDs. Invalid value: ${collection}`,
      );
    }
  }

  return collections;
}

function parseFieldRenames(arg) {
  const raw = arg.slice("--field-renames=".length);
  const pairs = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (pairs.length === 0) {
    throw new Error("--field-renames must include at least one source:destination pair.");
  }

  return pairs.map((pair) => {
    const parts = pair.split(":").map((value) => value.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(
        `--field-renames entries must use source:destination format. Invalid value: ${pair}`,
      );
    }

    const [sourceField, destinationField] = parts;
    for (const field of [sourceField, destinationField]) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) {
        throw new Error(
          `--field-renames only supports top-level simple field names. Invalid field: ${field}`,
        );
      }
    }

    if (sourceField === destinationField) {
      throw new Error(
        `--field-renames source and destination must differ. Invalid pair: ${pair}`,
      );
    }

    return [sourceField, destinationField];
  });
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
    documentsScanned: 0,
    documentsWithRenamedFields: 0,
    documentsQueuedForUpdate: 0,
    documentsSkippedNoMatchingFields: 0,
    documentsSkippedDestinationFieldConflict: 0,
    fieldsQueuedForRename: 0,
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
    console.error(`Failed to update ${error.documentRef.path}:`, error.message);
    return false;
  });

  return bulkWriter;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function fieldRenamesForCollection(collectionId, options) {
  return options.fieldRenames ?? FIELD_RENAMES_BY_COLLECTION[collectionId] ?? [];
}

async function maybeQueueRename(snapshot, context) {
  const data = snapshot.data();
  context.stats.documentsScanned += 1;
  const renames = fieldRenamesForCollection(snapshot.ref.parent.id, context.options);

  const applicableRenames = renames.filter(([sourceField]) =>
    hasOwn(data, sourceField),
  );
  if (applicableRenames.length === 0) {
    context.stats.documentsSkippedNoMatchingFields += 1;
    return;
  }

  const conflictingDestinationFields = [];
  for (const [sourceField, destinationField] of applicableRenames) {
    if (
      hasOwn(data, destinationField) &&
      !valuesEqual(data[destinationField], data[sourceField])
    ) {
      conflictingDestinationFields.push(destinationField);
    }
  }

  if (
    conflictingDestinationFields.length > 0 &&
    !context.options.overwriteDestinationFields
  ) {
    context.stats.documentsSkippedDestinationFieldConflict += 1;
    console.warn(
      `Skipping ${snapshot.ref.path}: destination field(s) already exist with different value(s): ${conflictingDestinationFields.join(", ")}`,
    );
    return;
  }

  context.stats.documentsWithRenamedFields += 1;

  if (context.options.dryRun) {
    const actions = applicableRenames.map(([sourceField, destinationField]) => {
      const destinationAlreadyMatches =
        hasOwn(data, destinationField) &&
        valuesEqual(data[destinationField], data[sourceField]);
      return destinationAlreadyMatches
        ? `delete ${sourceField}; keep existing matching ${destinationField}`
        : `set ${destinationField} from ${sourceField} and delete ${sourceField}`;
    });
    console.warn(
      `[dry-run] would update ${snapshot.ref.path}: ${actions.join("; ")}`,
    );
    return;
  }

  const update = {};
  for (const [sourceField, destinationField] of applicableRenames) {
    update[destinationField] = data[sourceField];
    update[sourceField] = FieldValue.delete();
  }

  context.bulkWriter.update(snapshot.ref, update);
  context.stats.documentsQueuedForUpdate += 1;
  context.stats.fieldsQueuedForRename += applicableRenames.length;
}

async function scanCollection(collectionRef, context) {
  context.stats.collectionsScanned += 1;
  let lastDocId = null;

  while (true) {
    if (
      context.options.maxDocs != null &&
      context.stats.documentsScanned >= context.options.maxDocs
    ) {
      break;
    }

    let query = collectionRef
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(context.options.pageSize);

    if (lastDocId) {
      query = query.startAfter(lastDocId);
    }

    const page = await query.get();
    if (page.empty) break;

    for (const snapshot of page.docs) {
      if (
        context.options.maxDocs != null &&
        context.stats.documentsScanned >= context.options.maxDocs
      ) {
        break;
      }

      await maybeQueueRename(snapshot, context);
      lastDocId = snapshot.id;
    }

    if (!context.options.dryRun) {
      await context.bulkWriter.flush();
    }

    console.warn(
      `Scanned ${context.stats.documentsScanned} total document(s); current collection ${collectionRef.path || collectionRef.id}`,
    );

    if (page.size < context.options.pageSize) break;
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
    `${options.dryRun ? "Dry run" : "WRITE MODE"}: renaming layout terminology fields in project ${projectId}`,
  );
  console.warn(`Collections: ${options.collections.join(", ")}`);
  if (options.fieldRenames) {
    console.warn(
      `Custom field renames: ${options.fieldRenames
        .map(([sourceField, destinationField]) => `${sourceField}->${destinationField}`)
        .join(", ")}`,
    );
  }
  if (options.maxDocs != null) {
    console.warn(`Stopping after scanning ${options.maxDocs} document(s).`);
  }
  if (options.overwriteDestinationFields) {
    console.warn("Destination field conflicts will be overwritten.");
  }

  for (const collection of options.collections) {
    await scanCollection(db.collection(collection), {
      options,
      stats,
      bulkWriter,
    });

    if (
      options.maxDocs != null &&
      stats.documentsScanned >= options.maxDocs
    ) {
      break;
    }
  }

  await bulkWriter.close();

  console.warn("Field rename scan complete.");
  console.warn(JSON.stringify(stats, null, 2));

  if (
    stats.writesFailed > 0 ||
    stats.documentsSkippedDestinationFieldConflict > 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Field rename migration failed:", error);
  process.exitCode = 1;
});
