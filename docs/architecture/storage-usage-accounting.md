# Storage Usage Accounting

Each user document (`users/{uid}`) carries a `storageUsed` field: the total bytes of that user's
unique, active uploaded files. It backs the free-tier storage quota (5 GB; developer accounts are
exempt). `storageUsed` is **server-authoritative** — only Cloud Functions write it; the client only
reads it (e.g. the File Archive usage bar).

This document describes how `storageUsed` changes, with an emphasis on the **deletion path**, because
that path is easy to get wrong (see "Why deletion decrements in the callable" below).

## Main Locations

- `apps/firebase-functions/src/storage/utils_storageUsage.ts` - `incrementUserStorageUsage`,
  `decrementUserStorageUsage`, `setUserStorageUsed`, and the `gridsStorageSkipAccounting` tag +
  `parseUserStorageObject` (which skips tagged / non-canonical objects).
- `apps/firebase-functions/src/storage/onTrigger_fileUploaded.ts` - upload finalize trigger; the
  single writer of the **increment**.
- `apps/firebase-functions/src/storage/onCall_deleteStorageUpload.ts` - permanent-delete callable;
  the single writer of the delete-time **decrement**.
- `apps/firebase-functions/src/storage/onTrigger_fileDeleted.ts` - delete trigger; a **backstop**
  only (see below).
- `apps/firebase-functions/src/storage/utils_uploadArchive.ts` - archive-doc helpers, including
  `deleteUploadArchiveAndDecrementUsage` (atomic doc-delete + decrement).
- `apps/firebase-functions/src/scripts/storageMigration.ts` - maintainer CLI with `recompute-usage`
  to rebuild `storageUsed` authoritatively from active archive docs.

## The increment (upload)

`storageUsed` goes **up** when a new, unique file is finalized. The client uploads directly to the
bucket; when the object lands, the `onFileUploaded` finalize trigger verifies the object's hash,
activates the pending archive doc (`users/{uid}/uploads/{hash}`), and calls
`incrementUserStorageUsage` **once**. Duplicates (an already-active archive doc for the same hash),
hash mismatches, and migration-tagged / non-canonical objects do not increment. The upload path is
unaffected by soft delete — finalize (`OBJECT_FINALIZE`) fires immediately on upload.

## The decrement (permanent deletion)

A user permanently deletes a file from the File Archive. The client calls `deleteStorageUpload`; it
never touches the bucket object directly. The callable, in order:

1. Verifies auth + ownership, and requires an explicit `force` flag when `refCount > 0`.
2. **Stamps the `gridsStorageSkipAccounting` metadata tag on the bucket object.** If tagging fails
   for any reason other than "object already gone" (404), the callable aborts and deletes nothing.
3. Deletes the bucket object (`ignoreNotFound: true`).
4. Calls `deleteUploadArchiveAndDecrementUsage`, which — in a **single Firestore transaction** —
   deletes the archive doc and subtracts its `size` from `storageUsed` (clamped at 0).

### Why deletion decrements in the callable, not the delete trigger

The original design decremented `storageUsed` in the `onFileDeleted` storage trigger. **That does not
work with Cloud Storage soft delete, which is enabled by default on all buckets (7-day retention.)**

Firebase's v1 `object().onDelete()` is bound to the Cloud Storage `OBJECT_DELETE` event, which fires
only when an object is **permanently** deleted. With soft delete on, deleting an object moves it to a
recoverable soft-deleted state — not a permanent delete — so `OBJECT_DELETE` is **not** emitted at
delete time. (At best it fires when the retention window purges the object ~7 days later, if at all.)
The symptom: permanent deletes silently stop lowering `storageUsed`, and there are no `onFileDeleted`
logs.

Doing the decrement in the callable makes it immediate and deterministic, independent of bucket
delete-event semantics.

### How double-counting is prevented (exactly-once)

- **Callable vs. trigger:** the callable stamps the skip-accounting tag *before* deleting the object,
  so if `OBJECT_DELETE` ever does fire later (soft-delete purge), `parseUserStorageObject` returns
  null and `onFileDeleted` no-ops. The two decrement sources are mutually exclusive by construction.
- **Concurrent / retried callable invocations:** the archive doc is the idempotency token. The
  doc-delete and the decrement happen in one transaction, so a second invocation finds the doc
  already gone and does not decrement again.

### `onFileDeleted` is a backstop

It is intentionally kept, not removed. It handles permanent deletions that bypass the callable
(console hard-delete, a future lifecycle rule, admin scripts). Every *deliberate* delete path — the
callable, the hash-mismatch quarantine in `onFileUploaded`, and `storageMigration` gc — stamps the
skip-accounting tag first, so the trigger can never double-count them.

> **Do not move the delete-time decrement back into `onFileDeleted`.** Under soft delete it will not
> fire, and `storageUsed` will drift upward on every deletion.

## Repairing drift

`storageUsed` is a running counter, so it can drift (e.g. deletes that happened while soft delete was
swallowing the trigger event, before this change). To rebuild it authoritatively from the user's
active archive docs, run the maintainer CLI:

```bash
# from apps/firebase-functions/, after: npm run build
node lib/scripts/storageMigration.js recompute-usage --project <project> --all          # dry run
node lib/scripts/storageMigration.js recompute-usage --project <project> --all --commit # write
```

## Related

- `notes/storage-refactor.md` - full storage refactor design, including the deletion-flow diagram and
  the detailed "Where the decrement lives" note.
- `docs/getting-started/firebase-emulators.md` - note that Cloud Storage triggers behave differently
  (and often do not fire) under the emulator.
