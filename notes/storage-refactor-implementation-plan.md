# Storage Refactor Implementation Plan

This plan turns `notes/storage-refactor.md` into an ordered implementation sequence. It assumes the target model is:

Companion note: `notes/storage-refactor-grid-url-inventory.md` classifies the URL-bearing grid fields and runtime URL sources that should be included in, conditionally included in, or excluded from archive/refCount/duplication handling.

- User-owned uploads are stored under `users/{uid}/{type}/{hash}.{ext}`.
- Firestore owns the dedupe index at `users/{uid}/uploads/{hash}`.
- Clients can read their own upload archive, but only server code can write archive documents.
- The client uploads bytes directly to Storage after server authorization; Cloud Functions receive metadata only.
- Tile/grid deletion does not delete files. Only an explicit File Archive permanent delete deletes the object.
- `storageUsed` is updated server-side only and counts unique, active user-owned files.
- Grid `rev` is added before migration so stale whole-document saves cannot overwrite backfilled URLs.

## Confirmed implementation decisions

1. **Grid and tile duplication behavior**
   Full duplication must import/copy referenced user files into the duplicating user's archive only when the source owner's archive document for that file has `shareable: true`. Copiable files count against the duplicating user's quota and get new hashes/URLs in the duplicated grid. File-backed tiles whose required files are not copiable must become suggestion tiles in the duplicate instead of pointing at the source owner's file. Duplicating a grid with file-backed tiles must show a confirmation prompt before the duplicate is created. The prompt must describe how much additional file quota is required for copiable files and should note when any file-backed tiles will be replaced because their files are not shareable.

2. **refCount ownership model**
   Use server-side reference reconciliation for refCounts. Cloud Functions should diff grid snapshots on grid create/update/delete and adjust archive refCounts centrally. Client upload authorization must not count as a durable file reference; the saved grid state is the source of truth for whether a file is referenced.

3. **Custom OG images**
   Keep custom OG images out of File Archive and quota. Preserve their current fixed-path behavior under `og-images/custom/{uid}/{gridId}/{fileName}` and continue treating OG images as separate from user archive uploads.

4. **Hashing dependency**
   Use `hash-wasm` for client-side hashing so large files can be hashed incrementally in chunks without reading the entire file into memory.

5. **Per-file sharing permission**
   Each archive document at `users/{uid}/uploads/{hash}` must include a `shareable` boolean. It defaults to `false` for all new uploads and all migrated files. Owners can toggle it from the File Archive UI. This single flag controls both whether another user can copy the file into their archive during grid duplication and whether the app exposes a TileActions download for that file. Downloading a shareable file does not add it to the downloader's archive, does not change refCount, and does not affect quota. Because upload archive docs remain server-write-only, the UI should call a Cloud Function to update this flag rather than writing the archive document directly.

## Phase 0 - Foundation and test harness

Goal: add the shared shapes and validation scaffolding before behavior changes.

1. Add storage domain types in `packages/contracts`.
   - Add a storage/archive type module, e.g. `packages/contracts/src/types/Storage.ts`.
   - Define upload kinds (`images`, `videos`, `documents`), archive document shape, stored file reference shape, callable request/response shapes, and permanent-delete request shape.
   - The archive document shape must include `shareable: boolean`, defaulting to `false`.
   - Re-export from `packages/contracts/src/types/index.ts`.
   - Extend `Grid` with `rev?: number`.
   - Extend file-bearing content types with optional hash/reference fields:
     - `ImageContent.srcHash?`
     - `VideoContent.srcHash?`
     - `DocumentsContent.items[].hash?`
     - `LinkContent.customImageHash?`
     - `ProfileBioContent.profilePhotoHash?`
     - `Grid.backgroundImageHash?`
     - do not add `Grid.ogImageHash?`; custom OG images stay on their fixed path outside archive/quota.
   - Keep these optional indefinitely so `src`-only external/demo/legacy values still render.

