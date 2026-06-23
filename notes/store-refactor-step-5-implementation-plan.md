# Store Refactor Step 5 Implementation Plan

## Purpose

Implement only Step 5, **Preserve History and Upload Coordination**, from
`notes/store-refactor-plan.md`.

This is a plan only. Do not begin source implementation as part of this step.

Step 4 is assumed complete:

- Live-grid mutations route through `GridController` commands.
- Persistence uses `scheduleSave()` and `flushSaves()`.
- Saves are scoped by grid ID and `sessionGeneration`.
- Continuous edit, move, and resize commands schedule one final save at commit.

Step 5 should harden the history/upload boundary without expanding into Step 6
demo isolation or Step 7 facade removal.

## Goals

- Preserve the command sequence:
  `capture before-state -> mutate canonical grid -> record history -> schedule save`.
- Preserve continuous gesture semantics:
  capture once, accept intermediate mutations, record one history entry, and
  schedule one final save.
- Make optimistic upload completion session-aware, tile-aware, and upload-aware.
- Replace `blob:` URLs in undo, redo, stable, and pending transaction snapshots.
- Ensure persisted snapshots never contain unresolved `blob:` URLs.
- Keep resolved media and document URLs stable through undo/redo.
- Revoke every owned object URL exactly once.
- Cancel in-flight uploads when supported; otherwise mark them abandoned and
  ignore late progress/completion safely.
- Restore editor autosave persistence for text-like tiles: changed editor
  content should persist after a 1.5 second pause while focus remains inside
  the tile, and should still flush immediately when editing ends.

## Source Contract

Keep the implementation aligned with:

- `notes/store-refactor-plan.md`
- `notes/store-refactor-behavior-matrix.md`
- `docs/architecture/repository-layout.md`

The behavior matrix remains the compatibility contract. Step 5 may correct the
confirmed upload/history defects, but it must not change unrelated mutation,
permission, analytics, breakpoint, or persistence behavior.

## Target Files

Primary implementation surfaces:

- `apps/web/src/controllers/GridController.ts`
- `apps/web/src/stores/grid/gridUploads.ts`
- `apps/web/src/stores/grid/gridHistory.ts`
- `apps/web/src/undo/GridSnapshotCodec.ts`
- `apps/web/src/utils/GridPersistenceUtils.ts`
- `apps/web/src/composables/useEditorAutosave.ts`
- `apps/web/src/composables/useFileUpload.ts`
- `apps/web/src/components/tilecontent/TextContent.vue`
- `apps/web/src/components/tilecontent/ProfileBioContent.vue`
- Other editor-backed tile content components using `useEditorAutosave`
- `apps/web/src/stores/grid.ts` facade wrappers, only if signatures need
  compatibility shims

Primary tests:

- `apps/web/src/controllers/__tests__/GridController.test.ts`
- `apps/web/src/stores/grid/__tests__/gridUploads.test.ts`
- `apps/web/src/stores/grid/__tests__/gridHistory.test.ts`
- `apps/web/src/undo/__tests__/GridSnapshotCodec.test.ts`
- `apps/web/src/utils/__tests__/GridPersistenceUtils.test.ts`
- `apps/web/src/composables/__tests__/useEditorAutosave.test.ts`
- `apps/web/src/composables/__tests__/useFileUpload.test.ts`
- `apps/web/src/components/tilecontent/__tests__/contentEscapeHatches.test.ts`
- `apps/web/src/stores/__tests__/grid.uploads.test.ts`
- `apps/web/src/stores/__tests__/grid.history.test.ts`
- `apps/web/src/stores/__tests__/grid.session.test.ts`
- `apps/web/src/stores/__tests__/grid.tiles.test.ts`

## Implementation Slices

### 1. Confirm Current Step 5 Gaps

- Re-run targeted searches for `blob:`, `URL.revokeObjectURL`,
  `resolveUploadedUrl`, `setTileUploading`, `clearTileUploading`,
  `setResolvedUrl`, and `setResolvedDocumentItemUrl`.
- Verify `GridSnapshotCodec` still round-trips `ogImageSrc`; fix only if the
  current implementation regressed.
- Verify `GridPersistenceUtils` strips or replaces every upload-backed `blob:`
  URL before persistence.
- Identify every upload path that creates an object URL or registers a
  resumable `StorageUploadTask`.

### 2. Add Upload Identity and Ownership

- Extend `gridUploads` from loose tile maps into explicit upload records keyed
  by a generated upload ID.
- Each record should include grid ID, session generation, tile ID, optional
  document item ID, progress, owned object URL, resolved URL, status, and a
  per-tile/item generation.
- Keep existing facade-readable maps (`uploadingTiles`, `resolvedUrls`,
  `resolvedDocumentItemUrls`) available during compatibility.
- Add store actions for starting, progressing, resolving, failing,
  abandoning, cancelling, and clearing uploads.
- Make `clearTileState()` and `reset()` revoke or return owned object URLs for
  exactly-once cleanup.
- Keep non-serializable upload task handles out of persisted grid data. If task
  handles are tracked, keep them controller-local or `markRaw`.
- Ensure that tiles like the ImageContent or VideoContent can still read the upload progress
  to provide a progress bar

### 3. Route Upload Lifecycle Through Controller Commands

- Replace direct upload bookkeeping in `useFileUpload.ts` with controller
  upload lifecycle commands.
