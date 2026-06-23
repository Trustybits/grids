# Store Refactor Step 4 Implementation Plan

## Purpose

Implement only Step 4, **Move Mutations and Persistence into Commands**, from
`notes/store-refactor-plan.md`.

Step 3 is complete in the current checkout:

- Six focused Pinia stores own collection, session, history, viewport, upload,
  and UI state.
- `GridController` owns cross-store orchestration.
- `apps/web/src/stores/grid.ts` is a compatibility facade.
- History and transaction state are scoped per Pinia instance.
- Cross-breakpoint history restoration waits for both the minimum 500 ms delay
  and rendered-layout readiness.

Step 4 must now close the remaining mutation and persistence escape hatches:

- Replace ambiguous `saveGrid()` and `updateGrid()` workflows with typed
  controller commands.
- Make every canonical grid mutation originate in a controller command.
- Move save coalescing and completion semantics behind explicit
  `scheduleSave()` and `flushSaves()` APIs.
- Scope persistence work to the active grid session so an old session cannot
  mutate the persistence status of a replacement session or overwrite another
  grid's queued snapshot.
- Preserve the existing facade and its read API until the later consumer
  migration/removal step.

This document is an implementation plan only. It does not implement Step 4.

## Source Contract

The implementation must remain consistent with:

- `notes/store-refactor-plan.md`
- `notes/store-refactor-behavior-matrix.md`
- `notes/store-refactor-step-3-implementation-plan.md`
- `docs/architecture/repository-layout.md`

The behavior matrix remains the compatibility checklist. Step 4 may replace
internal save mechanics, but it must not silently change user-visible mutation,
history, permission, analytics, or breakpoint behavior.

## Current Baseline

### What Step 3 already established

`apps/web/src/controllers/GridController.ts` currently owns most mutations and
orchestration, including:

- Grid settings, backgrounds, theme, OG image, and gravity.
- Tile creation, duplication, deletion, resizing, border, caption-adjacent,
  and content changes.
- History capture, edit/move/resize transactions, undo, redo, and snapshot
  application.
- Breakpoint overrides and rendered-position synchronization.
- Upload progress and resolved-URL bookkeeping.
- Collection and active-session workflows.

`apps/web/src/stores/grid.ts` delegates actions to the controller and exposes
focused-store state through writable facade refs.

### Remaining architectural gaps

The current code does not yet satisfy Step 4:

1. `GridController.saveGrid()` is an ambiguous persistence entry point.
   Callers cannot tell whether it schedules, flushes, snapshots immediately,
   or waits for durable completion.
2. `GridController.updateGrid()` combines two separate responsibilities:
   synchronizing rendered desktop geometry into canonical tiles and requesting
   persistence.
3. Most controller mutation methods call `updateGrid()` or `saveGrid()`
   indirectly. This makes exact "one command schedules once" assertions
   difficult and allows nested commands to schedule duplicate saves.
4. `GridService.queueSave()` owns one process-wide lane:
   `_saveInFlight`, `_saveQueued`, and `_pendingSnapshot`. A save for grid B can
   replace the pending snapshot for grid A, and a completion/failure from an old
   session has no session identity.
5. `GridService.queueSave()` catches write failures internally, while the
   controller expects a rejection to populate `gridSession.persistenceError`.
   The error contract is therefore not reliable for the real service.
6. Components and composables still directly mutate canonical data and then
   call `saveGrid()` or `updateGrid()`.
7. Continuous edit transactions suppress per-keystroke history, but
   `patchTileContent()` still schedules persistence for every intermediate
   mutation. The intended transaction contract is one final scheduled save.
8. The compatibility facade still exposes writable canonical state. That must
   remain temporarily for Step 3 compatibility, but production mutation paths
   introduced or touched by Step 4 must stop relying on it.

### Known direct mutation and save callers

The implementation must re-run the searches in the verification section, but
the current known production callers are:

| Area | Current escape hatch | Step 4 replacement |
| --- | --- | --- |
| `Grid.vue` | Mutates compacted tile `x`/`y`, then calls `updateGrid()` | `commitCompactedLayout(layout)` |
| `Tile.vue` | Mutates canonical `w`/`h` during resize | Controller-owned resize preview/commit |
| `TileCaption.vue` | Mutates `tile.caption`, then calls `updateGrid()` | `updateCaption(tileId, caption)` |
| `GridNameEditor.vue` | Mutates `currentGrid.name`, then calls `saveGrid()` | `renameCurrentGrid(name)` |
| `useColorPicker.ts` | Mirrors into content and may call `saveGrid()` | Tile-ID-based content command; no save fallback |
| `useTileLink.ts` | Mutates content and may call `saveGrid()` | Tile-ID-based link-content command |
| `useFileUpload.ts` | Calls `updateGrid()`/`saveGrid()` after URL resolution | Upload completion command plus explicit flush where required |
| `LinkContent.vue` | Mutates content props and calls `saveGrid()` | Typed content patch commands |
| `MapContent.vue` | Mutates canonical map content and calls `saveGrid()` | Typed map-content patch/commit commands |
| `ProfileBioContent.vue` | Mutates canonical/profile props and calls `saveGrid()` | Typed profile-content patch commands |
| `SmartTextContent.vue` | Mutates canonical text and calls `saveGrid()` | Edit-transaction content command |
| `TextContent.vue` | Mutates canonical text and calls `saveGrid()` | Edit-transaction content command |

The `LandingPageGridEmbed.vue` assignments to global session state are Step 6
demo-isolation work, not Step 4. They must not be expanded or redesigned here.

## Step 4 Scope

### In scope

- Typed controller commands for all live-grid mutations listed in the main
  Step 4 plan.
- Permission checks at the command boundary.
- Pre-mutation history capture and post-mutation history recording.
- Exact one-schedule-per-command persistence semantics.
- One-save-at-commit semantics for edit, drag, and resize transactions.
- Session-scoped persistence lanes.
- Explicit background scheduling and confirmed flushing.
- Immutable persistable snapshots captured when a save is scheduled.
- Persistence status/error reporting in `gridSession`.
- Replacement of production direct canonical mutations and direct save calls.
- Compatibility wrappers in `useGridStore()` while the facade still exists.
- Tests and source-level checks proving the command boundary.

### Explicitly out of scope

Do not implement any of the following in Step 4:

- Upload generation IDs, task cancellation, stale upload callback rejection,
  or final object-URL ownership. Those are Step 5.
- A live/demo `GridViewContext` or demo-state isolation. That is Step 6.
- Full consumer migration away from `useGridStore()`, facade deletion, or
  deeply readonly canonical state. Those are Step 7.
- Stale grid-load response rejection unless a minimal session token is needed
  only to scope persistence. Load-generation behavior remains a later concern.
- Persisted schema changes.
- Moving `GridLayoutItem` into shared contracts.
- Changing the 500 ms cross-breakpoint history transition.
- Replacing the existing editor-level 1.5 second UX debounce unless necessary
  to remove a direct save call. Controller scheduling and editor UX debouncing
  are separate concerns.

## Target Dependency Direction

```text
Components and composables
          |
          | command calls through temporary facade
          v
     GridController
       |       \
       |        \ mutation/history/viewport/upload coordination
       v
 GridPersistenceScheduler
       |
       | immutable, session-scoped snapshots
       v
   IGridService.saveGrid()
```

Focused stores continue to own state. They must not import the controller,
the scheduler, or one another.

The controller decides:

- Whether the command is allowed.
- Whether a history snapshot is required.
- Whether a mutation is discrete or part of an active transaction.
- Which dependent state must change.
- Whether persistence is scheduled now or deferred until transaction commit.
- Whether analytics is emitted.

Components provide command inputs only. They do not mutate canonical objects,
choose save ordering, or call service persistence methods.

## Persistence Design

### 1. Add an explicit session persistence scope

Extend `gridSession` with a monotonically increasing session generation or
equivalent opaque token.

The persistence scope must contain both:

```ts
interface GridPersistenceScope {
  gridId: string;
  sessionGeneration: number;
}
```

Rules:

- Increment the generation whenever a live or demo session is installed,
  replaced, or cleared.
- A new load gets a new generation before the loaded grid becomes active.
- The token is used only to identify session-owned persistence work in Step 4.
  It must not be presented as complete stale-load protection.
- Error/success callbacks update `gridSession` only when both grid ID and
  generation still match the active session.

### 2. Extract a per-controller persistence scheduler