2. Add shared reference extraction utilities.
   - Create a pure utility usable by web tests and migration logic, likely in `packages/contracts` if it can stay SDK-free, otherwise mirrored between `apps/web` and `apps/firebase-functions`.
   - Use `notes/storage-refactor-grid-url-inventory.md` as the implementation checklist for which grid URLs count as archive references, which are conditional, and which must be ignored.
   - It must inventory all in-grid user-file references and return both the display URL and the stored hash when present. The stored hash is the authoritative lookup key for `users/{uid}/uploads/{hash}`; URLs are for rendering, validation, and legacy/migration fallback.
   - It must read hash fields first for archive-backed references:
     - image/video `content.srcHash` plus `content.src`
     - document item `hash` plus `url`
     - link `customImageHash` plus `customImageUrl`
     - profile `profilePhotoHash` plus `profilePhotoUrl`
     - `Grid.backgroundImageHash` plus `backgroundImageSrc`
     - not `Grid.ogImageSrc`; custom OG images are intentionally out of archive/quota.
   - For new/migrated archive-backed references, duplication and refCount reconciliation should use the hash directly. URL parsing should only be used for legacy `src`-only data, migration inventory, fallback classification, or validation that the URL/path and stored hash agree.
   - It must skip external URLs, embeds, demo assets, blob/data URLs, thumbnails, generated OG images, and any URL outside `users/{uid}/...`.
   - Add tests proving duplicate references are counted and unsupported URLs are ignored.

3. Add Firebase rules test support.
   - The repo does not currently appear to have a rules-unit test harness.
   - Add a focused rules test setup using the Firebase emulator/rules testing tooling, or create an equivalent maintainer-only emulator verification script if dependency choice is rejected.
   - Cover both `firestore.rules` and `storage.rules` before shipping the Phase 1 rule gate.

4. Add baseline regression tests around current upload/persistence behavior.
   - `apps/web/src/composables/__tests__/useFileUpload.test.ts`
   - `apps/web/src/services/__tests__/StorageService.test.ts`
   - `apps/web/src/controllers/__tests__/internal/GridPersistenceController.test.ts`
   - `apps/firebase-functions/src/storage/__tests__/utils_storageUsage.test.ts`
   - These tests should pin optimistic preview behavior, resolved blob replacement, and storage usage trigger behavior before refactoring.

## Phase 1 - Server-side upload archive and accounting

Goal: add the new backend capabilities while the old client can still exist in local branches.

1. Add server utilities in `apps/firebase-functions/src/storage/`.
   - `utils_uploadPaths.ts`: validate `{type, hash, ext}` and build `users/{uid}/{type}/{hash}.{ext}`.
   - `utils_uploadArchive.ts`: read/write `users/{uid}/uploads/{hash}`, transaction helpers, active/pending statuses, refCount increments/decrements, and URL construction.
   - `utils_storageHash.ts`: server-side object hash verification for finalize/backfill.
   - `utils_storageReferences.ts`: server-side version of the reference extractor if the shared utility cannot be used directly.

