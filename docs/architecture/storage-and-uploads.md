# Storage, Uploads, and Deduplication

This document describes how Grids stores user-owned files (images, videos, documents), how it
deduplicates them, how it counts references and storage usage, and how the client, Cloud Functions,
and security rules cooperate to keep the model correct.

It is grounded in the code as of the storage refactor cutover. Where a detail matters, the owning
source file is named. If this document and the code ever disagree, the code is authoritative.

## Goals of the model

- **Content addressing.** A file's identity is the SHA-256 hash of its bytes. Two identical files —
  even uploaded separately, or by the same user twice — resolve to one stored object.
- **Per-user deduplication.** Each user's uploads are deduped within their own namespace. Uploading a
  file the user already has is a no-op that returns the existing URL.
- **Server-owned accounting.** `storageUsed`, `refCount`, and the `shareable` flag are written only by
  Cloud Functions / the Admin SDK. Clients can read their own archive but never write to it.
- **Files outlive tiles.** Deleting a tile or a grid never deletes a stored object. Only an explicit
  File Archive "permanent delete" removes bytes.
- **Optimistic UI preserved.** The client still shows a local blob preview immediately and only
  swaps in the canonical URL once the server has verified the upload.

## Storage layout

User-owned uploads live at a **canonical, content-addressed path**:

```text
users/{uid}/{images|videos|documents}/{sha256}.{ext}
```

- `{sha256}` is a lowercase 64-char hex digest of the file bytes (`^[a-f0-9]{64}$`).
- `{ext}` is a short, rules-safe extension (`^[a-z0-9][a-z0-9-]{0,15}$`), derived from the filename and
  falling back to the MIME subtype.
- `{kind}` is one of `images`, `videos`, `documents`.

Path construction and parsing are centralized so the client, Cloud Functions, and security rules all
agree on the shape:

- `apps/firebase-functions/src/storage/utils_uploadPaths.ts` — `buildCanonicalUploadPath`,
  `parseCanonicalUploadPath`, and the field normalizers (`normalizeHash`, `normalizeExtension`,
  `normalizeUploadKind`, `normalizeUploadSize`, `normalizeContentType`, `normalizeDisplayName`).
- The client mirrors path construction in `apps/web/src/services/StorageService.ts`
  (`deriveExtension`, `authorizeAndUpload`).

### The dedupe index (upload archive documents)

For every canonical object there is exactly one Firestore document — the **upload archive document** —
keyed by the file's hash:

```text
users/{uid}/uploads/{hash}
```

This document is the dedupe index and the source of truth for a file's metadata, reference count,
sharing state, and lifecycle status. Its shape is defined in two places that are kept in lockstep:

- Contract type: `UploadArchiveDocument` in `packages/contracts/src/types/Storage.ts`.
- Server type: `UploadArchiveDoc` in `apps/firebase-functions/src/storage/utils_uploadArchive.ts`.

Fields:

| Field | Meaning |
| --- | --- |
| `uid` | Owner. |
| `hash` | SHA-256 of the bytes; also the document ID and the canonical filename stem. |
| `kind` | `images` / `videos` / `documents`. |
| `path` | Canonical Storage path of the object. |
| `url` | `?alt=media` download URL (present once `active`). |
| `displayName` | Human label shown in the File Archive; defaults to `{hash}.{ext}`. Rename-only. |
| `size` | Byte size (one file's bytes, counted once). |
| `contentType`, `ext` | Content type and extension. |
| `status` | `pending` → `active` → (or) `failed`. |
| `refCount` | How many grid references currently point at this hash. Server-reconciled. |
| `shareable` | Whether other users may copy/download it. Defaults to `false`. |
| `createdAt` / `updatedAt` / `activatedAt` / `failedAt` | Lifecycle timestamps. |
| `failureReason` | Set when `status === "failed"` (e.g. `hash-mismatch`, `metadata-mismatch`, `missing-reservation`). |

An archive document's lifecycle statuses:

- **`pending`** — a reservation exists (the server has authorized an upload) but the bytes have not yet
  been verified. Created by `authorizeStorageUpload` / the duplicate-copy path.
- **`active`** — the object exists, its bytes have been server-verified against the claimed hash, and it
  counts toward storage usage. Only `active` documents are "real" files.
- **`failed`** — verification failed. The object was deleted/quarantined and does not count toward usage.
  A subsequent authorize call resets a `failed` document back to `pending`.

## Deduplication: hash is identity

Because the object path and the archive document are both keyed by the content hash, deduplication is
structural rather than a separate pass:

- Two uploads of the same bytes by the same user target the same path and the same
  `users/{uid}/uploads/{hash}` document. The second `authorizeStorageUpload` sees an `active` document
  with matching metadata and returns `{ uploadRequired: false, url }` — no bytes are re-uploaded and
  `storageUsed` is not increased.
- The same file used by many tiles/grids is stored once; `refCount` records how many references exist.
- A hash collision with **mismatched** metadata (different kind/size/content-type/ext for the same
  digest) is rejected with an `already-exists` error (`assertArchiveMetadataMatches`). In practice this
  only guards against malformed clients — SHA-256 makes accidental collisions a non-issue.

## Upload lifecycle

The end-to-end flow for a new user file:

```text
client                                    Cloud Functions / Storage
------                                    -------------------------
1. hash the bytes (SHA-256, chunked)
2. authorizeStorageUpload(metadata) -----> reserve: pending archive doc (quota-checked)
   <---- { uploadRequired, path, url? }
3. if !uploadRequired: done (dedupe hit; use returned url)
4. else upload bytes to canonical path --> onFinalize trigger:
                                             - stream-hash object, compare to path hash
                                             - mismatch -> mark failed + delete object
                                             - else set published metadata + token,
                                               finalize doc pending -> active,
                                               increment storageUsed once
5. subscribe to archive doc; resolve when
   status === "active" (or reject on failed)
```

### 1–2. Client hashing and authorization

- The client hashes the file with `hashFile` (`apps/web/src/utils/FileHashing.ts`, backed by
  `hash-wasm`) so large videos hash incrementally without loading the whole file into memory. Hash
  progress is surfaced separately from upload progress so the UI can show "preparing" state.
- `StorageService.authorizeAndUpload` calls the `authorizeStorageUpload` callable with **metadata only**
  (`hash`, `size`, `kind`, `ext`, `contentType`, `displayName`) — never the bytes.
- `authorizeStorageUpload` (`onCall_authorizeStorageUpload.ts` →
  `authorizeUploadReservation` in `utils_uploadArchive.ts`) runs a Firestore transaction:
  - **Active + matching metadata** → returns `{ uploadRequired: false, url }`. Dedupe hit.
  - **Missing document** → checks quota, writes a `pending` reservation, returns
    `{ uploadRequired: true, path }`.
  - **Pending document** → refreshes the reservation, returns `{ uploadRequired: true, path }`.
  - **Failed document** → checks quota, resets to `pending` (clears `failedAt`/`failureReason`), returns
    `{ uploadRequired: true, path }`.
  - **Mismatched metadata for the same hash** → throws `already-exists`.
- Authorization **never** increments `storageUsed` and **never** changes `refCount`. A reservation is not
  a durable reference — the saved grid state is the source of truth for references (see below).

### 3. Dedupe short-circuit

If `uploadRequired` is `false`, the client uses the returned canonical URL directly and skips the byte
upload entirely.

### 4. Byte upload and server verification

- The client uploads the bytes to the authorized canonical path via the `StorageDao`
  (`upload` / `uploadResumable`). For optimistic tile uploads the resumable variant streams progress.
- The `onFileUploaded` trigger (`onTrigger_fileUploaded.ts`, a v1 Storage `onFinalize` function) then:
  1. Ignores anything that is not a canonical user upload, and anything carrying a migration/skip tag
     (`parseUserStorageObject` in `utils_storageUsage.ts`).
  2. **Re-hashes the object server-side** by streaming it (`hashStorageObject` in `utils_storageHash.ts`)
     and compares the actual digest to the hash in the path.
  3. On **mismatch**: marks the archive document `failed` with reason `hash-mismatch` and deletes the
     object (tagged so the delete does not touch accounting). The file never becomes usable.
  4. On match: stamps the object metadata with `published: "true"` and a download token, then finalizes
     the archive document from `pending` to `active` (`finalizeUploadArchiveDoc`) with the URL, size,
     content type, path, and timestamps. `shareable` stays whatever it was (default `false`).
  5. Increments `storageUsed` once for the newly-active object (`incrementUserStorageUsage`).
- Finalization is **idempotent**: a duplicate/retried finalize event sees `status === "active"` and
  short-circuits (`already-active`) without double-counting. A finalize with no reservation
  (`missing-reservation`) or mismatched metadata marks failed and deletes the object.

### 5. Client waits for finalize

`StorageService.waitForFinalize` subscribes to the archive document (via the realtime
`UploadArchiveDao`) after the byte upload completes:

- Resolves with the authoritative URL when `status` flips to `active`.
- Rejects (surfacing a user-facing error and reverting the optimistic tile) when `status` is `failed`.
- Falls back to the uploaded URL after a 60s timeout if finalization is never observed, rather than
  hanging.

## Reference counting

`refCount` on each archive document tracks how many grid references currently point at that hash. It is
reconciled **server-side from saved grid state**, never by the client and never by upload authorization.

- The triggers `onGridStorageReferencesCreated/Updated/Deleted`
  (`onTrigger_gridStorageReferences.ts`) fire on every grid create/update/delete.
- They extract the archive-backed references from the before/after grid snapshots
  (`extractGridStorageReferencesFromRecord`), count them per hash (`countReferencesByHash`), diff the two
  multisets, and apply the deltas with `adjustUploadRefCounts`.
- On create, all references increment. On delete, all references decrement. On update, only the delta
  changes. Adding the same file to two tiles increments the hash twice; removing one decrements once.
- **Ownership changes** (a grid's `userId` changing between snapshots) decrement the old owner's counts
  and increment the new owner's counts separately.
- `adjustUploadRefCounts` clamps at zero and logs (rather than throwing) when an archive document is
  missing, so a malformed reference can never corrupt accounting or crash the trigger.
- Reaching `refCount == 0` **never** deletes the object — an unreferenced file simply sits in the user's
  File Archive until they permanently delete it.

### What counts as a reference

The single source of truth for "which grid fields are archive-backed" is the runtime extractor
`packages/contracts/src/storage/GridStorageReferences.ts`, shared by the reconciliation triggers, the
duplication callable, and web/migration callers. It reads a **stored hash first**, falling back to
parsing a canonical URL only when the hash field is absent (`source: "stored-hash"` vs `"url-fallback"`).

Archive-backed reference fields:

| Location | Hash field / URL field |
| --- | --- |
| Grid background image | `backgroundImageHash` / `backgroundImageSrc` |
| Image tile | `content.srcHash` / `content.src` |
| Video tile | `content.srcHash` / `content.src` |
| Document tile item | `items[].hash` / `items[].url` |
| Link custom image | `content.customImageHash` / `content.customImageUrl` |
| Profile photo | `content.profilePhotoHash` / `content.profilePhotoUrl` |
| Smart-text inline image | Tiptap image node `attrs.hash` / `attrs.src` |

The extractor deliberately **ignores** anything that is not a canonical user object: external URLs,
`blob:`/`data:` URLs, scraped link/OG/favicon images, embeds, thumbnails, demo assets, another owner's
files, and pre-migration original-filename objects (which carry no archive document). Those are handled
by rendering directly and/or by migration, not by refCount.

## Storage usage and quota

`users/{uid}.storageUsed` is the sum of the user's **unique, active** object bytes. It is written only by
Cloud Functions (`utils_storageUsage.ts`):

- `incrementUserStorageUsage` — once per newly-active object, from the finalize trigger.
- `decrementUserStorageUsage` — once per canonical active-object delete, from `onFileDeleted`
  (`onTrigger_fileDeleted.ts`); clamps at zero and skips migration-tagged deletes.
- `setUserStorageUsed` — authoritative overwrite used by migration recompute.

Quota:

- The free-tier limit is `STORAGE_QUOTA_BYTES = 5,368,709,120` bytes (5 GiB), defined in
  `utils_uploadPaths.ts`.
- Quota is checked **before** a new unique object is authorized (`authorizeUploadReservation`) and again
  before a grid duplicate copies files (`assertUserHasStorageQuota`). A dedupe hit costs no quota.
- Accounts with `users/{uid}.isDevAccount === true` are exempt from quota. `isDevAccount` is
  server-owned (clients can read but not write it).
- The Storage security rules independently re-check quota at write time, so quota is enforced even if a
  client skips the callable (see "Security rules").

## Per-file sharing and downloads

Each archive document has a `shareable` boolean, defaulting to `false` for all new and migrated files.
It is a single flag that controls two things: whether another user can copy the file when duplicating a
grid, and whether the app exposes a download for it.

- Because archive documents are server-write-only, the owner toggles sharing through the
  `setStorageUploadShareable` callable (`onCall_setStorageUploadShareable.ts`), which verifies ownership
  and updates only the `shareable` flag. The File Archive UI shows optimistic pending/error state rather
  than writing Firestore directly.
- `getStorageUploadDownloadUrl` (`onCall_getStorageUploadDownloadUrl.ts`) returns a download URL for a
  source owner's file **only** when that file is `active` and `shareable === true`. Downloading a
  shareable file just fetches bytes — it does **not** create an archive document for the downloader,
  does not change any `refCount`, and does not count against the downloader's quota.
- Renaming is display-only: `setStorageUploadDisplayName` (`onCall_setStorageUploadDisplayName.ts`)
  changes only `displayName`. The object path, hash, and grid references are untouched.

## Grid duplication and cross-owner copies

Full grid duplication must not point the new owner's grid at another user's storage object. The
`prepareGridDuplicateStorage` callable (`onCall_prepareGridDuplicateStorage.ts`) owns the storage side:

- **`copyDepth: "structure"`** is a no-op (no files copied).
- **`copyDepth: "full"`** inventories the source grid's archive-backed references by hash, reads each
  source archive document, and splits them into:
  - **Copiable** — the file is shareable, or the caller is the source owner. Same-owner "duplicate"
    reuses the caller's existing archive (deduped, no copy needed when already `active`).
  - **Non-copiable** — no archive document, or `shareable === false` on another user's file. The tiles
    that depend on them are returned as `replacementTileIds` (to become suggestion tiles), and a
    non-shareable background image is flagged via `removeBackgroundImage`.
- It computes `additionalBytesRequired` from only the copiable files the target does **not** already
  have (per-user dedupe), and enforces the target's quota before doing anything.
- When called with `confirmed: true`, it copies each needed object to the target's canonical path,
  creates the target's `pending` archive reservation, stamps published metadata + a token, and returns a
  `rewriteMap` of old → new hash/URL plus the tile replacement info. The duplicated grid is then saved
  with the new owner's URLs/hashes, so the normal grid-create reconciliation increments the **new**
  owner's `refCount`s.
- The **source owner's `refCount`s are never changed** when someone else duplicates their grid.

The client presents a confirmation prompt before duplicating a grid with file-backed tiles, describing
the additional quota required and noting when non-shareable tiles will be replaced.

## Deletion semantics

There are two very different "deletes":

- **Removing a tile or deleting a grid** removes references. The reconciliation triggers decrement the
  affected hashes' `refCount`. **No bytes are deleted.** The file remains in the owner's File Archive.
- **Permanent delete** from the File Archive is the only path that removes bytes.
  `deleteStorageUpload` (`onCall_deleteStorageUpload.ts`) verifies ownership, requires an explicit
  `force: true` when `refCount > 0` (otherwise it refuses with `failed-precondition`), deletes the
  archive document, and then deletes the Storage object. The `onFileDeleted` trigger decrements
  `storageUsed`.

Direct bucket deletion is intentionally **not** available to client flows. As of the cutover the
client-side `StorageDao` no longer exposes a `delete()` method or the legacy `buildFilePath` (timestamped
original-filename) builder at all — see `StorageServiceInterface` and `StorageService`, which expose
only archive-oriented operations plus `uploadToPath` for fixed-location assets (custom OG images).

## Grid `rev` and save-conflict safety

Whole-document grid saves could otherwise clobber a server-rewritten URL (e.g. during migration). Grids
carry a monotonically increasing `rev`:

- Every normal grid content save bumps `rev`; `lastOpenedAt`-only "recency" touches do not.
- The security rules enforce the contract: grid create requires `rev == 1`; grid update requires
  `rev == resource.data.rev + 1`, with a separate allowance for `lastOpenedAt`-only updates
  (`firestore.rules`, the `grids/{gridId}` match).
- The client DAO transaction also checks `rev` and surfaces a typed conflict error so the app can reload
  and rebase rather than silently dropping edits. Admin SDK migration writes bypass rules.

## Security rules

Storage correctness is enforced server-side by two rule files, not just by client behavior.

**`firestore.rules`**

- `users/{userId}/uploads/{hash}` — owner read, `write: if false`. Archive documents are entirely
  server-written; `shareable`, `refCount`, and status are never client-writable.
- `users/{userId}` — the owner may create/update their own document, but `storageUsed` and `isDevAccount`
  are server-owned: create must not include them, and update must not change them.
- `grids/{gridId}` — enforces the `rev` contract described above.

**`storage.rules`**

- `users/{uid}/{images|videos|documents}/{fileName}` — create is allowed only when the caller owns the
  path, the filename matches the canonical hash-name pattern (`^[a-f0-9]{64}\.[a-z0-9][a-z0-9-]{0,15}$`),
  and the write is within quota (`isDevAccount` exempt). `update` and `delete` are `false` — objects are
  immutable and only server code deletes them. Read is allowed when the object metadata is
  `published == 'true'` or the requester is the owner.
- Quota in the rules is computed from `users/{uid}.storageUsed` plus the incoming object size, mirroring
  the callable's check.
- Custom OG images live under `og-images/custom/{userId}/{gridId}/{fileName}` and are intentionally
  outside the archive and quota.
- Legacy `users/{uid}/link-images/` rules are still present. They are retained until the migration's GC
  step and the compatibility grace period are complete; see the maintainer migration runbook. They must
  not be removed while any un-migrated link image or stale client could still reference them.

## What is intentionally excluded

Not every URL in a grid is an archive file. The following are deliberately **not** deduped, ref-counted,
quota-counted, or migrated:

- **External URLs, `blob:`/`data:` URLs**, scraped link/OG/favicon images, YouTube/music/map metadata,
  and embeds — they are not user-owned objects.
- **Generated OG images and custom OG images** — custom OG images keep a fixed path under
  `og-images/custom/{uid}/{gridId}/{fileName}`, outside the archive and quota. They are uploaded via
  `StorageService.uploadToPath`, which overwrites in place (no dedupe).
- **Thumbnails** (`thumbnails/documents/...`) — generated server-side, read-gated by `published`
  metadata, not archive files.
- **Demo/legacy assets** and any object outside `users/{uid}/{images|videos|documents}/`.

## Backward read tolerance

Rendering is decoupled from the archive. Tiles render whatever `src`/`url` they hold, so `src`-only
legacy content, external images, embeds, demo data, and any reference the extractor skips all continue to
display. Keeping legacy content viewable does **not** depend on the archive extractor — it only affects
dedupe/refCount/quota. This tolerance is intentional and must be preserved.

## Cloud Functions reference

All storage functions live in `apps/firebase-functions/src/storage/` and are exported from
`apps/firebase-functions/src/index.ts`.

| Function | Type | Responsibility |
| --- | --- | --- |
| `authorizeStorageUpload` | Callable | Validate metadata, quota-check, reserve a `pending` archive doc or return a dedupe hit. Never touches `storageUsed`/`refCount`. |
| `onFileUploaded` | Storage `onFinalize` | Verify the object hash, publish metadata, finalize `pending → active`, increment `storageUsed`. |
| `onFileDeleted` | Storage `onDelete` | Decrement `storageUsed` for canonical active objects; skip tagged/legacy. |
| `onGridStorageReferencesCreated/Updated/Deleted` | Firestore triggers | Reconcile `refCount` from before/after grid snapshots. |
| `deleteStorageUpload` | Callable | Owner-only permanent delete; `force` required when `refCount > 0`. |
| `setStorageUploadShareable` | Callable | Owner-only toggle of `shareable`. |
| `setStorageUploadDisplayName` | Callable | Owner-only rename of `displayName` (display-only). |
| `getStorageUploadDownloadUrl` | Callable | Return a download URL only for an `active`, `shareable` file. |
| `prepareGridDuplicateStorage` | Callable | Estimate and (when confirmed) execute the storage side of a full grid duplicate. |

Supporting utilities: `utils_uploadPaths.ts` (paths + validation), `utils_uploadArchive.ts` (archive
transactions, quota, refCount, finalize), `utils_storageHash.ts` (server stream hashing),
`utils_storageUsage.ts` (usage accounting + object filtering), `utils_storageDownloadUrl.ts`
(emulator-aware `?alt=media` URLs).

Client side: `apps/web/src/services/StorageService.ts` and its interface, the DAOs behind
`StorageDao` / `UploadArchiveDao` / `CloudFunctionsDao`, `apps/web/src/utils/FileHashing.ts` (chunked
SHA-256), and `apps/web/src/composables/useFileUpload.ts` (optimistic upload flows).

## Migration and garbage collection

Migrating pre-existing production data into this scheme and later garbage-collecting old objects is a
maintainer operation, not part of the runtime. It is handled by the CLI at
`apps/firebase-functions/src/scripts/storageMigration.ts` (`inventory`, `count`, `migrate`,
`recompute-usage`, `gc`). See the maintainer runbook: [Storage migration](../maintainers/storage-migration.md).
