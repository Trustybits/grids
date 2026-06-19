# Store Refactor Step 2 Implementation Plan

## Scope

Implement Step 2 from `notes/store-refactor-plan.md`:

- Extract pure grid layout and projection logic.
- Introduce a complete `GridSnapshotCodec`.
- Move DOM measurement and responsive observation into a composable.
- Represent rendered layouts as position-only objects.
- Resolve tile content from the canonical grid by tile ID.
- Remove field-specific content synchronization watchers and
  `skipOverrideRebuild`.

This step will preserve the public `useGridStore()` API. It will not introduce
the focused Pinia stores or `GridController`; those belong to later steps.

## Current Baseline

Step 1 is complete and provides characterization coverage for the behavior that
Step 2 will change internally.

The targeted baseline relevant to this step currently passes:

- `GridPlacementUtils.test.ts`
- `UndoRedoManager.test.ts`
- `grid.history.test.ts`
- `grid.viewport.test.ts`
- `Grid.test.ts`

Together these represent 123 passing tests across five test files.

## Implementation Plan

### 1. Extract the Pure Layout Model and Algorithms

Add `apps/web/src/types/GridLayout.ts`.

Define an app-local `GridLayoutItem` containing only:

```ts
interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
```

This type is a rendering concern and should not be added to the persisted
contracts package.

Add `apps/web/src/utils/GridLayoutUtils.ts` containing pure functions for:

- Rectangle overlap detection.
- Finding the first available layout position.
- Scaling an oversized tile position to fit a column count.
- Deterministic layout packing.
- Mapping breakpoints to column counts.
- Mapping column counts to breakpoints.
- Calculating the responsive column count from viewport dimensions.
- Projecting canonical tiles and breakpoint overrides into
  `GridLayoutItem[]`.
- Reconciling projected positions with the current rendered layout so
  unchanged layout item references are retained.

Add `apps/web/src/utils/__tests__/GridLayoutUtils.test.ts`.

Cover:

- Desktop projection.
- Out-of-bounds desktop repacking.
- Saved breakpoint overrides.
- Partially populated overrides.
- Automatic mobile and tablet projection.
- Oversized tile scaling.
- Stable ordering and collision handling.
- No mutation of canonical tiles or overrides.
- Position-only output with no tile content.
- Stable object identity when projected positions are unchanged.

`GridPlacementUtils.ts` will continue to own add/duplicate placement behavior.
Step 2 will not change those command semantics.

### 2. Introduce and Integrate `GridSnapshotCodec`

Add:

- `apps/web/src/undo/GridSnapshotCodec.ts`
- `apps/web/src/undo/__tests__/GridSnapshotCodec.test.ts`

The stateless codec will own:

- Deep snapshot capture.
- Applying undoable fields to a canonical grid.
- Comparing snapshot data while excluding action labels.
- Replacing optimistic media blob URLs.
- Replacing optimistic document-item blob URLs.
- Cloning snapshot data so canonical state and history never share mutable
  references.

Snapshot coverage will include:

- Tiles and tile content.
- Breakpoint overrides.
- Breakpoint context.
- Vertical compact/gravity state.
- Theme.
- Background image.
- Background embedding mode.
- Background color.
- `ogImageSrc`.

Modify:

- `apps/web/src/undo/UndoTypes.ts`
- `apps/web/src/undo/UndoRedoManager.ts`
- `apps/web/src/stores/grid.ts`

The legacy store methods will remain as compatibility wrappers, but delegate
snapshot capture, application, comparison, and URL replacement to the codec.

`UndoRedoManager` will continue to own stack mechanics only. It should not gain
knowledge of canonical grid fields.

Adding `ogImageSrc` to capture and application intentionally fixes the confirmed
OG-image history defect documented in the behavior matrix.

### 3. Add the Responsive Layout Composable

Add:

- `apps/web/src/composables/useResponsiveGridLayout.ts`
- `apps/web/src/composables/__tests__/useResponsiveGridLayout.test.ts`

The composable will own:

- Window-width tracking.
- Viewport and active breakpoint calculation.
- Responsive layout projection and reconciliation.
- Grid width and mobile scaling calculations.
- Grid wrapper and inner styles.
- Grid-height `ResizeObserver` setup and cleanup.
- Viewport-to-grid-row DOM measurement.
- A layout-ready revision or promise API for later controller integration.