2. Add callable functions.
   - `onCall_authorizeStorageUpload.ts`
     - Requires auth.
     - Validates metadata only: hash, size, type, ext, contentType.
     - Upload authorization must not count as a durable file reference. It should create/refresh a pending upload reservation and leave `refCount` changes to grid create/update/delete reconciliation.
     - Uses a transaction:
       - active doc exists with matching metadata: return `{uploadRequired: false, url, hash, path}` without changing `refCount`.
       - missing doc: create a pending/reserved doc and return `{uploadRequired: true, path, hash}`.
       - pending doc with same metadata: refresh reservation and return upload target or a wait/retry response.
       - mismatched metadata for same hash: reject.
     - Checks quota for non-dev accounts before allowing a new unique object.
     - Does not increment `storageUsed`.
   - `onCall_deleteStorageUpload.ts`
     - Requires auth.
     - Verifies ownership and archive doc.
     - Requires an explicit `force` flag when `refCount > 0`.
     - Deletes the archive doc and then the Storage object.
     - Does not decrement `storageUsed`; the delete trigger owns that.
   - `onCall_setStorageUploadShareable.ts`
     - Requires auth.
     - Accepts `{ hash, shareable }`.
     - Verifies the caller owns `users/{uid}/uploads/{hash}`.
     - Updates only the archive doc's `shareable` flag.
   - `onCall_prepareGridDuplicateStorage.ts`
     - Requires auth.
     - Accepts a source grid ID and the intended copy mode.
     - Inventories archive-backed files in the source grid and uses each stored hash to read the source owner's `users/{sourceUid}/uploads/{hash}.shareable` flag.
     - Treats hash as the authoritative archive document key. If a file-backed reference has only a legacy URL and no hash, the function may use URL parsing only as a migration/fallback path; otherwise it should treat that reference as non-copiable and replace the tile with a suggestion.
     - Splits references into copiable and non-copiable groups.
     - Computes the additional unique bytes required after per-user dedupe for copiable files only.
     - Returns a quota estimate and a list/count of file-backed tiles that must become suggestion tiles because one or more required files are not shareable.
     - When called with an explicit confirmation flag, copies/imports only copiable files into the new owner's archive, creates the new owner's archive docs with `shareable: false`, returns a rewrite map of old URL/hash to new URL/hash plus a replacement map for non-copiable file-backed tiles, and fails clearly if quota is insufficient.

3. Update storage triggers.
   - `apps/firebase-functions/src/storage/onTrigger_fileUploaded.ts`
     - Only count canonical user uploads under `users/{uid}/{images|videos|documents}/{hash}.{ext}`.
     - Ignore legacy paths, `link-images`, thumbnails, generated OG images, and migration-tagged copies.
     - Re-hash the uploaded object server-side using a streaming hash and compare it to the hash claimed in the path/pending archive doc.
     - If the actual hash does not match the claimed hash, treat the upload as invalid: do not create an active archive doc, do not increment `storageUsed`, mark the pending archive/reservation as failed with a hash-mismatch reason, and delete or quarantine the mismatched object so it cannot remain as a usable user file.
     - The client upload flow must observe or poll the archive doc/finalize result after Storage upload completion so a hash mismatch can be surfaced to the user as an upload failure.
     - Finalize pending archive docs into active docs with URL, size, content type, path, timestamps, metadata, and `shareable: false` for newly-created archive docs.
     - Increment `storageUsed` once for a new unique active object.
     - Be idempotent for retries and duplicate finalize events.
   - `apps/firebase-functions/src/storage/onTrigger_fileDeleted.ts`
     - Only decrement for canonical active user uploads.
     - Ignore backfill/migration-tagged deletes until the authoritative recompute step.
     - Be idempotent and clamp at zero.
   - `apps/firebase-functions/src/storage/utils_storageUsage.ts`
     - Add folder/path filtering and migration skip helpers.
     - Add an authoritative `setUserStorageUsed(uid, bytes)` helper for migration.

4. Surface dev-account exemption.
   - Reuse `apps/firebase-functions/src/notifications/utils_devTeam.ts`.
   - Update `onTrigger_newUserSignup.ts` and `onTrigger_userLogin.ts` or add a focused auth/user callable/trigger to set `users/{uid}.isDevAccount`.
   - Update Firestore user rules so clients can read `isDevAccount` but cannot write it, matching `storageUsed`.
   - Add `isDevAccount?: boolean` to `UserProfile`.

5. Export new functions from `apps/firebase-functions/src/index.ts`.

6. Add function tests.
   - Auth required.
   - Existing upload returns existing URL without changing refCount.
   - New upload creates a pending archive doc and returns canonical path.
   - Quota denial for non-dev users.
   - Dev-account quota exemption.
   - Permanent delete requires `force` when `refCount > 0`.
   - Duplicate-file import estimates additional quota, rejects over-quota duplicates, and returns URL/hash rewrites after confirmation.
   - File sharing permission defaults to `false` and can be updated only by the owner through the callable.
   - Duplicate preparation separates copiable and non-copiable files based on the source archive doc's `shareable` flag.
   - Hash mismatch finalization marks the upload failed, deletes/quarantines the object, and does not increment `storageUsed`.
   - Upload/delete triggers do not double-count and skip migration-tagged objects.

