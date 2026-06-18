# Refactor Grid State with Focused Stores and a Command Controller

## Summary

Replace the 1,403-line `grid.ts` through a staged migration that preserves the current public API until all 46 direct consumers have moved.

The final architecture will:

- Use focused Pinia stores for state ownership.
- Route all cross-store operations through a stateless `GridController`.
- Preserve existing functionality and observable sequencing with characterization tests.
- Keep the existing 500 ms visual delay when history restoration switches breakpoints.
- Prevent components from directly mutating canonical grid data or requesting persistence.
- Remove the legacy `useGridStore()` facade after migration.

## Target Architecture and Interfaces

```text
Components and composables
          ↓
     GridController
     ├── gridSession
     ├── gridCollection
     ├── gridHistory
     ├── gridViewport
     ├── gridUploads
     ├── gridUi
     ├── analytics service
     └── grid persistence service
```

### State owners

- `gridCollection`:
  - Dashboard grid list, recent IDs, loading, and errors.
  - Collection fetch, create, duplicate, rename, and delete results.
- `gridSession`:
  - Canonical active `Grid`, ownership, source, load status, and persistence status.
  - Session identity/generation to reject stale loads, uploads, and commands.
- `gridHistory`:
  - `UndoRedoManager`, stack metadata, pending edit/move/resize transactions.
  - Stack mechanics only; it does not save, inspect components, or import other stores.
- `gridViewport`:
  - Active, viewport, and forced breakpoints.
  - Rendered positions, placement row, and view-only state.
  - No direct `window` or `document` access.
- `gridUploads`:
  - Upload progress, resolved URLs, document-item URLs, generations, and object-URL ownership.
- `gridUi`:
  - Active tile/panel, pending focus, and metadata preferences.

### `GridController`

Implement `GridController` as an application command/controller layer, not a state-owning Pinia store.

It will provide commands such as:

```ts
interface GridController {
  loadGrid(id: string): Promise<void>;
  clearSession(): Promise<void>;

  addTile(input: AddTileInput): string | null;
  duplicateTile(tileId: string): string | null;
  removeTile(tileId: string): void;
  resizeTile(tileId: string, size: TileSize): void;

  patchTileContent(
    tileId: string,
    patch: Partial<AnyTileContent>,
  ): void;
  patchDocumentItem(
    tileId: string,
    itemId: string,
    patch: Partial<DocumentItem>,
  ): void;
  updateCaption(tileId: string, caption: string): void;
  renameCurrentGrid(name: string): void;

  beginEdit(tileId: string): void;
  commitEdit(tileId: string): void;
  beginMove(): void;
  commitMove(): void;
  beginResize(): void;
  commitResize(): void;

  resolveUploadedUrl(input: ResolvedUpload): void;
  undo(): Promise<void>;
  redo(): Promise<void>;

  scheduleSave(): void;
  flushSaves(): Promise<void>;
}
```

For every mutation, the controller will enforce this sequence:

1. Validate session identity and edit permission.
2. Capture pre-mutation history when required.
3. Mutate the canonical grid once.
4. Update dependent state explicitly.
5. Record history.
6. Schedule persistence.
7. Emit analytics when applicable.

Stores must not mutually coordinate through watchers or circular imports. Cross-store changes go through the controller.

### Snapshot codec

Introduce a pure `GridSnapshotCodec` responsible for:

- Capturing all undoable grid fields.
- Applying snapshots to canonical state.
- Comparing snapshots.
- Replacing blob URLs in snapshots.
- Including `ogImageSrc`, tile content, overrides, theme, background, gravity, and breakpoint context.

`gridHistory` manages snapshots but does not understand their internal grid fields.

### Breakpoint transition contract

Preserve the existing user-visible delay when undo/redo restores a snapshot from another breakpoint.