- At upload start, capture the active persistence scope and upload generation.
- Progress, completion, failure, cancellation, and thumbnail follow-up must pass
  the upload identity back to the controller.
- On completion, validate that the active session, tile, optional document
  item, and upload generation still match before mutating upload/history state.
- If validation fails, revoke or release the local object URL if still owned,
  ignore the late callback, and do not schedule persistence.
- For supported resumable tasks, call `cancel()` when a tile/session is cleared
  or an upload is superseded. If cancellation is not possible or races with
  completion, mark the upload abandoned and let validation drop late callbacks.

### 4. Harden History URL Replacement

- Keep upload completion sequencing:
  `validate upload -> record resolved URL -> replace blob URL in history and
  pending transactions -> schedule save`.
- Ensure media and document item replacement hits:
  undo stack, redo stack, stable snapshot, pending edit snapshot, pending move
  snapshot, and pending resize snapshot.
- Preserve current continuous transaction semantics: resolving an upload during
  an edit, move, or resize must not create extra history entries.
- Add explicit tests for undo and redo after upload resolution so history never
  restores temporary URLs.

### 5. Centralize Object URL Cleanup

- Move object URL ownership decisions out of scattered catch blocks and tile
  removal branches.
- `gridUploads` or a narrow helper should decide whether an object URL is still
  owned before revocation.
- Tile removal should clear upload state, cancel/abandon active uploads for
  that tile, revoke owned previews once, remove resolved maps, then mutate the
  canonical grid and schedule persistence through the existing command path.
- Session clearing/replacement should clear every upload record and prevent all
  late callbacks from changing the new session.

### 6. Preserve Persistence Semantics

- Keep `scheduleSave()` as the only background persistence entry point for
  upload completion.
- Keep `flushSaves()` only where durable completion is required, such as
  document thumbnail generation after document upload persistence.
- Do not add new component-level save calls.
- Confirm scheduled persistable snapshots use resolved URL maps and never write
  unresolved `blob:` URLs.

### 7. Restore Editor Autosave Debounce

- Treat the lost 1.5 second editor debounce as part of Step 5's persistence
  coordination cleanup, not as a replacement for the existing blur/commit
  behavior.
- Preserve `useEditorAutosave` as the owner of autosave timing. It should
  schedule persistence only after an actual content change, not merely because
  the user focused an editor.
- Text-like editors such as `TextContent` and `ProfileBioContent` must save
  changed content after the user pauses typing for 1.5 seconds while still
  focused in the tile.
- Exiting the tile after a change should still flush immediately, canceling any
  pending debounce timer and committing the edit transaction once.
- Focusing a tile, making no changes, and blurring must not schedule a save or
  create a history entry.
- The debounced save should use the existing controller command path so it
  preserves Step 4 ordering, persistence scoping, and continuous edit history
  semantics.
- Add fake-timer tests around `useEditorAutosave` and representative editor
  components to prove pause-to-save, blur-to-flush, no-change/no-save, and
  single-history-entry behavior.

## Acceptance Criteria

- Stale upload progress/completion from an old session, removed tile, removed
  document item, or superseded upload is ignored.
- Upload state cannot outlive a session clear, grid replacement, or tile
  removal.
- Removing a tile during upload cancels or abandons the task and revokes owned
  object URLs exactly once.
- Failed uploads remove temporary state without double-revoking previews.
- Successful media and document uploads replace every relevant history snapshot
  and pending transaction snapshot.
- Undo/redo after upload resolution never restores a temporary URL.
- Document uploads still flush before thumbnail generation.
- Every continuous gesture still produces one history entry and one final save.
- Text editor changes persist after 1.5 seconds of inactivity while editing,
  persist immediately on edit exit, and do not persist on focus-only/no-change
  interactions.
- No focused store imports another focused store or the controller.

## Verification

Run focused tests first:

```sh
npm --prefix apps/web run test:run -- apps/web/src/stores/grid/__tests__/gridUploads.test.ts
npm --prefix apps/web run test:run -- apps/web/src/stores/grid/__tests__/gridHistory.test.ts
npm --prefix apps/web run test:run -- apps/web/src/controllers/__tests__/GridController.test.ts
npm --prefix apps/web run test:run -- apps/web/src/composables/__tests__/useEditorAutosave.test.ts
npm --prefix apps/web run test:run -- apps/web/src/composables/__tests__/useFileUpload.test.ts
npm --prefix apps/web run test:run -- apps/web/src/components/tilecontent/__tests__/contentEscapeHatches.test.ts
npm --prefix apps/web run test:run -- apps/web/src/stores/__tests__/grid.uploads.test.ts apps/web/src/stores/__tests__/grid.history.test.ts apps/web/src/stores/__tests__/grid.session.test.ts apps/web/src/stores/__tests__/grid.tiles.test.ts
```

Then run the Step 5 regression checks:

```sh
npm --prefix apps/web run test:run
npm --prefix apps/web run type-check
git diff --check
```

Use manual verification only after automated tests pass:

- Start an upload, remove the tile before completion, and confirm no stale save.
- Start an upload, navigate to another grid before completion, and confirm the
  new session is untouched.
- Upload documents and verify thumbnail generation still waits for flushed
  persistence.
- Upload media, undo, redo, and confirm the visible tile and persisted snapshot
  use the permanent URL.
- Type in a text/profile editor, pause for more than 1.5 seconds without
  blurring, reload, and confirm the paused text was persisted.
- Focus a text/profile editor without changing content, blur, and confirm no
  save or history entry was created.