## Phase 2 - Client upload service refactor

Goal: route all user-owned uploads through hash + authorization while preserving optimistic UI.

1. Update the storage service contract.
   - `apps/web/src/services/interfaces/StorageServiceInterface.ts`
   - `apps/web/src/services/StorageService.ts`
   - `apps/web/src/services/mocks/MockStorageService.ts`
   - Keep `uploadToPath` only for fixed-location custom OG images and other explicitly non-archive assets.
   - Replace direct `delete(path)` exposure with archive delete methods; direct bucket deletion should not be available to normal client flows.
   - Return a structured upload result `{url, hash, path, type, size}` instead of only a URL for archived user uploads.

2. Implement client hashing.
   - Add `hash-wasm` as the incremental hashing dependency.
   - Add a utility under `apps/web/src/utils/` for chunked hashing, ideally worker-backed for large videos so the UI remains responsive.
   - Add progress hooks for hash progress separate from upload progress.
   - Add visible UI/UX feedback while hashing is in progress, especially for large files where hashing may take noticeable time before upload progress begins. The user should be able to tell the app is preparing/checking the file rather than stalled.
   - Add tests for stable hashes, large-file chunking, and cancellation behavior if supported.

3. Update upload flows.
   - `apps/web/src/composables/useFileUpload.ts`
     - Hash file.
     - Call `authorizeStorageUpload`.
     - If existing, return archive URL without Storage upload.
     - If new, upload resumably to the authorized canonical path.
     - After a new Storage upload completes, wait for the server finalize verification to activate the archive doc before treating the upload as successful. If the server marks a hash mismatch or other verification failure, surface that error and remove/revert the optimistic tile.
     - Resolve optimistic previews with `{url, hash}`.
     - Continue to use local blob URLs until upload completion so image/video preview behavior stays unchanged.
   - Update document uploads so each `DocumentItem` receives `hash`.
   - Update link custom images, profile photos, background images, and external-image copies to store hash metadata when they are user-owned archive files.
   - Capture an explicit hash for smart-text inline images (`SmartTextContent.text` Tiptap JSON image nodes). DONE — landed within Phase 2.
     - Background: inline images route through the archive flow (canonical URL). Before this change they were still tracked/deduped/quota-counted because `packages/contracts/src/storage/GridStorageReferences.ts` walks the Tiptap JSON and recovers the hash from the canonical URL via its `source: "url-fallback"` path. Storing the hash upgrades them to `source: "stored-hash"`, which is owner- and URL-independent (robust to URL rewrites, cross-owner duplication, and the Phase 7 migration window; also enables the URL/hash-agreement validation).
     - Added a `hash` attribute (`data-hash`) to the ResizableImage Tiptap node in `apps/web/src/extensions/tiptap/ResizableImage.ts`, and switched the `/image` insertion in `apps/web/src/components/tilecontent/SmartTextContent.vue` from `uploadFileToUrl` to `uploadFileToArchive`, persisting `{url, hash}` into the node attrs.
     - Updated the extractor's `visitTiptapNode` to read `node.attrs.hash` first and fall back to URL parsing only when absent, matching the stored-hash-first rule used for the typed fields.
     - Tests: `packages/contracts/.../GridStorageReferences.test.ts` (stored-hash inline image → `source: "stored-hash"`) and `apps/web/src/extensions/tiptap/__tests__/ResizableImage.test.ts` (hash attribute declared + `data-hash` round-trip).