Add a scheduler owned by the per-Pinia controller context. Recommended files:

- `apps/web/src/services/GridPersistenceScheduler.ts`
- `apps/web/src/services/interfaces/IGridPersistenceScheduler.ts`
- `apps/web/src/services/__tests__/GridPersistenceScheduler.test.ts`

The scheduler should receive a lazy write dependency so controller creation
does not resolve the service factory:

```ts
write(snapshot: Grid): Promise<void>
```

Use one independent lane per `GridPersistenceScope`, not one global pending
snapshot.

Each lane tracks:

- At most one write in flight.
- At most one coalesced pending snapshot, always the newest scheduled snapshot
  for that same scope.
- Flush waiters that resolve only when the lane has no in-flight or pending
  work.
- The most recent write error for that lane.

Required behavior:

```text
schedule A1 -> write A1
schedule A2 while A1 is running -> retain A2 as A's latest pending snapshot
schedule B1 while A1 is running -> write/queue B1 in B's independent lane
A1 completes -> write A2
flush A -> resolve after A2
flush B -> resolve after B1
```

One grid's pending snapshot must never replace another grid's pending snapshot.

### 3. Capture immutable persistable snapshots at scheduling time

Move the persistable snapshot construction out of the private
`GridService.createPersistableSnapshot()` method and into a pure utility in
`apps/web/src/utils/GridPersistenceUtils.ts`.

The utility must:

- Deep-clone the grid.
- Replace resolved media and document `blob:` URLs.
- Strip unresolved `blob:` URLs as a final safety net.
- Return a plain, non-reactive `Grid`.
- Never retain caller-owned tile, content, override, or URL-map references.

The scheduler receives only this immutable snapshot. It must never retain the
reactive `gridSession.currentGrid`.

### 4. Define controller persistence APIs precisely

Add:

```ts
scheduleSave(): void;
flushSaves(): Promise<void>;
```

`scheduleSave()`:

1. Reads and validates the active session and edit permission.
2. Captures the current persistence scope.
3. Builds an immutable persistable snapshot immediately.
4. Marks the matching session persistence state as pending/saving.
5. Schedules exactly once in the matching scheduler lane.
6. Reports completion/failure only if the scope is still active.

`flushSaves()`:

1. Captures the current persistence scope.
2. Waits for already scheduled work in that lane to drain.
3. Does not create an additional save by itself.
4. Rejects or returns a typed failure when the matching lane fails.
5. Updates session persistence status only if the scope is still active.

Add explicit persistence state to `gridSession`, for example:

```ts
type GridPersistenceStatus = "idle" | "pending" | "saving" | "error";
```

Retain `persistenceError` for user-visible compatibility.

### 5. Remove queue ownership from `GridService`

After the scheduler is connected:

- Remove `_saveInFlight`, `_saveQueued`, and `_pendingSnapshot` from
  `GridService`.
- Remove or deprecate `IGridService.queueSave()`.
- Keep `IGridService.saveGrid(snapshot)` as the single-write boundary.
- Move queue/coalescing tests from `GridService.test.ts` to the scheduler test.
- Make write failures reject so the controller/scheduler can report them.

Collection rename/update workflows that intentionally use
`IGridService.updateGrid()` remain separate from active-session background
persistence.

## Typed Command Surface

Add command input types in a dedicated controller-local module, recommended:

- `apps/web/src/controllers/GridCommands.ts`

Do not put app orchestration types into `packages/contracts`.

### Session and persistence

```ts
scheduleSave(): void;
flushSaves(): Promise<void>;
renameCurrentGrid(name: string): void;
```

`renameCurrentGrid()` updates the active grid and matching collection entry,
preserves the existing no-history behavior unless characterization proves
otherwise, and schedules once.

The existing collection command `renameGrid(id, name)` remains the explicit
remote/dashboard workflow and keeps its current promise/error behavior.

### Grid settings and metadata

Retain or normalize the existing commands:

- `toggleVerticalCompact()`
- `setVerticalCompact(value)`
- `setGridTheme(themeId)`
- `setDuplicatable(value)`
- `addBackgroundImage(url, embed)`
- `removeBackgroundImage()`
- `setCustomOgImage(url)`
- `removeCustomOgImage()`
- `setBackgroundColor(color)`
- `removeBackgroundColor()`

