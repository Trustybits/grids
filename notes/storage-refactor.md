# Storage Refactor Specifications

The current method used for storage (meaning the uploading of files to the firebase storage bucket, which can include images,
videos, and documents) does not check for duplicated files and the client-side code does not actually delete any files either.
(Today the client uploads files directly to the bucket; a `StorageService.delete()` method exists but is never called anywhere,
so removing a tile never frees storage.) Thus, we will be doing a significant refactor of the storage system used to allow for
deduplication and proper deletion.

### Firestore Collections invovled

- users/{userID} -> contains the "storageUsed" field used for enforcing storage limits (already exists; written only by Cloud Functions). Will also
gain an "isDevAccount" boolean flag (the storage-limit exemption, see goal 4). This flag can only be **written** by a Cloud Function, but is
**readable** by the client and by the security rules.
- users/{userID}/uploads/{hash} -> does not exist yet, each {hash} document will contain the storage URL of the file, a refCount (how many
times that file is referenced across all user grids and such), and the file size and type. Clients may **read** their own uploads index
(the File Archive needs this) but may **not write** it — only Firebase Functions write it. Note: Firestore subcollections do not inherit
the parent document's rules, so a new owner-read / server-write rule must be added for this path.
- grids/{gridID} -> contains a tiles array that has the "src" fields that contain the URLs that point to the storage files
(ImageContent, VideoContent, and EmbedContent all use a `src` field)

### Storage Buckets involved (in a Firebase buckets)