4. Update upload state and persistence.
   - `apps/web/src/stores/grid/gridUploads.ts`
   - `apps/web/src/controllers/internal/GridUploadController.ts`
   - `apps/web/src/utils/GridPersistenceUtils.ts`
   - Carry resolved hash values alongside resolved URLs.
   - Replace blob URLs with both final URL and hash before persistence.
   - Keep stripping unresolved blob/data URLs as a safety net.

5. Remove hard upload caps and add large-file warning.
   - `apps/web/src/utils/UploadFileClassification.ts`
   - Keep type validation.
   - Remove image/video/document max-size failures.
   - Add a warning classification result for large files so UI can warn without blocking.
   - Update `storage.rules` separately; do not rely on client-only warnings.

6. Update web tests.
   - Existing upload short-circuits Storage upload.
   - New upload uses authorized path.
   - Optimistic image/video tiles still render blob URLs first and persist final URL/hash.
   - Document upload persists item hashes.
   - Smart-text inline image upload persists its Tiptap node hash, and the reference extractor returns `source: "stored-hash"` for it.
   - Large files warn but are not rejected client-side.
   - Direct client delete is no longer used.

## Phase 3 - Grid `rev` and save conflict handling

Goal: make whole-document grid saves safe before migration rewrites storage URLs.

1. Add `rev` to grid creation and mapping.
   - `packages/contracts/src/types/Grid.ts`
   - `packages/pro/src/dao/firebase/FirebaseUtils.ts`
   - `apps/web/src/dao/stubbed/StubbedMemoryDatabase.ts`
   - `apps/web/src/utils/GridUtils.ts`
   - Default missing `rev` to 0 when loading.

2. Bump `rev` on every normal grid content save.
   - `apps/web/src/services/GridService.ts`
   - `apps/web/src/services/GridPersistenceScheduler.ts`
   - `apps/web/src/controllers/internal/GridPersistenceController.ts`
   - Any direct update paths that write grid content, including rename/settings/background/OG updates.
   - Do not bump for `lastOpenedAt`-only writes.

3. Add conflict-aware persistence behavior.
   - Detect Firestore permission/precondition failures caused by stale `rev`.
   - Reload the latest grid.
   - Rebase pending in-memory edits or present a clear refresh/retry state if automatic rebase is not safe.
   - Ensure the debounced scheduler does not silently drop unsaved changes after a rejected write.

4. Add tests.
   - Every save payload carries `rev`.
   - Missing loaded `rev` is treated as 0.
   - Consecutive scheduler writes increment monotonically.
   - Rejected stale save marks persistence error and does not report idle/success.
   - Autosave and upload flush behavior still works.

## Phase 4 - Rules expansion gate

Goal: deploy security rules that allow only the new canonical upload shape and protect server-owned data.

1. Update `firestore.rules`.
   - Add `match /users/{userId}/uploads/{hash}`:
     - owner read.
     - client write false.
     - `shareable` is still server-write-only; owner toggles go through `onCall_setStorageUploadShareable`.
   - Update `users/{userId}` rules:
     - client cannot write `storageUsed`.
     - client cannot write `isDevAccount`.
   - Keep grid `rev` enforcement off until Phase 8 cutover unless doing a controlled staging test first.

2. Update `storage.rules`.
   - Remove client delete/update permissions for user-owned upload objects.
   - Replace original-filename matches with canonical hash-name matches for:
     - `users/{uid}/images/{hash}.{ext}`
     - `users/{uid}/videos/{hash}.{ext}`
     - `users/{uid}/documents/{hash}.{ext}`
   - Re-enable quota enforcement using the existing user doc lookup plus `isDevAccount == true` exemption.
   - Remove hard single-file size caps from user upload rules unless a small metadata sanity limit is still needed.
   - Keep public/owner read behavior based on `published` metadata.
   - Keep `og-images/custom` behavior only if custom OG images remain out of archive.
   - Do not remove `link-images` rules until the link-image migration check is complete.

3. Add rules tests.
   - Accept canonical owner upload within quota.
   - Reject original filename upload.
   - Reject another user's path.
   - Reject over-quota non-dev upload.
   - Accept dev-account upload over quota.
   - Reject client writes to `users/{uid}/uploads/{hash}`.
   - Reject direct client delete/update of user upload objects.