Each command must call the shared command executor once and schedule at most
once. Nested calls to another command that also schedules are prohibited.

### Tile structure and content

Use typed input objects for multi-argument mutations:

```ts
interface PatchTileContentInput {
  tileId: string;
  patch: Partial<AnyTileContent>;
}

interface PatchDocumentItemInput {
  tileId: string;
  itemId: string;
  patch: Partial<DocumentItem>;
}

interface UpdateCaptionInput {
  tileId: string;
  caption: string;
}

interface ResizeTileInput {
  tileId: string;
  width: number;
  height: number;
}
```

Commands:

- `addTile(input)`
- `duplicateTile(tileId)`
- `removeTile(tileId)`
- `resizeTile(input)` for discrete toolbar/preset resizing
- `replaceTileContent(input)`
- `patchTileContent(input)`
- `patchDocumentItem(input)`
- `updateCaption(input)`
- `toggleTileBorder(tileId)`
- `toggleLinkBackground(tileId)`

Preserve existing return values such as the new tile ID or `null`.

### Rendered geometry and breakpoint commands

Replace `updateGrid()` with commands that state what geometry is being
committed:

- `commitRenderedDesktopLayout(layout?)`
- `commitCompactedLayout(layout)`
- `saveBreakpointPositions({ breakpoint, layout })`
- `resetBreakpoint(breakpoint)`
- `commitMove()`
- `commitResize()`

`commitRenderedDesktopLayout()` must copy only `x`, `y`, `w`, and `h` from
position-only `GridLayoutItem` values into canonical tiles. It must never copy
tile content from rendered layout objects.

`commitMove()` and `commitResize()` choose desktop synchronization versus
non-desktop override capture internally. Components must not make that
persistence decision.

### Continuous edit, move, and resize transactions

Enforce:

```text
begin transaction and capture once
-> accept intermediate canonical/layout mutations without scheduling
-> compare at commit
-> push one history entry if changed
-> schedule exactly once if changed
```

Required changes:

- `patchTileContent()` and `patchDocumentItem()` must not schedule during an
  active edit transaction for the same tile.
- `commitEditing()` schedules once only when the snapshot changed.
- `commitEditing()` performs no save for a no-op transaction.
- `beginMove()`/`beginResize()` capture once.
- Intermediate drag/resize updates do not schedule.
- `commitMove()`/`commitResize()` record one history entry and schedule once.
- A commit without a pending transaction or without a state change is a no-op.

Do not remove the editor's 1.5 second debounce. Instead, make its callback issue
the appropriate content command, and make edit lifecycle flushes commit the
transaction rather than call persistence directly.

### Upload completion in Step 4

Add an explicit existing-upload completion command, for example:

```ts
resolveUploadedUrl(input: {
  tileId: string;
  itemId?: string;
  permanentUrl: string;
}): void;
```

For this step it must:

1. Record the resolved URL in `gridUploads`.
2. Replace the blob URL in undo, redo, stable, and pending snapshots.
3. Clear upload progress when completion is final.
4. Schedule one persistable save.

Document uploads may call `flushSaves()` before starting server-side thumbnail
generation because that workflow requires confirmed persisted document data.

Do not add upload generations, stale callback rejection, cancellation, or
object-URL ownership in this step. Keep those Step 5 requirements visible in
tests as deferred cases rather than partially implementing them.

## Internal Command Execution Pattern

Introduce private controller helpers to make sequencing explicit without
letting components select history/persistence policy.

Recommended shape:

```ts
private runGridCommand<T>({
  validate,
  captureHistory,
  mutate,
  updateDependents,
  recordHistory,
  persist,
  analytics,
}: GridCommandDefinition<T>): T
```

This is an internal implementation tool, not a public generic mutation API.
Public methods remain semantic and typed.

The default discrete mutation order is:

```text
validate active session and permission
-> capture pre-mutation snapshot
-> mutate canonical state once
-> update focused dependent state
-> push history
-> schedule save once
-> emit analytics
```

No public command may call another public command if both can schedule.
Extract non-scheduling private mutation helpers instead.

## History Compatibility Policy

Direct component writes currently have inconsistent history behavior. Step 4
must not accidentally add or remove undo entries while replacing them.

Before migrating each direct-write path:

1. Add or confirm a characterization test for its current history behavior.
2. Assign a fixed history policy to the semantic controller command.
3. Keep that policy inside the controller, not in a caller-supplied option.

Examples:

- Caption and active-grid name currently save without an explicit history
  snapshot; preserve that unless the canonical plan explicitly approves a
  change.
- Text/profile editor changes participate in edit transactions and should
  produce one edit history entry at commit.
- Map movement/settings currently mutate and save directly. Characterize
  whether each interaction is discrete or continuous before choosing its
  command boundary.
- Color and link changes that already call `patchTileContent()` retain its
  characterized history behavior.

Do not add a public `history: "none" | "record"` escape hatch. If two workflows
need different history behavior, expose two semantic commands or move the
continuous workflow behind begin/commit commands.

## File-by-File Implementation Plan

### `apps/web/src/stores/grid/gridSession.ts`

- Add session generation/token state.
- Add persistence status.
- Keep `persistenceError`.
- Add helpers to install/reset a session and compare a persistence scope.
- Ensure reset increments or invalidates the prior scope.
- Add focused tests for scope changes and stale persistence result rejection.

### `apps/web/src/services/GridPersistenceScheduler.ts`

- Add per-scope lanes.
- Coalesce only within one scope.
- Keep immutable snapshots.
- Expose `schedule(scope, snapshot)` and `flush(scope)`.
- Surface write errors.
- Clean up drained lanes after all flush waiters resolve.

### `apps/web/src/utils/GridPersistenceUtils.ts`

- Add `createPersistableGridSnapshot()`.
- Consolidate resolved URL replacement and unresolved blob stripping.
- Preserve all persisted grid fields and overrides.
- Add deep-aliasing and URL replacement tests.

### `apps/web/src/services/GridService.ts`

- Remove save queue state and recursive queue flushing.
- Keep single-write `saveGrid()`.
- Ensure errors reject.
- Leave collection CRUD behavior unchanged.

### `apps/web/src/controllers/useGridController.ts`

- Create one scheduler per Pinia/controller instance.
- Inject lazy `saveGrid(snapshot)` writing.
- Do not make the scheduler a process singleton.
- Preserve one-controller-per-Pinia behavior.

### `apps/web/src/controllers/GridController.ts`

- Add `scheduleSave()` and `flushSaves()`.
- Add persistence scope checks and session-state reporting.
- Replace every internal `saveGrid()`/`updateGrid()` call.
- Add typed semantic commands listed above.
- Add non-scheduling private geometry/content mutation helpers.
- Make transaction commits own their final save.
- Keep the 500 ms/readiness history path unchanged except that snapshot
  application calls `scheduleSave()` once after applying.
- Preserve analytics ordering. Where characterization requires save scheduling
  before analytics, assert that exact order.

### `apps/web/src/stores/grid.ts`

- Forward new typed commands.
- Keep compatibility aliases temporarily:
  - Legacy `saveGrid()` should be a deprecated wrapper with explicit,
    documented semantics, implemented through `scheduleSave()` and
    `flushSaves()`.
  - Legacy `updateGrid()` should delegate to
    `commitRenderedDesktopLayout()`.
- Do not add state or orchestration to the facade.
- Production code must stop calling the two deprecated wrappers.
- Keep writable facade refs until Step 7; do not make the facade readonly here.

### Grid canvas and tile shell

`Grid.vue`:

- Keep compaction calculation and rendered-layout reconciliation in the layout
  boundary.
- Send the final position-only compacted layout to
  `commitCompactedLayout()`.
- Remove canonical tile `x`/`y` assignments.
- Remove `updateGrid()`.

`Tile.vue`:

- Remove canonical tile `w`/`h` writes from `onResize`.
- Let position-only layout continue to provide live resize feedback.
- Let `commitResize()` synchronize final canonical desktop geometry or
  breakpoint overrides.

`TileCaption.vue`:

- Replace tile lookup/direct caption assignment/`updateGrid()` with
  `updateCaption({ tileId, caption })`.

`GridNameEditor.vue`:

- Replace active-grid name assignment/`saveGrid()` with
  `renameCurrentGrid(name)`.

### Shared composables

`useColorPicker.ts`:

- Require a tile ID for live-grid persistence paths.
- Use `patchTileContent()` as the canonical write.
- Do not mirror a patch into canonical props after the command.
- If a non-live preview still needs local mutation, keep it explicitly local
  and do not call grid persistence. Demo isolation remains Step 6.

`useTileLink.ts`:

- Use the tile ID and a content patch command.
- Remove direct content mutation for live tiles.
- Keep local-only preview behavior separate from live persistence.

`useFileUpload.ts`:

- Replace `setResolvedUrl()` + `clearTileUploading()` + `updateGrid()` sequences
  with one upload completion command.
- Replace the document `saveGrid()` with completion scheduling followed by
  `flushSaves()` before thumbnail generation.
- Keep existing failure/revert behavior.
- Do not add generation or cancellation logic.

### Tile-content components

For each component, use the injected stable tile ID rather than matching by
content object identity.

`LinkContent.vue`:

- Replace direct `props.content` mutations with typed patches.
- Keep editor autosave and edit lifecycle behavior.
- Remove every `saveGrid()` fallback from live-grid paths.

`MapContent.vue`:

- Replace writes through `storeContent` with typed map-content patches.
- Route style, 3D, cloud, plane, marker, center, zoom, bearing, and pitch
  persistence through commands.
- Preserve the existing 300 ms map synchronization debounce.
- Characterize map history before choosing discrete versus continuous command
  boundaries.

`ProfileBioContent.vue`:

- Replace direct profile photo, name/title/bio, avatar shape/radius/sides
  mutations with typed content commands.
- Keep editor transactions for text fields.
- Treat pointer-driven radius/sides changes as continuous interactions and
  persist once on commit.

`SmartTextContent.vue` and `TextContent.vue`:

- Replace direct canonical text assignment and `saveGrid()` with
  `patchTileContent()`.
- Keep begin/edit/commit boundaries so intermediate editor updates do not
  schedule.

`DocumentsContent.vue`:

- Remove direct custom title/description mutation where the value is canonical.
- Use content patch commands while preserving editor debounce and transaction
  behavior.

### Tests and harnesses

Update:

- `apps/web/src/controllers/__tests__/GridController.test.ts`
- `apps/web/src/stores/__tests__/grid.tiles.test.ts`
- `apps/web/src/stores/__tests__/grid.history.test.ts`
- `apps/web/src/stores/__tests__/grid.session.test.ts`
- `apps/web/src/stores/__tests__/grid.viewport.test.ts`
- `apps/web/src/stores/__tests__/grid.uploads.test.ts`
- `apps/web/src/stores/__tests__/grid.facade.test.ts`
- `apps/web/src/stores/__tests__/gridTestHarness.ts`
- `apps/web/src/composables/__tests__/useFileUpload.test.ts`
- Relevant component/composable tests for every migrated direct-write caller.

The harness should mock the scheduler or single-write service boundary
according to the test level. Controller tests should prefer a real scheduler
with a controlled write promise when validating ordering and session scope.

## Implementation Sequence

### Part 1: Characterize remaining escape hatches

Before changing production code, add focused tests for:

- Caption save history and persistence count.
- Active-grid name save history and collection mirroring.
- Grid compaction canonical geometry and save count.
- Desktop resize preview versus commit.
- Text/profile/link/document editor transaction save counts.
- Map discrete and continuous mutation behavior.
- Upload completion scheduling and document flush requirements.

Success:

- Every direct mutation/save caller has a test defining mutation, history, and
  persistence behavior.

Failure:

- A caller is migrated based only on nearby store tests while its observable
  behavior is uncharacterized.

### Part 2: Add immutable snapshot creation

1. Extract persistable snapshot creation into `GridPersistenceUtils`.
2. Add deep-copy and URL tests.
3. Change `GridService.saveGrid()` callers in tests to use plain snapshots.
4. Do not change controller call sites yet.

Success:

- Persistable snapshots contain no reactive aliases or unresolved blob URLs.

### Part 3: Add session-scoped scheduler

1. Implement independent per-scope lanes.
2. Add deterministic deferred-promise tests.
3. Prove same-scope coalescing and cross-scope isolation.
4. Prove flush completion and rejection.
5. Prove a stale lane cannot update the active session's status.

Success:

- Concurrent grids cannot replace each other's pending snapshots.

### Part 4: Introduce controller persistence APIs

