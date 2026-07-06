# Storage Migration Runbook

Maintainer-only procedure for migrating legacy storage objects into the content-addressed archive
scheme and for garbage-collecting old objects afterward. For how the storage model works at runtime,
read [Storage, uploads, and deduplication](../architecture/storage-and-uploads.md) first.

The tool is a maintainer CLI (deliberately not a 540s Cloud Function so it can stream-hash and copy
arbitrarily large/many objects): `apps/firebase-functions/src/scripts/storageMigration.ts`, built to
`lib/scripts/storageMigration.js`. Its file header is the authoritative reference for flags and edge
cases; this runbook is the operational summary.

## What it does

Migrates the legacy original-filename scheme
(`users/{uid}/{images|videos|documents|link-images}/{originalName}`) into the canonical scheme
(`users/{uid}/{images|videos|documents}/{sha256}.{ext}`), backed by archive documents at
`users/{uid}/uploads/{hash}`. It stream-hashes each object, copies it to its canonical location, creates
or refreshes the archive document (`shareable: false`), rewrites grid references (URLs + hash fields),
bumps grid `rev`, and stamps `storageSchemaRev`. Referenced `link-images/` objects are relocated into
the canonical `images/` scheme. Cross-user references (from duplicated grids pointing at another user's
object) are copied into the grid owner's own space so each owner's grid is self-contained and deduped;
the source object is never touched.

## Modes

| Mode | Writes? | Purpose |
| --- | --- | --- |
| `inventory` | No | Full scan: referenced vs. unreferenced objects, dangling references, foreign-owner references, and (with `--detect-duplicates`) duplicate content per user. |
| `count` | No | Concise referenced/unreferenced summary across all users (or one with `--user`). |
| `migrate` | With `--commit` | Copy referenced legacy objects to canonical paths, write archive docs, rewrite grids, bump `rev`. `--include-unreferenced` also preserves orphaned legacy objects as File Archive-only files. |
| `recompute-usage` | With `--commit` | Recompute `users/{uid}.storageUsed` from active archive docs (unique, deduped bytes). `--user <uid>` or `--all`. |
| `gc` | With `--commit` | Delete unreferenced objects only. Writes a deletion manifest. |

## Safety model

- **Every write mode is dry-run by default.** Writes require `--commit`.
- **Destructive modes** (`migrate --commit`, `gc --commit`) additionally require `--confirm <projectId>`
  matching the resolved project.
- Copied canonical objects are written **without** the migration skip tag and their archive docs are set
  `active` **before** the copy, so the deployed `onFileUploaded` trigger short-circuits (`already-active`)
  — no double count, no deletion.
- `storageUsed` is never touched by `migrate`; run `recompute-usage` afterward.
- `refCount`s are left to the deployed grid-reference reconciliation triggers, which fire when `migrate`
  rewrites grids (archive docs exist first, so the increments land). Do not set refCounts here.
- `gc` sets the skip-accounting metadata tag before deleting, so `onFileDeleted` never decrements a real
  user's `storageUsed` for an orphan/legacy object.

## Recommended sequence

Run from `apps/firebase-functions/`. `--project` is always required.

```bash
npm run build

# 1. Read-only assessment
node apps/firebase-functions/lib/scripts/storageMigration.js count      --project <project>
node apps/firebase-functions/lib/scripts/storageMigration.js inventory  --project <project> --detect-duplicates

# 2. Migrate: dry run, review, then commit
node apps/firebase-functions/lib/scripts/storageMigration.js migrate --project <project>
node apps/firebase-functions/lib/scripts/storageMigration.js migrate --project <project> --commit --confirm <project>

# 3. Recompute authoritative storage usage (dedupe often lowers it)
node apps/firebase-functionslib/scripts/storageMigration.js recompute-usage --project <project> --all
node apps/firebase-functionslib/scripts/storageMigration.js recompute-usage --project <project> --all --commit

# 4. Bake / grace period, then GC (dry run, then commit)
node apps/firebase-functions/lib/scripts/storageMigration.js gc --project <project>
node apps/firebase-functions/lib/scripts/storageMigration.js gc --project <project> --commit --confirm <project>
```

Common options: `--user <uid>` (scope to one owner), `--bucket <name>`, `--limit <n>` (cap for testing),
`--json` (machine-readable report). Bucket defaults to `${project}.firebasestorage.app`.

## GC gating

Run `gc --commit` only after **all** of the following, per the storage refactor plan:

- The final `migrate` converge pass is clean (no remaining referenced legacy objects).
- No old-style uploads can be created (canonical-only rules are live in production).
- Every reference has been rewritten or explicitly skipped.
- The compatibility grace period has passed (stale clients, cached URLs, open editor sessions).

Do **not** run `gc` concurrently with live uploads: an in-flight upload (pending archive doc + object
present, `onFinalize` not yet run) can look like an untracked canonical orphan and be deleted. GC keeps a
deletion manifest for audit/recovery.

## Removing the legacy `link-images` rules

The `users/{uid}/link-images/` block in `storage.rules` is retained until GC is complete. Before removing
it, confirm via `inventory` that no `link-images/` objects remain referenced and that the migration
relocated them into the canonical `images/` scheme. Removing the rules prematurely can break stale
clients still holding legacy link-image URLs.

## Auth

`admin.ts` initializes with Application Default Credentials. The principal needs Firestore read/write and
Storage read/write/delete on the target project. Either `gcloud auth application-default login` (ensure
`GOOGLE_APPLICATION_CREDENTIALS` is unset) or a service-account key via
`GOOGLE_APPLICATION_CREDENTIALS`. `--project` also drives the SDK's project detection.