## Phase 5 - Reference reconciliation and grid lifecycle

Goal: ensure refCount changes are correct for every grid mutation path before the File Archive exposes refCount-based warnings.

Implementation decision: use server-side reconciliation.

1. Add functions in `apps/firebase-functions/src/storage/`.
   - `onTrigger_gridStorageRefsCreated.ts`
   - `onTrigger_gridStorageRefsUpdated.ts`
   - `onTrigger_gridStorageRefsDeleted.ts`
   - Or a single utility used by grid create/update/delete triggers if naming/export constraints stay one deployed function per file.

2. Reconcile refs from grid snapshots.
   - On grid create: increment refs for every archived hash in the new grid.
   - On grid update: diff before/after reference multisets and increment/decrement archive docs.
   - On grid delete: decrement refs for every archived hash in the deleted grid.
   - Never delete the object when refCount reaches 0.
   - Ignore non-archive/external references.
   - Guard against negative refCounts and missing docs with logs/repair markers.

3. Add duplicate/import reconciliation coverage.
   - The duplicate-import callable must create archive docs and copied objects for the new owner before the duplicated grid is saved.
   - The duplicated grid must be saved with the new owner's URL/hash values, so the grid-create reconciliation increments the new owner's refCounts.
   - The source owner's refCounts must not change when another user duplicates/imports files.
   - Non-shareable source files must not be copied, and any file-backed tile that depends on them must be represented as a suggestion tile in the duplicated grid.
   - Duplication uses stored hash fields for archive lookups. URL-only legacy references are fallback/migration cases, not the normal duplicate path.

4. Tests.
   - Duplicate tile increments the same hash.
   - Remove tile decrements but does not delete.
   - Undo/redo adjusts refs correctly.
   - Grid delete decrements all refs.
   - Full grid duplicate imports source files into the new owner's archive and counts quota against the new owner.
   - Full grid duplicate does not import files whose source archive doc has `shareable: false`.
   - Full grid duplicate replaces non-shareable file-backed tiles with suggestion tiles.

## Phase 6 - File Archive UI

Goal: expose the archive after backend and upload primitives are stable.

1. Add archive service/composable APIs.
   - Use Firestore read access to list `users/{uid}/uploads`.
   - Add typed methods for archive list, add-to-grid helpers, `shareable` toggle callable, duplicate-import preparation, duplicate-import confirmation, and permanent delete callable.
   - Add mock/stub behavior for local non-Firebase mode.

2. Add UI entry point.
   - `apps/web/src/components/app/UserMenu.vue`
   - Add a File Archive entry that opens a modal or routed settings panel.
   - Prefer a new modal under `apps/web/src/components/modal/` unless a route-level settings surface is added.

3. Build File Archive view.
   - List file type, preview, size, refCount, shareable state, created/updated timestamps.
   - Show current `storageUsed` and free-tier limit unless `isDevAccount`.
   - Show a per-file `shareable` toggle. The toggle calls the server function and should optimistically show pending/saving/error state rather than directly writing Firestore.
   - New uploads and migrated files should appear with sharing disabled until the owner explicitly turns it on.
   - Upload button uses the new upload flow.
   - Permanent delete confirmation:
     - `refCount == 0`: warn that it permanently deletes the file.
     - `refCount > 0`: warn that it is used by that many references and deletion can break those places; require explicit confirmation and send `force: true`.
   - If a grid is open and editable, expose Add to Grid for compatible file types.

4. Add-to-grid behavior.
   - Images and videos create normal media tiles.
   - Documents either create a new document tile item or a new document tile.
   - Rely on the next persisted grid diff to update refCount through server-side reconciliation.