1. Add session generation and persistence status.
2. Inject the scheduler per Pinia.
3. Implement `scheduleSave()` and `flushSaves()`.
4. Replace controller-internal `saveGrid()` calls with one explicit schedule at
   the end of each command.
5. Replace snapshot-apply persistence with `scheduleSave()`.
6. Keep facade compatibility wrappers temporarily.

Success:

- Every controller command test can assert exactly zero or one schedule.

### Part 5: Normalize discrete mutation commands

Migrate in low-coupling slices:

1. Grid settings and metadata.
2. Tile structure and content.
3. Caption and current-grid rename.
4. Breakpoint reset/save.
5. Upload completion.

After each slice:

- Run the corresponding characterization tests.
- Assert permission, history, mutation, schedule, and analytics order.
- Remove nested `updateGrid()`/`saveGrid()` calls from that slice.

### Part 6: Normalize geometry and continuous transactions

1. Add private position-only-to-canonical synchronization.
2. Migrate compaction.
3. Migrate drag commit.
4. Migrate resize preview/commit.
5. Make edit commits schedule once on change.
6. Make no-op commits schedule zero times.

Success:

- One gesture produces one history entry and one scheduled persistence
  operation.

### Part 7: Remove production direct writes and save calls

Migrate the known component/composable callers listed above.

Do not migrate unrelated read-only consumers away from `useGridStore()`.
That broader facade migration belongs to Step 7.

Success:

- Production components/composables contain no canonical-grid assignments and
  no calls to `saveGrid()` or `updateGrid()`.

### Part 8: Remove the old service queue

After all controller persistence uses the scheduler:

1. Remove `queueSave()` from `IGridService`.
2. Remove it from real and mock services.
3. Move queue tests to the scheduler.
4. Update test harnesses and service factory mocks.

Success:

- `GridService` performs one requested write and owns no cross-command queue.

## Required Automated Coverage

### Command sequencing

For every mutation command, assert:

- Permission is checked before mutation.
- History is captured before mutation when required.
- Canonical state is mutated once.
- Dependent state is updated before persistence.
- History is recorded before persistence.
- `scheduleSave()` is called exactly once, or zero times for a no-op.
- Analytics occurs in the characterized order and cannot fail the mutation.

### Persistence scheduler

Add tests for:

- One scheduled snapshot writes once.
- Multiple schedules in one scope coalesce to the latest pending snapshot.
- Schedules for different scopes use independent lanes.
- `flush(scope)` waits for in-flight and pending work.
- `flush(scope)` is immediate when no work exists.
- A write failure rejects the matching flush.
- A failed old-session lane does not set the new session error.
- A successful old-session lane does not clear a new session error.
- Scheduled snapshots are immutable after the canonical grid changes.
- Scheduler lane cleanup does not strand flush waiters.

### Transactions

Add tests for:

- Edit patches during a transaction schedule zero intermediate saves.
- Changed edit commit pushes one history entry and schedules once.
- Unchanged edit commit pushes no history and schedules zero saves.
- Drag commit schedules once for desktop canonical positions.
- Drag commit schedules once for non-desktop overrides.
- Resize commit schedules once and preserves position-only rendering.
- Repeated begin calls do not replace the original pre-gesture snapshot.

### Persistence error state

Add tests for:

- Active-session write failure sets `persistenceError` and facade `error`.
- A later successful active-session flush clears `persistenceError`.
- Old-session completion cannot clear or set the replacement session's error.
- Read-only/demo sessions do not schedule.

### Component boundary

Update component/composable tests to assert command calls rather than direct
object mutation plus save calls.

Highest-priority tests:

- `Grid.test.ts`
- `Tile.test.ts`
- `TileCaption.test.ts`
- `GridNameEditor` coverage
- `useColorPicker.test.ts`
- `useFileUpload.test.ts`
- `useTileLink` coverage
- Text, smart-text, link, map, profile, and document content tests

## Source-Level Architecture Checks

Run these checks after implementation:

```sh
rg -n "gridStore\.(saveGrid|updateGrid)\(" apps/web/src \
  --glob '!**/__tests__/**' \
  --glob '!**/*.test.ts'
```

Expected: no production component or composable matches. Compatibility facade
wrappers may remain.