- Define `BREAKPOINT_HISTORY_TRANSITION_MS = 500`.
- First switch the forced breakpoint.
- Keep that breakpoint visible for at least 500 ms.
- Also wait for the responsive layout to report readiness if it takes longer.
- Then apply the remainder of the snapshot and persist it.

Conceptually:

```ts
await Promise.all([
  viewport.waitForLayoutReady(targetBreakpoint),
  delay(BREAKPOINT_HISTORY_TRANSITION_MS),
]);

snapshotCodec.apply(snapshot);
```

The delay is intentional UX behavior, not an accidental rendering workaround. Use an injectable clock/delay dependency so tests do not wait in real time.

Direct user breakpoint controls retain their existing behavior unless characterization establishes that they currently use the same delay.

## Implementation Steps

### 1. Lock Down Existing Functionality

Before moving responsibilities, add characterization tests for:

- Every existing store action and getter.
- Tile addition, duplication, removal, resizing, captions, settings, and content patches.
- Edit, move, and resize history transactions.
- Undo/redo across the same and different breakpoints.
- The 500 ms cross-breakpoint history transition.
- Breakpoint override save/reset and rendered-position synchronization.
- Optimistic media and document uploads.
- Grid loading, route changes, collection CRUD, recent grids, and demo rendering.
- Persistence and analytics call counts and ordering.

Create a migration behavior matrix mapping every existing `grid.ts` property/action to its target store or controller command.

Success:

- All existing behavior is represented by tests or explicitly documented as a confirmed defect.
- Existing 615 tests remain green.

Failure:

- A legacy action is removed or changed without a mapped replacement and acceptance test.

### 2. Extract Pure Layout and Snapshot Logic

- Move packing, overlap, scaling, breakpoint-column mapping, and projection into pure utilities.
- Create the snapshot codec and test complete round trips.
- Move DOM measurement and resize observation into a responsive-layout composable.
- Represent rendered layouts as position-only `GridLayoutItem` objects.
- Resolve tile content from the canonical grid by tile ID.
- Remove field-specific content synchronization watchers and `skipOverrideRebuild`.

Success:

- Utilities have no Pinia or DOM dependency.
- Responsive copies cannot develop stale tile content.
- Snapshot round trips preserve every undoable property.

Failure:

- Detached layouts still contain independent content objects or snapshot coverage remains field-list dependent.

### 3. Introduce Focused Stores and the Controller Behind the Facade

- Create the focused stores with explicit reset methods.
- Create one controller instance per Pinia application context.
- Move orchestration from `grid.ts` into controller commands.
- Keep `useGridStore()` temporarily forwarding state and actions.
- Add facade compatibility tests proving forwarding behavior matches the old API.

Success:

- No history or transaction data remains module-global.
- Stores do not form circular dependencies.
- Changing sessions resets history, viewport, upload, menu, and focus state.

Failure:

- Components must coordinate multiple stores themselves or a store directly mutates another store.

### 4. Move Mutations and Persistence into Commands

Route all grid changes through typed controller commands:

- Grid settings and metadata.
- Tile structure, position, size, caption, border, and content.
- Breakpoint overrides.
- Continuous editor, drag, and resize transactions.
- Upload completion and cleanup.
- Undo and redo.

Replace ambiguous saving with:

- `scheduleSave()` for coalesced background persistence.
- `flushSaves()` when navigation, tests, or workflows require confirmed completion.

Scope pending saves by grid/session ID so writes from an old grid cannot affect a new session.

Success:

- Components never mutate canonical grid fields directly.
- Components do not call save/update service methods.
- One user command schedules persistence exactly once.
- Persistence errors are observable through session state.

Failure:

- Mutation, history, or save ordering still depends on individual component implementations.

### 5. Preserve History and Upload Coordination

For normal commands:

```text
capture before-state
→ mutate canonical grid
→ record history
→ schedule save
```

For continuous commands:

```text
begin transaction and capture once
→ accept intermediate mutations
→ compare at commit
→ record one history entry
→ schedule one final save
```