5. TileActions download behavior.
   - Update `apps/web/src/components/tile/TileActions.vue` and any tile-toolbar download action definitions so app-provided file downloads are controlled by the source archive doc's `shareable` flag.
   - For archive-backed files, only show or enable download when `shareable: true`.
   - Downloading a shareable file should fetch/download the file only. It must not create an archive document for the downloader, must not increment refCount, and must not count against the downloader's quota.
   - If hard server enforcement is required beyond hiding/disabling TileActions, add a callable or signed-download path that verifies `shareable` before returning a download URL. Do not rely on client-only checks for strict access control.

6. Grid duplication prompt.
   - Before full duplication, call the duplicate-import preparation flow for the source grid.
   - If the source grid contains file-backed tiles that need to be copied, show a confirmation prompt describing the additional file quota required.
   - The prompt must also say when some file-backed tiles cannot be copied because their source files are not marked shareable and will be replaced with suggestion tiles.
   - If the user confirms, run the duplicate import, rewrite the duplicated grid's copiable file URLs/hashes to the new owner's archive copies, replace non-copiable file-backed tiles with suggestion tiles, then create the duplicate grid.
   - If quota is insufficient, block the duplicate and show a clear quota error and suggest duplicating structure only

7. UI tests.
   - Archive list renders owner files.
   - Add-to-grid creates the correct tile content and hash fields.
   - Delete confirmation varies by refCount.
   - Permanent delete calls the function with `force` only after explicit confirmation.
   - File Archive shareable toggles call the server and update the archive row state.
   - TileActions download is shown/enabled for archive-backed files only when `shareable: true`.
   - TileActions download does not create an archive entry, change refCount, or affect quota.
   - Full grid duplication prompts with quota impact when files must be copied.
   - Full grid duplication rewrites copied file URLs/hashes after confirmation.
   - Full grid duplication replaces non-shareable file-backed tiles with suggestion tiles.

## Phase 7 - Migration tooling

Goal: safely migrate existing production data into the new scheme.

> Boundary note: the runtime extractor in `packages/contracts/src/storage/GridStorageReferences.ts` resolves only the canonical scheme (stored SHA-256 hash or a `users/{uid}/{kind}/{sha256}.{ext}` URL). It intentionally ignores pre-migration original-filename objects, so the migration inventory below must do its own byte-level scan/stream-hash rather than reusing that extractor for legacy discovery.
>
> Migration-window edge case: duplicating a grid that still holds an un-migrated legacy file. The runtime extractor won't detect that tile as file-backed, so `onCall_prepareGridDuplicateStorage` will neither copy the file nor convert the tile to a suggestion tile — the raw legacy URL is carried into the duplicate as-is (which can point at the source owner's object). This resolves once the file is backfilled into the canonical scheme. Sequence the migration ahead of exposing full duplication broadly, or add a legacy-URL guard in the duplicate path if the window is a concern.

1. Build migration as a Cloud Run job or maintainer script, not a 540-second function.
   - Put source under the functions workspace if it uses Admin SDK and deploy/runtime config, e.g. `apps/firebase-functions/src/scripts/storageBackfill.ts`, or under root `scripts/` if it is a maintainer CLI.
   - Include dry-run, copy-only, converge, and GC modes.
   - Require explicit project/environment arguments and production confirmations.

2. Inventory phase.
   - Scan all `grids/{gridId}` documents.
   - Extract every user-owned storage URL/reference field listed in Phase 0.
   - Scan Storage prefixes:
     - `users/{uid}/images/`
     - `users/{uid}/videos/`
     - `users/{uid}/documents/`
     - `users/{uid}/link-images/`
   - Report:
     - referenced old objects
     - unreferenced old objects
     - duplicate objects by content hash per user
     - missing/dangling URLs
     - URLs outside user-owned Storage

3. Copy/backfill phase.
   - Stream-hash each old object.
   - Copy to `users/{uid}/{type}/{hash}.{ext}` with migration metadata that upload/delete triggers skip.
   - Create or update `users/{uid}/uploads/{hash}` idempotently with `shareable: false` by default.
   - Rewrite grid references to the new URL and hash fields.
   - Bump grid `rev` in the same Firestore transaction as each rewrite.
   - Mark migrated grids with an observable marker such as `storageSchemaRev`.