```sh
rg -n "currentGrid[^\\n]*(=|\\.tiles[^\\n]*(=|\\.push\\(|\\.splice\\())" \
  apps/web/src/components apps/web/src/composables
```

Expected: no live-grid canonical assignments. Explicit Step 6 demo
compatibility assignments may remain allowlisted and documented.

```sh
rg -n "props\\.content\\.[A-Za-z_$][A-Za-z0-9_$]*\\s*=" \
  apps/web/src/components apps/web/src/composables
```

Expected: no assignment when the prop aliases live canonical tile content.
Local-only/demo presentation state must be clearly separated and tested.

```sh
rg -n "queueSave|_saveInFlight|_saveQueued|_pendingSnapshot" apps/web/src
```

Expected: no legacy service queue after Part 8.

```sh
rg -n "from ['\"]@/stores/grid/" apps/web/src/stores/grid
```

Expected: no focused-store-to-focused-store imports.

## Verification Commands

Run targeted tests after each implementation part. Final verification:

```sh
npm --prefix apps/web run lint
npm --prefix apps/web run test:run
npm --prefix apps/web run type-check
npm --prefix apps/web run build
git diff --check
```

Use the `apps/web` test script rather than a raw root Vitest command so aliases
and jsdom configuration are applied.

## Manual Acceptance Scenarios

- Edit text continuously, stop typing, blur, and confirm one history entry and
  one final persistence schedule.
- Drag a tile on desktop and a smaller breakpoint; confirm one save and correct
  canonical/override ownership.
- Resize a tile continuously; confirm live feedback without per-frame saves and
  one final committed save.
- Toggle gravity and confirm compacted positions persist without component
  canonical writes.
- Rename the active grid and verify the canvas title and dashboard collection
  stay consistent.
- Change caption, border, link background, theme, background, OG image, and
  duplicatability.
- Complete media and document uploads; verify resolved URLs are persisted and
  document thumbnail generation waits for the required flush.
- Start a save on grid A, navigate to grid B, mutate grid B, and verify both
  snapshots write to their own grid IDs while grid A's result cannot alter grid
  B's persistence state.
- Trigger a persistence failure and verify it is visible for the matching
  active session.
- Undo/redo within one breakpoint and across breakpoints; confirm the existing
  500 ms minimum transition remains intact.

## Success Criteria

Step 4 is complete only when:

- Every live canonical grid change enters through a typed controller command.
- Production components/composables do not call `saveGrid()` or `updateGrid()`.
- Production components/composables do not directly mutate canonical grid,
  tile, or tile-content fields.
- `scheduleSave()` captures an immutable snapshot and schedules background
  persistence.
- `flushSaves()` confirms completion without creating an extra save.
- Persistence lanes are isolated by grid ID and session generation.
- One discrete user command schedules exactly once.
- One continuous edit/drag/resize gesture records one history entry and
  schedules one final save.
- No-op commands and no-op transaction commits schedule zero saves.
- Persistence failures are observable through active session state.
- Existing permission, history, analytics, upload, breakpoint, and facade
  contracts remain green.
- The compatibility facade remains thin and temporary.
- Full lint, test, type-check, build, and diff checks pass.

## Failure Conditions

Step 4 is not complete if:

- A component mutates canonical data before calling a command.
- A component or composable still decides when to call a persistence service.
- `saveGrid()` or `updateGrid()` remains a production escape hatch.
- A command schedules through another public command and can save twice.
- Continuous edits schedule on every intermediate patch.
- Persistence retains the reactive grid instead of an immutable snapshot.
- One global pending snapshot can mix work from different grids.
- An old session's write result changes the new session's status/error.
- `flushSaves()` schedules an unnecessary duplicate write.
- History policy is selected by component-provided flags.
- Step 5 upload generation/cancellation work or Step 6 demo isolation is
  partially introduced without completing its own contract.

## Step 4 Handoff

After Step 4:

- The mutation and persistence boundary is centralized and testable.
- The facade may still expose legacy aliases for compatibility, but production
  callers no longer use them.
- Upload progress and URL resolution flow through commands, but upload
  generations, cancellation, stale completion rejection, and exact object-URL
  ownership remain for Step 5.
- Demo rendering still uses the compatibility session path until Step 6.
- Read-only consumer migration and facade removal remain for Step 7.