For upload completion:

```text
validate session/grid/tile/upload generation
→ record resolved URL in gridUploads
→ replace blob URL throughout gridHistory
→ update pending transaction snapshots
→ schedule persistable save
```

Correct confirmed defects while retaining unrelated behavior:

- Include `ogImageSrc` in undo/redo.
- Prevent stale upload callbacks from writing to removed tiles or old grids.
- Revoke object URLs exactly once.
- Keep unresolved `blob:` URLs out of persistence.
- Preserve resolved URLs through undo/redo.
- Cancel uploads when supported; otherwise abandon and ignore late completion safely.

Success:

- History never restores temporary URLs.
- Upload state cannot outlive its session.
- Every continuous gesture produces one history entry.

Failure:

- Stores communicate through implicit watchers or upload completion directly imports and modifies history.

### 6. Decouple Live and Demo Rendering

Introduce a `GridViewContext` accepted by the grid canvas:

- Live context reads canonical session state and controller commands.
- Demo context receives local read-only grid and breakpoint state.
- Marketing components no longer save and restore global `currentGrid`, ownership, or forced breakpoint values.

Success: mounting or unmounting the marketing demo cannot modify an active editing session.

Failure: demo rendering still depends on replacing global store state.

### 7. Migrate Consumers Incrementally

Migrate in this order:

1. Dashboard/auth/navigation → collection.
2. Grid route/app shell/title/analytics → session.
3. Canvas and breakpoint controls → viewport and layout context.
4. Undo controls and keyboard handling → controller/history.
5. Settings, toolbar, tile actions, and captions → controller/UI.
6. Upload composables → controller/uploads.
7. Tile-content components → view context and typed controller commands.

After each group:

- Run targeted tests.
- Verify facade compatibility.
- Search for direct canonical-grid assignments and direct save calls.

After the final group:

- Delete `grid.ts` and the compatibility facade.
- Add restricted-import linting for the deleted path.
- Expose active grid state as deeply readonly to components.

Success:

- Zero legacy-store imports.
- Zero component assignments to canonical grid state.
- Zero component persistence calls.

Failure:

- The facade becomes permanent or consumers require untyped escape hatches.

## Test and Acceptance Plan

Automated coverage must include:

- Every controller command’s permission, mutation, history, save, and analytics behavior.
- Exact call ordering for command orchestration.
- Transaction deduplication and no-op commits.
- Same-breakpoint and cross-breakpoint undo/redo.
- Fake-timer verification that snapshot application occurs no earlier than 500 ms after breakpoint switching.
- Layout-readiness verification when readiness takes longer than 500 ms.
- Blob replacement in undo, redo, and pending snapshots.
- Removed-tile, failed-upload, and old-session upload completion.
- Stale grid-load response rejection.
- Persistence queue isolation between grids.
- Demo/live context isolation.

Final verification:

- `npm --prefix apps/web run lint`
- `npm --prefix apps/web run test:run`
- `npm --prefix apps/web run type-check`
- `npm --prefix apps/web run build`
- `git diff --check`

Manual scenarios:

- Load and rapidly switch between grids.
- Add, edit, move, resize, duplicate, and delete tiles at all breakpoints.
- Undo/redo while remaining at one breakpoint and while crossing breakpoints.
- Confirm the 500 ms transition is visible and the final layout is correct.
- Exercise background, theme, gravity, color, caption, and OG-image history.
- Upload media/documents successfully, fail uploads, remove during upload, and navigate during upload.
- Mount and unmount the landing demo while a live grid session exists.

## Assumptions

- This remains a staged migration with a temporary facade.
- The 500 ms cross-breakpoint history delay is required product behavior.
- Proven defects are fixed; unrelated UX redesign remains out of scope.
- Persisted grid schemas remain backward compatible.
- Services continue to own DAO, serialization, cloning, and persistence mechanics.
- Pinia stores own state; `GridController` owns multi-store application workflows.