4. Authoritative storage usage recompute.
   - After copy/backfill, recompute each user's unique active archive bytes.
   - Set `users/{uid}.storageUsed` once with the server helper.
   - Produce a before/after report, especially where dedupe lowers usage.

5. Link-images migration.
   - Before removing rules, explicitly check production Storage for `users/{uid}/link-images/`.
   - Copy any existing objects into the canonical scheme.
   - Rewrite affected `LinkContent.customImageUrl` and hash fields.
   - Confirm no remaining references before removal.

6. GC phase.
   - Delay deletion of old storage objects specifically to preserve compatibility with stale clients, in-flight viewers, cached old URLs, and any open editor sessions that may still reference pre-migration URLs.
   - Run only after:
     - final converge pass is clean,
     - no old-style uploads can be created,
     - every reference has been rewritten or explicitly skipped,
     - grace period has passed.
   - Delete old objects last, only after the compatibility grace period and verification gates are complete.
   - Keep a deletion manifest for recovery/audit.

## Phase 8 - Cutover and contract

Goal: enforce the migrated model and remove dead paths after verification.

1. Enable grid `rev` enforcement in `firestore.rules`.
   - Grid create requires a valid initial `rev`.
   - Grid update requires `request.resource.data.rev == resource.data.rev + 1`.
   - Rules must explicitly support the revision contract used by the client DAO transaction: the stored `resource.data.rev` is the expected/client-loaded revision, and the incoming document must advance it by exactly one.
   - Add a separate `lastOpenedAt`-only update allowance that does not require a `rev` bump, matching the runtime behavior where recency touches are intentionally excluded from grid-content revisioning.
   - Keep the client-side transaction conflict check as the typed app error path; Firestore rules are a server-side enforcement layer for client SDK writes.
   - Admin SDK migration/backfill bypasses rules.

2. Remove old upload paths.
   - Remove old original-filename upload code from `StorageService` and `FirebaseStorageDao` path builder usage.
   - Remove client direct delete API from contracts/pro/stubs if no fixed-location caller still needs it.
   - Remove `link-images` storage rules only after Phase 7 verification.

3. Keep backward read tolerance.
   - Do not remove `src`-only rendering support.
   - External URLs, embeds, demo data, and skipped legacy references remain valid.

4. Add operational documentation.
   - Durable maintainer docs should go under `docs/maintainers/` if this becomes an ongoing runbook.
   - Architecture notes for the storage model should go under `docs/architecture/`.
   - Keep this `notes/` file as the working implementation checklist unless promoted.

5. Final verification.
   - `npm --workspace @grids/contracts run type-check`
   - `npm --workspace @grids/pro run test`
   - `npm --workspace apps/web run test:run`
   - `npm --workspace apps/web run type-check:only`
   - `npm --workspace @grids/firebase-functions run test`
   - `npm --workspace @grids/firebase-functions run type-check`
   - Firebase rules test suite or maintainer emulator verification.
   - Staging/emulator end-to-end upload/archive/delete/backfill rehearsal.

## Suggested implementation slices

Use these as PR or worktree boundaries. Do not mix migration/GC work with user-facing upload changes.

1. Contracts, reference extraction utility, and tests.
2. Backend archive callables, trigger filtering, dev-account flag, and function tests.
3. Firebase rules tests and Phase 1 rules gate.
4. Client hash/authorize/upload refactor while preserving optimistic previews.
5. `rev` plumbing and persistence conflict handling.
6. Server-side refCount reconciliation across grid lifecycle.
7. File Archive read/list/delete/add UI.
8. Backfill dry-run tooling and inventory reports.
9. Backfill copy/converge implementation and staging rehearsal.
10. Production migration, authoritative storageUsed recompute, and monitored bake period.
11. GC old objects and remove `link-images` rule.
12. Contract cleanup and durable maintainer/architecture docs.