The composable will accept refs and callbacks instead of importing Pinia:

```text
Grid.vue and store refs
          |
          v
useResponsiveGridLayout
          |
          v
pure GridLayoutUtils
```

The legacy `getViewportGridY()` action will temporarily delegate to a
DOM-measurement adapter exposed by this layout boundary. Existing
`addTile(content)` callers will remain unchanged.

The layout-ready API will be introduced without changing undo timing in Step 2.
Connecting that API to cross-breakpoint history orchestration belongs to the
controller stage.

### 4. Convert Rendering to Position-Only Layout Objects

Modify:

- `apps/web/src/components/grid/Grid.vue`
- `apps/web/src/components/grid/Tile.vue`

`Grid.vue` will pass two distinct values for each rendered tile:

- The canonical `Tile`, resolved by ID, for content, captions, borders, and
  commands.
- A `GridLayoutItem` for rendered `x`, `y`, `w`, and `h`.

`Tile.vue` will use the layout item for:

- `GridItem` position and dimensions.
- Responsive content dimensions.
- Position metadata.
- Drag and resize presentation.

It will continue using the canonical tile for content and persisted user data.

This separation will remove:

- Detached tile-content objects.
- The content-type synchronization watcher.
- The field-specific async-content synchronization watcher.
- `skipOverrideRebuild`.

Layout reconciliation will preserve mutable layout-item references during
equivalent override writes. This replaces the current one-shot suppression flag
without resetting the rendered layout after drag or resize completion.

### 5. Update Characterization and Regression Coverage

Modify:

- `apps/web/src/components/grid/__tests__/Grid.test.ts`
- `apps/web/src/stores/__tests__/grid.history.test.ts`
- `apps/web/src/stores/__tests__/grid.viewport.test.ts`
- `apps/web/src/stores/__tests__/grid.tiles.test.ts`
- `apps/web/src/undo/__tests__/UndoRedoManager.test.ts`

Verify:

- Rendered geometry is detached from canonical tile geometry.
- Rendered content always comes directly from the canonical tile.
- Async content changes require no synchronization watcher.
- Equivalent override persistence retains rendered layout identity.
- Desktop and non-desktop resize commits preserve current behavior.
- Snapshot round trips restore `ogImageSrc`.
- Resolved optimistic URLs remain present in history snapshots.
- The existing 500 ms breakpoint history transition remains unchanged.

## Verification

Run targeted tests during each extraction, followed by:

```sh
npm --prefix apps/web run lint
npm --prefix apps/web run test:run
npm --prefix apps/web run type-check
npm --prefix apps/web run build
git diff --check
```

Use the dependency-aware `type-check` script rather than relying only on
`type-check:only`.

Manual verification:

- Automatic desktop, tablet, and mobile layouts.
- Forced desktop, tablet, and mobile layouts.
- Saved, partial, and reset breakpoint overrides.
- Drag, resize, and gravity compaction.
- Async link, music, and YouTube content updates.
- Viewport-centered tile addition after scrolling.
- Same-breakpoint undo and redo.
- Cross-breakpoint undo and redo with the 500 ms transition.
- Custom OG-image undo and redo.

## Success Criteria

- Layout and projection utilities have no Pinia, Vue, browser, or DOM
  dependency.
- Responsive rendered layouts contain positions only.
- Canonical tile content is never copied into rendered layout state.
- Field-specific content synchronization watchers are removed.
- `skipOverrideRebuild` is removed.
- Snapshot round trips cover every undoable property, including `ogImageSrc`.
- Existing store and component APIs remain compatible.
- Existing characterized behavior remains green except for the explicitly
  corrected OG-image history defect.

## Failure Conditions

- Rendered layouts still contain independent tile content.
- Layout utilities import Vue, Pinia, stores, `window`, or `document`.
- Snapshot coverage remains duplicated as ad hoc field lists outside the
  codec.
- Drag or resize completion resets the rendered layout.
- The 500 ms breakpoint transition changes.
- Step 2 introduces focused stores, the controller, session generations,
  upload ownership, stale-load handling, or demo isolation ahead of their
  planned stages.

## Deferred Work

The following remain outside Step 2:

- Focused Pinia stores.
- `GridController`.
- Session-scoped persistence.
- Upload generations and object-URL ownership.
- Stale grid-load rejection.
- Demo/live view-context isolation.
- Wiring layout readiness into controller-managed undo and redo.