- users/{userID}/{type}/{hash}.{ext} -> does not yet exist in this form (files are stored with their original filename, not their hash), but will
store the actual file. `{type}` is one of `images`, `videos`, or `documents`. (The server-only `og-images/` and `thumbnails/` folders are out of
scope for this refactor and are not counted toward the user's quota.)

There is also a legacy `users/{userID}/link-images/{imageId}` folder defined in `storage.rules`, but it is **orphaned**: no application code writes to
it (the link tile's custom image upload uses `fileType: "images"`, so it lands in the `images/` folder, and `uploadExternalImage` defaults to the
`images/` folder too). Link tile custom images are just regular images. As part of this refactor, the `link-images` rule block should be removed —
see the migration note in goal 7.


## Specifications and Goals

This storage refactor will bring several new features to the app. Here are the overall specifications and goals that this refactor should meet.

1. Deduplication - a user uploading the same file (image, video, document, etc) should not result in multiple copies of that file
in storage. In other words, each unique file uploaded results in 1 stored file, multiple uploads of the same file do not result in 
multiple stored files

2. File Archive - each user has access to a "file archive" which they can view from their user settings in the app. This file archive contains
all the files that the user has uploaded, and gives them options to add a file to the grid (if on a grid) or permanently delete a file

3. Removing a tile does *not* delete the associated file (if a file is associated with that tile). Files can only be permanently deleted from the File Archive

4. storageUsed limits are enforced. storageUsed is incremented when a new, unqiue file has been uploaded, and decremented when a file is permanently deleted.
The storageUsed limit for free-tier users is 5 GB, and developer accounts are excluded from the storage limit. Developer accounts are identified the
same way as the existing `isDevTeamMember` helper (`apps/firebase-functions/src/notifications/utils_devTeam.ts`): the `@trustybits.com` and `@grids.so`
email domains, plus the `DEV_TEAM_USER_IDS` env list. Reuse that helper rather than re-implementing the check.

The exemption is surfaced to the security rules via an `isDevAccount` boolean flag on the user document (users/{userID}). A Cloud Function sets this
flag (e.g. on user creation / login, using `isDevTeamMember`); it can only be written server-side and is read by both the client and `storage.rules`.
The storage rules already do a `firestore.get` on the user doc for the quota check, so the dev-account read is the same single lookup — no new
cross-service dependency. (Cross-service Firestore reads from storage rules are known to be flaky in the emulator, the same caveat that applies to the
quota check.)

Note: the storageUsed limit is **not** currently enforced anywhere (the `hasStorageQuota` check in `storage.rules` was disabled — see the
"TODO: Re-enable quota checking" comment), so this is net-new enforcement.

5. There is no cap for a single file upload. Currently the caps are 10 MB for an image, 500 MB for a video, and 50 MB for a document, and they are enforced
in **two** places that both need to change: the client (`validateUploadFile` in `apps/web/src/utils/UploadFileClassification.ts`) and `storage.rules`
(`isFileSizeValid()`, a hard 500 MB cap applied to every file type). Instead of having a hard cap, if the file being uploaded is large the user is warned
the app might be slowed while uploading

6. Preserve optimistic uploading features so that images and videos are displayed immediately, while upload continues in the background

7. Remove the legacy `link-images` storage path entirely. The `users/{userID}/link-images/{imageId}` rule block in `storage.rules` is orphaned (no
code writes to it) and should be deleted. **Migrate carefully:** before removing the rule, check production storage for any pre-existing objects under
the `link-images/` prefix and migrate them into the new scheme, rewriting the affected link tiles' `customImageUrl` to the new URL. We must not let a
user lose their existing link tile custom image during the cutover, so the migration (re-key/copy objects + update tile content) has to run before, or
atomically with, removing the rule and the old folder.

8. Migrate all existing storage into the new dedupe index and file naming scheme, including migrating the stored 'src' fields within the grids subcollection,
and properly ensuring that existing storage in the images/ folder is deduped as it's moved into the new scheme. Make sure that the objects
within the old images/ folder have no remaining references before deleting. This migration must be handled with care so as to not lose user data.


## Flows

Here are some of the rough flows of how file uploading, deleting, and viewing should work. The "server" are Firebase Functions

**File Upload**

The client performs the actual upload directly to the bucket (resumable), with the server orchestrating dedupe and quota around it.
The file bytes are *not* proxied through a Cloud Function: callable/HTTPS function payloads are capped at ~32 MB, which would make large
videos impossible and would break the resumable + optimistic-preview UX we want to preserve.

File is uploaded by the user (dropping an image on the grid, uploading a video, adding a document, etc)
|
|
V
Client computes the file's hash (e.g. SHA-256; use a streaming/chunked hash so large files don't blow up memory)
|
|
V
Client calls a Cloud Function (callable) with metadata only — { hash, size, type, ext }. The file bytes are NOT sent to the function.
|
|
V
Server checks the dedupe index in Firestore at users/{userID}/uploads/{hash}
|
|
V
If the file has already been uploaded, then increment the refCount and return the URL stored at the dedupe index document. No upload happens.
If the file has not already been uploaded, continue with this flow
|
|
V
Server checks the user's storage limit (skipping developer accounts). If size + current storageUsed would exceed the limit (5 GB for free),
then return an error and do not authorize the upload. Otherwise authorize the upload and return the target path users/{userID}/{type}/{hash}.{ext}
|
|
V
Client uploads the file directly to the bucket at the authorized target path (resumable upload, preserving the optimistic preview and progress)
|
|
V
The storage finalize trigger (onFileUploaded / onTrigger_fileUploaded) fires once the object lands. It creates the dedupe document at
users/{userID}/uploads/{hash} (storage URL, refCount = 1, file size, file type) and increments the user's storageUsed. This keeps storageUsed
accounting server-authoritative and in a single place, and reuses the existing trigger. (Optionally re-hash the object server-side here to verify
the client's claimed hash.)
|
|
V
Client stores the hash alongside the tile's "src" attribute for easy lookup later

Note: quota must also be enforced at the storage layer (re-enable `hasStorageQuota` in `storage.rules`, scoped to the users/{userID}/{type}/{hash}.{ext}
path and exempting accounts whose user doc has `isDevAccount == true`), since a client could otherwise skip the callable and upload directly. Because the
finalize trigger is the single writer of storageUsed, the callable must NOT also increment storageUsed on a new upload — that would double-count.


**Tile that uses a file (like an image tile) deleted**

Image tile (or similar) is deleted by the user
|
|
V
Client sends the URL and hash of the associated file to the server
|
|
V
The server decrements the ref count in the corresponding dedupe index in Firestore at users/{uid}/uploads/{hash}
|
|
V
The server does *not* delete the corresponding file in the storage bucket. Tile deletion *never* results in file deletion from storage


**User Views File Archive from the User Menu**

User clicks on the file archive to view their uploaded files
|
|
V
Client queries the dedupe index, gets a list of all of the hashs and their corresponding URLs and ref counts.
Client then displays all of the files that have been uploaded, using the storage URL to show the images, videos, etc
Client also dispays the ref count for each file
|
|
V
If on a grid, the file archive gives the user a button to "add to grid" on each file, which should add the appropriate tile
with the file to the grid when pressed. This should increment the ref count (or tell the server to increment the ref count)
The file archive should give a file upload button or field, which when a file is uploaded follows the file upload flow above
The file archive should also give a "permanent delete" button for each file. continue flow when this button is pressed.
|
|
V
The client should print a warning when the permanent delete button is pressed. If ref count is 0, the warning should state that 
this action will permanently delete the file. If the ref count is > 0, this warning should also include that the file is currently
in use by {refCount} number of tiles, and permanently deleting this file will break those tiles. The user should be able to cancel or proceed
|
|
V
In the event that the user permanently deletes a file, follow the file deleted flow below.


**File permanently deleted**

The server performs the deletion (via a callable + the Admin SDK), not the client. Deletion has no payload-size constraint, and it must be
server-side anyway: the dedupe document is server-write-only, and the delete must be authorized (verify ownership, check refCount). The client only
requests the delete; it never touches the bucket object directly. As part of this refactor, the client `delete` permission in `storage.rules`
(`allow update, delete: if request.auth.uid == userId`) should be tightened to server-only, so a client can't delete bucket objects directly and
leave the dedupe index / storageUsed out of sync.

User permanently deletes a file
|
|
V
Server stamps the skip-accounting tag (gridsStorageSkipAccounting) on the bucket object
|
|
V
Server deletes the corresponding file in the storage bucket
|
|
V
Server deletes the dedupe/archive document at users/{userID}/uploads/{hash} AND decrements storageUsed by the doc's
size — atomically, in a single Firestore transaction. The callable is the single writer of the delete-time decrement.

> **Where the decrement lives, and why it is NOT the delete trigger (updated 2026-07).**
> The original design (the crossed-out step this note replaces) decremented `storageUsed` in the storage delete
> trigger (`onFileDeleted` / `onTrigger_fileDeleted`), "in exactly ONE place — the trigger." **That does not work
> with Cloud Storage soft delete, which is enabled by default on all buckets (7-day retention).** Firebase's v1
> `object().onDelete()` is bound to the Cloud Storage `OBJECT_DELETE` event, which fires only when an object is
> *permanently* deleted. With soft delete on, deleting an object moves it to a recoverable soft-deleted state — not
> a permanent delete — so `OBJECT_DELETE` is **not** emitted at delete time (at best it fires when the retention
> window purges the object ~7 days later, if at all). Net effect of the old design: permanent deletes silently
> stopped decrementing `storageUsed`.
>
> **Current design:** `onCall_deleteStorageUpload` decrements `storageUsed` itself, in the same Firestore
> transaction that deletes the archive doc (`deleteUploadArchiveAndDecrementUsage`). The archive doc is the
> idempotency token: a concurrent/retried delete finds it already gone and does not decrement again — exactly-once.
> Before deleting the bucket object the callable stamps the `gridsStorageSkipAccounting` metadata tag, so that if
> `OBJECT_DELETE` ever *does* fire later (soft-delete purge), `onFileDeleted` sees the tag, `parseUserStorageObject`
> returns null, and the trigger no-ops instead of double-decrementing. The callable refuses to delete an object it
> could not tag, to keep that guarantee intact.
>
> **`onFileDeleted` is kept as a backstop** for permanent deletions that bypass the callable (console hard-delete,
> a future lifecycle rule, admin scripts). Every *deliberate* delete path — this callable, the hash-mismatch
> quarantine in `onFileUploaded`, and `storageMigration` gc — stamps the skip-accounting tag first, so the trigger
> can never double-count them. **Do not move the delete-time decrement back into the trigger.**


## Migration Plan

This is an **expand → migrate → contract** (parallel-change) rollout, designed to run fully online with **no maintenance window**. The three
steps below map onto that pattern.

**Why a version stamp is required (and yes, the instinct is correct).** Grid persistence today is a *whole-document overwrite*: `GridDao.save` is
documented as "create or fully overwrite", and `GridPersistenceScheduler` writes the entire `Grid` snapshot on each debounced save. The editor loads
a grid once via `getById` and has **no realtime listener** for grid edits (only chat uses `onSnapshot`). So a browser tab that loaded a grid before
the cutover holds the old tiles in memory, and its next save will clobber the whole document — overwriting the backfilled `src`/`hash` with stale
values that point back at an old object we're about to delete. A monotonic version stamp on the grid doc, enforced server-side, defends against this.
`Grid.updatedAt` already exists but it's a timestamp (not a reliable optimistic-concurrency token), so add a dedicated integer `rev` (a.k.a. `schemaRev`).

### Phase 0 — Pre-flight validation (before the Phase 1 gate ships)

Because Phase 1 gates the bucket to the new scheme immediately (freezing the target) and removes the old-path fallback, the new upload flow has to be
trusted *before* that rule ships — there is no production fallback once it lands. Validate all of the following first:

- **New flow end-to-end against staging / emulators:** hash → authorize callable → direct upload to `users/{uid}/{type}/{hash}.{ext}` → finalize trigger
  writes the dedupe doc and increments `storageUsed`. Exercise images, videos, and documents, including a large (multi-hundred-MB) video.
- **Dedupe + refCount:** re-uploading the same file returns the existing URL with no second object and bumps refCount; "add to grid" bumps refCount;
  tile delete decrements it; permanent delete removes the object, dedupe doc, and decrements `storageUsed` exactly once.
- **`storage.rules` unit tests (emulator):** the hash-shape + quota + owner rule *accepts* a well-formed hash-named upload within quota and *rejects*
  (a) an original-filename upload, (b) an over-quota upload, (c) a write to another user's path, (d) a write that would exceed the single-file quota.
  Also assert the `isDevAccount == true` exemption path. These are the exact predicates Phase 1 depends on, so test them before relying on them.
- **`uploads/{hash}` rules:** owner can read, client cannot write; only the Admin SDK writes.
- **Quota correctness:** confirm the re-enabled `hasStorageQuota` reads `storageUsed` correctly and that dev accounts (via the `isDevAccount` flag) are
  exempt, including the emulator cross-service-read caveat noted in goal 4.
- **`rev` plumbing (no enforcement yet):** confirm every grid write path bumps `rev` (scheduler, undo/redo, autosave) so that when OCC is turned on in
  Phase 2 there are no write paths that forget to increment it and self-reject.
- **Backfill dry-run:** run the backfill against a copy of production data (or a representative sample) in read-only / copy-only mode — no deletes — and
  verify the reference inventory finds every storage URL, refCounts reconcile, recomputed `storageUsed` matches expectations, and large-object hashing
  completes within the chosen job runtime (Cloud Run job, not a 540s function).
- **Rollback story:** confirm the Phase 1 `storage.rules` change is independently revertable (a stale-tab-upload regression should be fixable by
  reverting just the rule, without touching client code or data).

### Phase 1 — Expand (dual-scheme; no deletes, no enforcement yet)

> Migrate the client and server to start uploading and saving objects with the new scheme without rewriting the old "src" fields. Enable the client
> to gracefully accept only "src" and not the additional hash entry.

- Server: deploy the new upload / dedupe / delete callables, the `users/{userID}/uploads/{hash}` index, and its security rules.
- **Gate the bucket to the new scheme immediately (decided): freeze the migration target on day one.** Tighten `storage.rules` so an upload to
  `users/{uid}/{type}/...` is only accepted when the object name matches the hash pattern, the size is within quota, and the caller owns the path. This
  rejects a stale tab's original-filename upload while still permitting the new client's hash-named direct upload (the new client uploads *directly* to
  the bucket too, just to `users/{uid}/{type}/{hash}.{ext}` — so this is a shape restriction, **not** `allow write: if false`). From this deploy onward
  no new old-style objects can be created, so the set the backfill must convert is fixed.
- Client: read both `{src}` and `{src, hash}` tiles; new uploads use the new flow and write `hash`; tolerate a missing `hash` everywhere it reads.
- Client: start writing and incrementing `rev` on every grid save, treating a missing `rev` as 0. **Do not enforce `rev` in rules yet.**
- Do **not** run the backfill and do **not** delete any old objects.
- Let this phase bake long enough that the new client is widely propagated before cutover.

**Cost of gating in Phase 1:** a stale tab still on pre-Phase-1 JS will have its uploads rejected and must refresh (the same forced-refresh cost we
already accept for grid-write OCC at cutover). We accept this in exchange for a frozen migration target and no new old-style objects. The trade-off we
are declining is keeping the old path open as a production fallback while the new flow is validated — so the new upload flow should be validated well
before this gate ships (e.g. behind a staged rollout / against staging), since there is no old-path fallback once it lands.

**Hard invariant (now satisfied by gating here):** no old-style upload may occur after the backfill's final converge pass, or it strands an
un-migrated object (no hash, no dedupe doc) that the GC step won't know about. Gating in Phase 1 satisfies this with margin.

### Phase 2 — Migrate / Cutover (backfill + turn on optimistic-concurrency)

> Cutover, moving all old storage fields to the new storage scheme.

- Turn on OCC in `firestore.rules`: a grid update must carry `rev == resource.data.rev + 1` (the backfill uses the Admin SDK, which bypasses rules).
  A new client whose write is rejected reloads the grid, rebases its pending edits, bumps `rev`, and retries. A stale pre-Phase-1 tab (no `rev`) is
  rejected and the user must refresh. Crucially, the stale write is **rejected, not applied**, so nothing is corrupted.
- Run the backfill (Admin SDK, **idempotent + resumable**), per user / per grid:
  1. For each tile/field that points at an object under `users/{uid}/...`, fetch and hash it (streaming hash for large videos).
  2. Dedupe into `users/{uid}/uploads/{hash}` (transaction + `FieldValue.increment` on refCount), and **copy** the object to
     `users/{uid}/{type}/{hash}.{ext}` — copy, do not move; keep the old object alive for now.
  3. Rewrite the tile `src` to the new URL, add `hash`, and **bump `rev`** in the same transaction. Bumping `rev` makes any open editor stale, so OCC
     forces it to reload instead of clobbering.
  4. Mark the grid migrated (e.g. a `schemaRev` marker) so the job is resumable and observable.
- Recompute each user's `storageUsed` authoritatively from the deduped set (dedup can *lower* it). Suppress double-counting from the live triggers
  (e.g. tag backfill-written objects with custom metadata the triggers skip, then set `storageUsed` once at the end).
- **GC last:** only after every reference is confirmed rewritten AND a grace period has passed, delete the old objects (and the `link-images/` folder,
  goal 7). Copy-then-swap-then-delete keeps the migration reversible and keeps in-flight viewers' old URLs working until GC.

### Phase 3 — Contract (keep the safety net)

> Retain client ability to accept only "src" and not additional fields, to ensure any fields that were somehow missed still operate.

- Keep the client tolerant of `src`-only tiles **indefinitely** — some `src` values legitimately have no hash (external URLs, embeds, demo/seed data,
  anything the backfill skipped or missed).
- Remove the now-dead old-style client upload code and the `link-images` rule once the backfill is verified 100% complete. (The `storage.rules`
  lockdown to the hash-named path already landed in Phase 1 — the new client keeps uploading directly, just to the authorized path.)
- Decide whether to keep `rev`/OCC permanently (recommended — it also fixes the pre-existing whole-document last-write-wins lost-update problem) or relax it.

### Caveats / things to watch

- **Rejected-write UX is real work.** With whole-doc saves through the debounced scheduler, an OCC rejection must not silently drop the user's unsaved
  edits — the client has to reload the server grid, re-apply pending in-memory changes, bump `rev`, and retry. Skip this and turning on OCC will feel
  like "my changes won't save."
- **Stale pre-`rev` tabs get a hard stop.** You can't control when web clients refresh. At cutover, a tab still on pre-Phase-1 JS has its saves rejected
  and must be refreshed manually (it has no code to auto-reload). No corruption, but a visible blip — bake Phase 1 long enough to shrink that population.
- **Inventory every place a storage URL can live before computing refCounts.** Image/video `src`, link `customImageUrl`, profile / bio photos, the
  `publicProfiles` photo, grid backgrounds, custom OG images, and `link-images/`. If the backfill misses a referencing field, you'll either GC a
  still-referenced object (breakage) or leak it. This is the highest-risk part — make the inventory exhaustive before any deletion.
- **Skip non-migratable `src`.** External URLs, embeds, demo/seed data (`DemoGrid.ts`), and dangling/404 objects must be detected and left as `src`-only.
  Only migrate objects actually under `users/{uid}/...`.
- **Dedup is per-user by design.** `uploads/{hash}` is namespaced per user, so identical files across two users remain two objects. The backfill dedupes
  within a user, not globally — consistent with per-user quota and delete authority.
- **Live triggers vs. backfill.** `onFileUploaded` / `onFileDeleted` fire on every copy/delete the backfill performs and would move `storageUsed`.
  Neutralize this (a metadata flag the triggers skip, or an authoritative recompute at the end) or you'll double-count.
- **Object swap can't be transactional with Firestore.** Copy the object first (idempotent, orphan-safe on failure), then update the grid doc in a `rev`
  transaction, then delete the old object last. Never delete before the tile rewrite is durably committed and the grace period passes.
- **Hashing large objects server-side** (videos up to 500 MB+) needs streaming and likely a Cloud Run job, not a 540s-capped function. Plan throughput/cost.
- **URL-change side effects.** New URLs differ from old; anything that cached or hotlinked the old URL (external scrapers, third-party embeds) breaks at
  GC time. In-app and fresh page loads are fine because the old objects survive until GC.

### An alternative that shrinks the race window

If grid edit sessions used a realtime listener (`onSnapshot`) the way chat does, the backfill's `rev`/`src` bump would be **pushed** to any open editor,
which could reconcile its in-memory tiles live and never write stale data. That's a larger change than adding `rev`, and you'd still want OCC as a
backstop for the read-modify-write window — but it's worth considering if forced refreshes prove disruptive.
