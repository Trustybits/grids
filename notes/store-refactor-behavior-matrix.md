# Grid Store Refactor Behavior Matrix

This matrix is the migration contract for `apps/web/src/stores/grid.ts`.
It records the observable legacy behavior that Step 1 characterizes before
responsibilities move to focused stores and `GridController`.

Status values:

- `covered` - protected by an automated characterization test.
- `covered elsewhere` - protected by an existing focused unit test.
- `confirmed defect` - current behavior is documented but must not become the
  desired contract.
- `approved behavior change` - intentionally differs from legacy behavior and
  is protected by tests for the replacement contract.
- `pending` - test still needs to be added during Step 1. No rows remain in
  this state.

## State and Getters

| Legacy member | Current behavior | Target owner | Characterization | Status |
| --- | --- | --- | --- | --- |
| `undoRedoVersion` | Invalidates history getters when history stacks change. | `gridHistory` | `grid.history.test.ts` | covered |
| `grids` | Holds dashboard grid collection. | `gridCollection` | `grid.collection.test.ts` | covered |
| `currentGrid` | Holds the canonical active or demo grid. | `gridSession` | `grid.session.test.ts` | covered |
| `isLoading` | Approved behavior change: collection and active-grid loading are tracked independently, and the compatibility facade remains loading until every overlapping operation finishes. The legacy shared flag could clear when the first operation finished. | Split between `gridCollection` and `gridSession`; combined by `gridFacadePolicy` | `grid.facade.test.ts`, `gridFacadePolicy.test.ts` | approved behavior change |
| `error` | Shared error string for collection, session, and persistence failures. | Split between `gridCollection` and `gridSession` | Collection/session suites | covered |
| `showMetaData` | Metadata display preference loaded from and persisted to a cookie. | `gridUi` | `grid.ui.test.ts` | covered |
| `showMetaDataVerbose` | Verbose metadata preference loaded from and persisted to a cookie. | `gridUi` | `grid.ui.test.ts` | covered |
| `isOwner` | Indicates whether the authenticated user owns the active grid. | `gridSession` | `grid.session.test.ts` | covered |
| `isDemoGrid` | Distinguishes an in-memory marketing grid from a persisted session. | `gridSession`; later replaced by `GridViewContext` | `grid.session.test.ts`, demo consumer test | covered |
| `recentGridIds` | Stores up to three most-recent grid IDs. | `gridCollection` | `grid.collection.test.ts` | covered |
| `activeTileId` | Identifies the tile with an active menu or panel. | `gridUi` | `grid.ui.test.ts` | covered |
| `activePanelId` | Identifies the active panel for `activeTileId`. | `gridUi` | `grid.ui.test.ts` | covered |
| `uploadingTiles` | Maps tile IDs to determinate or indeterminate upload progress. | `gridUploads` | `grid.uploads.test.ts` | covered |
| `resolvedUrls` | Maps optimistic media tile IDs to permanent URLs used during persistence. | `gridUploads` | `grid.uploads.test.ts` | covered |
| `resolvedDocumentItemUrls` | Maps document item IDs to permanent URLs used during persistence. | `gridUploads` | `grid.uploads.test.ts` | covered |
| `pendingFocusTileId` | Requests one-time editor focus for a tile. | `gridUi` | `useDragAndPaste.test.ts` | covered |
| `activeBreakpoint` | Stores the breakpoint currently rendered by the canvas. | `gridViewport` | `grid.viewport.test.ts` | covered |
| `viewportBreakpoint` | Stores the breakpoint naturally supported by viewport width. | `gridViewport` | `grid.viewport.test.ts` | covered |
| `forcedBreakpoint` | Overrides responsive breakpoint selection. | `gridViewport` | `grid.viewport.test.ts`, `grid.history.test.ts` | covered |
| `skipOverrideRebuild` | One-shot signal suppressing a `Grid.vue` layout rebuild after override capture. | Removed by position-only responsive layout | `Grid` consumer characterization | covered |
| `displayPositions` | Stores the latest rendered position-only layout. | `gridViewport` | `grid.viewport.test.ts`, `Grid` consumer characterization | covered |
| `verticalCompact` | Defaults to `true` without a grid; otherwise reflects active-grid gravity. | `gridSession` readonly selector | `grid.ui.test.ts` | covered |
| `canEdit` | Requires ownership and rejects forced breakpoints larger than the viewport breakpoint. | `GridController` permission policy / `gridSession` selector | `grid.ui.test.ts` | covered |
| `canUndo`, `canRedo` | Reflect history stack availability. | `gridHistory` | `grid.history.test.ts` | covered |
| `undoActionLabel`, `redoActionLabel` | Expose the next undo/redo labels. | `gridHistory` | `grid.history.test.ts` | covered |
| `undoRedoStacks` | Exposes stack metadata without snapshot bodies. | `gridHistory` | `grid.history.test.ts` | covered |

## UI and Preference Actions

| Legacy action | Observable behavior and side effects | Target | Characterization | Status |
| --- | --- | --- | --- | --- |
| `setMenuActive` | Opens one tile menu and closes any panel. | `gridUi` | `grid.ui.test.ts` | covered |
| `setPanelActive` | Opens a specific tile panel. | `gridUi` | `grid.ui.test.ts` | covered |
| `toggleMenuActive` | Opens, switches, or closes the active tile menu; closes panels first. | `gridUi` | `grid.ui.test.ts` | covered |
| `togglePanelActive` | Opens, switches, or closes a tile panel. | `gridUi` | `grid.ui.test.ts` | covered |
| `closeMenus` | Clears active tile and panel IDs. | `gridUi` | `grid.ui.test.ts` | covered |
| `checkShowMetaDataCookie` | Reads both metadata cookies into state. | `gridUi` preference adapter | `grid.ui.test.ts` | covered |
| `setShowMetaData` | Updates state and writes a one-year cookie. | `gridUi` preference adapter | `grid.ui.test.ts` | covered |
| `setShowMetaDataVerbose` | Updates state and writes a one-year cookie. | `gridUi` preference adapter | `grid.ui.test.ts` | covered |
| `getCookieValue` | Parses a named browser cookie or returns `null`. | Preference/browser utility | `grid.ui.test.ts` | covered |
| `setCookieValue` | Writes a path-wide cookie with an expiry. | Preference/browser utility | `grid.ui.test.ts` | covered |

## History Actions

| Legacy action | Observable behavior and side effects | Target | Characterization | Status |
| --- | --- | --- | --- | --- |
| `captureSnapshot` | Deep-copies undoable fields, substitutes resolved optimistic URLs, and records breakpoint context. | `GridSnapshotCodec.capture` | `grid.history.test.ts` | covered |
| `refreshStableSnapshot` | Replaces the module-global stable snapshot used by the next move/resize transaction. | `gridHistory` transaction state | `grid.history.test.ts` | covered |
| `pushUndoSnapshot` | Captures pre-mutation state, pushes it, and refreshes the stable snapshot. | `GridController` + `gridHistory` | `grid.history.test.ts` | covered |
| `undo` | Captures current state, pops undo history, then applies and persists the prior snapshot. | `GridController.undo` | `grid.history.test.ts` | covered |
| `redo` | Captures current state, pops redo history, then applies and persists the next snapshot. | `GridController.redo` | `grid.history.test.ts` | covered |
| `undoRedoUntil` | Replays undo or redo operations until a selected stack entry. | `GridController` + `gridHistory` | `grid.history.test.ts` | covered |
| `applySnapshot` | Optionally switches breakpoint, waits 500 ms, applies grid fields, synchronizes theme, saves, and refreshes history metadata. | `GridController` + codec + viewport | `grid.history.test.ts` | covered |
| `beginEditing` | Captures one edit transaction per active tile. | `GridController.beginEdit` + `gridHistory` | `grid.history.test.ts` | covered |
| `commitEditing` | Pushes one history entry only when snapshot data changed. | `GridController.commitEdit` + `gridHistory` | `grid.history.test.ts` | covered |
| `beginMove` | Captures the stable pre-drag snapshot once. | `GridController.beginMove` + `gridHistory` | `grid.history.test.ts` | covered |
| `commitMove` | Pushes one move snapshot and persists base or breakpoint positions. | `GridController.commitMove` | `grid.history.test.ts` | covered |
| `beginResize` | Captures the stable pre-resize snapshot once. | `GridController.beginResize` + `gridHistory` | `grid.history.test.ts` | covered |
| `commitResize` | Pushes one resize snapshot and persists base or breakpoint positions. | `GridController.commitResize` | `grid.history.test.ts` | covered |

## Upload Actions

| Legacy action | Observable behavior and side effects | Target | Characterization | Status |
| --- | --- | --- | --- | --- |
| `setTileUploading` | Sets upload progress by tile ID. | `gridUploads` | `grid.uploads.test.ts` | covered |
| `clearTileUploading` | Removes upload progress by tile ID. | `gridUploads` | `grid.uploads.test.ts` | covered |
| `setResolvedUrl` | Stores permanent media URL and patches all history/transaction snapshots. | `GridController.resolveUploadedUrl` + `gridUploads` + `gridHistory` | `grid.uploads.test.ts` | covered |
| `setResolvedDocumentItemUrl` | Stores permanent document URL and patches all history/transaction snapshots. | `GridController.resolveUploadedUrl` + `gridUploads` + `gridHistory` | `grid.uploads.test.ts` | covered |
| `getResolvedUrl` | Returns a permanent media URL by tile ID. | `gridUploads` selector | `grid.uploads.test.ts` | covered |
| `clearResolvedUrl` | Removes one resolved media URL. | `gridUploads` | `grid.uploads.test.ts` | covered |
| `clearResolvedDocumentItemsForTile` | Removes all resolved document URLs for a tile. | `gridUploads` | `grid.uploads.test.ts` | covered |

## Collection and Session Actions

| Legacy action | Observable behavior and side effects | Target | Characterization | Status |
| --- | --- | --- | --- | --- |
| `fetchGrids` | Requires authentication, replaces collection, loads recents, and exposes loading/error state. | `gridCollection.fetch` | `grid.collection.test.ts` | covered |
| `createGrid` | Requires authentication, supplies a default name, persists starter tiles, and appends the result. | `GridController` + `gridCollection` | `grid.collection.test.ts` | covered |
| `duplicateGrid` | Requires authentication, delegates clone depth, and appends the result. | `GridController` + `gridCollection` | `grid.collection.test.ts` | covered |
| `loadGrid` | Resets session/history, fetches a grid, derives ownership, records recency, touches last-opened time, and captures stable history state. | `GridController.loadGrid` + `gridSession` | `grid.session.test.ts` | covered |
| `loadDemoGrid` | Replaces active session with an in-memory, non-owner demo without persistence. | Demo `GridViewContext` | `grid.session.test.ts`, demo consumer test | covered |
| `recordRecent` | Deduplicates, prepends, limits to three, and starts an asynchronous save. | `gridCollection` | `grid.collection.test.ts` | covered |
| `loadRecents` | Loads authenticated user's recent IDs; logs and retains state on failure. | `gridCollection` | `grid.collection.test.ts` | covered |
| `saveRecents` | Persists authenticated user's current recent IDs; logs failures. | `gridCollection` | `grid.collection.test.ts` | covered |
| `saveGrid` | Requires an active editable grid and queues persistence with resolved URL maps. | `GridController.scheduleSave` | `grid.session.test.ts` | covered |
| `clearCurrentGrid` | Clears active session, viewport/UI state, and history. | `GridController.clearSession` coordinating all stores | `grid.session.test.ts` | covered |
| `deleteGrid` | Requires authenticated ownership, deletes remotely, removes collection entry, and clears matching active grid. | `GridController` + `gridCollection`/`gridSession` | `grid.collection.test.ts` | covered |
| `renameGrid` | Mutates collection name before persistence, mirrors to active grid, and rethrows failures. | `GridController.renameCurrentGrid` / collection command | `grid.collection.test.ts` | covered |

## Grid and Tile Mutation Actions

| Legacy action | Observable behavior and side effects | Target | Characterization | Status |
| --- | --- | --- | --- | --- |
| `toggleVerticalCompact` | Captures history, flips gravity, and saves. | `GridController` | `grid.tiles.test.ts` | covered |
| `setVerticalCompact` | Captures history, assigns gravity, and saves even if unchanged. | `GridController` | `grid.tiles.test.ts` | covered |
| `addTile` | Enforces registry limits, calculates viewport-aware placement, pushes collisions, creates a UUID tile, saves, and logs analytics except suggestions. | `GridController.addTile` | `grid.tiles.test.ts` | covered |
| `setTileContent` | Captures history, replaces content, applies profile sizing, and saves. | `GridController.patchTileContent` or typed replacement command | `grid.tiles.test.ts` | covered |
| `patchTileContent` | No-ops for missing/unchanged content, captures history outside edit transactions, shallow-merges, and saves. | `GridController.patchTileContent` | `grid.tiles.test.ts` | covered |
| `patchDocumentItem` | Replaces a matching document item, captures history outside edit transactions, and saves. | `GridController.patchDocumentItem` | `grid.tiles.test.ts` | covered |
| `setGridTheme` | Captures history, assigns theme, and saves. | `GridController` | `grid.tiles.test.ts` | covered |
| `setDuplicatable` | Assigns template permission and saves without history. | `GridController` | `grid.tiles.test.ts` | covered |
| `addBackgroundImage` | Captures history, sets URL/embed mode, and saves. | `GridController` | `grid.tiles.test.ts` | covered |
| `removeBackgroundImage` | Captures history, clears URL/embed mode, and saves. | `GridController` | `grid.tiles.test.ts` | covered |
| `setCustomOgImage` | Captures a labeled history entry, sets `ogImageSrc`, and saves. | `GridController` + snapshot codec | `grid.tiles.test.ts`; defect documented below | covered |
| `removeCustomOgImage` | Captures a labeled history entry, clears `ogImageSrc`, and saves. | `GridController` + snapshot codec | `grid.tiles.test.ts`; defect documented below | covered |
| `setBackgroundColor` | Captures history, assigns color, and saves. | `GridController` | `grid.tiles.test.ts` | covered |
| `removeBackgroundColor` | Captures history, clears color, and saves. | `GridController` | `grid.tiles.test.ts` | covered |
| `getViewportGridY` | Converts `.vue-grid-grid` position and viewport height to a non-negative grid row. | Responsive-layout composable | `grid.viewport.test.ts` | covered |
| `duplicateTile` | Deep-copies content, uses displayed breakpoint dimensions, places nearby, copies document URL maps and overrides, saves, and logs analytics. | `GridController.duplicateTile` | `grid.tiles.test.ts` | covered |
| `removeTile` | Captures history, revokes optimistic object URLs, removes upload/override state, removes tile, logs analytics, saves, and refreshes stable history. | `GridController.removeTile` coordinating session/uploads/history | `grid.tiles.test.ts`, `grid.uploads.test.ts` | covered |
| `resizeTile` | Updates base dimensions at `lg`; otherwise clamps and writes breakpoint-specific overrides, then saves. | `GridController.resizeTile` + `gridViewport` | `grid.tiles.test.ts`, `grid.viewport.test.ts` | covered |
| `toggleTileBorder` | Captures history, toggles border, and saves. | `GridController` | `grid.tiles.test.ts` | covered |
| `toggleLinkBackground` | Captures history, toggles link background, and saves only for link tiles. | `GridController` | `grid.tiles.test.ts` | covered |
| `updateGrid` | Requires edit permission, synchronizes rendered `lg` positions into canonical tiles, then saves. | Replaced by explicit controller commands | `grid.tiles.test.ts`, `grid.viewport.test.ts` | covered |
| Caption save in `TileCaption.vue` | Mutates the canonical tile and detached display copy directly, then calls `updateGrid`; abandons save if permission is lost. | `GridController.updateCaption` | `TileCaption.test.ts` | covered |

## Viewport and Breakpoint Actions

| Legacy action | Observable behavior and side effects | Target | Characterization | Status |
| --- | --- | --- | --- | --- |
| `setActiveBreakpoint` | Assigns rendered breakpoint. | `gridViewport` | `grid.viewport.test.ts` | covered |
| `setViewportBreakpoint` | Assigns naturally supported breakpoint. | `gridViewport` | `grid.viewport.test.ts` | covered |
| `setForcedBreakpoint` | Assigns forced breakpoint and refreshes stable snapshot. | `gridViewport` via controller | `grid.viewport.test.ts`, `grid.history.test.ts` | covered |
| `setDisplayPositions` | Replaces rendered position snapshot. | `gridViewport` | `grid.viewport.test.ts` | covered |
| `getBreakpointPositions` | Returns override positions for a breakpoint. | `gridViewport` selector | `grid.viewport.test.ts` | covered |
| `hasBreakpointOverride` | Reports whether a breakpoint override has at least one entry. | `gridViewport` selector | `grid.viewport.test.ts` | covered |
| `updateBreakpointOverride` | Captures all rendered positions at non-`lg`, sets rebuild suppression, and saves. | `GridController.commitMove/commitResize` + `gridViewport` | `grid.viewport.test.ts` | covered |
| `saveBreakpointPositions` | Replaces one non-`lg` override from provided rendered tiles and saves. | `GridController` + `gridViewport` | `grid.viewport.test.ts` | covered |
| `resetBreakpoint` | Captures history, removes one non-`lg` override, and saves. | `GridController` + `gridViewport` | `grid.viewport.test.ts` | covered |

## Existing Adjacent Coverage

| Unit | Existing coverage | Step 1 disposition |
| --- | --- | --- |
| `UndoRedoManager` | Stack push/pop, labels, deduplication, limits, multi-step navigation, and blob replacement. | Keep focused tests; store tests characterize orchestration only. |
| `GridService` | DAO-facing fetch/save/update/delete, cloning, recents, and queued persistence behavior. | Mock in store tests; do not duplicate service internals. |
| `useColorPicker` | Content patching and edit lifecycle behavior. | Retain; grid store tests cover the called action contract. |
| `useDragAndPaste` | Drag listener attachment and pasted smart-text focus requests. | Retain focused consumer coverage. |

## Step 1 Coverage Added

The characterization layer adds 120 tests across 13 files:

| Responsibility | Test file | Tests |
| --- | --- | ---: |
| UI state, cookies, and edit permissions | `apps/web/src/stores/__tests__/grid.ui.test.ts` | 16 |
| Collection CRUD and recents | `apps/web/src/stores/__tests__/grid.collection.test.ts` | 17 |
| Active session, demo load, and persistence gating | `apps/web/src/stores/__tests__/grid.session.test.ts` | 10 |
| Grid and tile mutations | `apps/web/src/stores/__tests__/grid.tiles.test.ts` | 19 |
| History and continuous transactions | `apps/web/src/stores/__tests__/grid.history.test.ts` | 15 |
| Viewport and breakpoint overrides | `apps/web/src/stores/__tests__/grid.viewport.test.ts` | 14 |
| Upload bookkeeping and snapshot URL replacement | `apps/web/src/stores/__tests__/grid.uploads.test.ts` | 6 |
| Optimistic media and document upload orchestration | `apps/web/src/composables/__tests__/useFileUpload.test.ts` | 9 |
| Rendered layout and detached content synchronization | `apps/web/src/components/grid/__tests__/Grid.test.ts` | 4 |
| Direct, slug, and overlapping route loads | `apps/web/src/pages/__tests__/GridPage.test.ts` | 4 |
| Demo mount/unmount session restoration | `apps/web/src/components/marketing/__tests__/LandingPageGridEmbed.test.ts` | 2 |
| Caption permission and persistence behavior | `apps/web/src/components/tile/__tests__/TileCaption.test.ts` | 3 |
| Pasted smart-text focus behavior | `apps/web/src/composables/__tests__/useDragAndPaste.test.ts` | 1 |

The shared harness is
`apps/web/src/stores/__tests__/gridTestHarness.ts`. It resets both Pinia and
the `grid.ts` module so module-global history transaction state cannot leak
between test cases. All external services, authentication, analytics, browser
APIs, placement utilities, UUID generation, neighboring stores, and the
history manager are controlled at the unit boundary.

## Confirmed Defects and Migration Requirements

These entries document current defects. Tests should prove the surrounding
behavior without asserting the defect as the desired result.

| Defect | Current evidence | Required replacement behavior |
| --- | --- | --- |
| OG image is not restorable through history. | `setCustomOgImage` and `removeCustomOgImage` push history, but `captureSnapshot` and `applySnapshot` omit `ogImageSrc`. | Snapshot codec includes and round-trips `ogImageSrc`. |
| Session clearing leaves upload state alive. | `clearCurrentGrid` does not clear `uploadingTiles`, `resolvedUrls`, or `resolvedDocumentItemUrls`. | Clearing/changing session resets all upload state. |
| Session clearing leaves pending drag/resize snapshots alive. | `clearCurrentGrid` resets edit state but not `pendingDragSnapshot` or `pendingResizeSnapshot`. | Clearing/changing session resets all transaction state. |
| Late upload callbacks are not session-scoped. | Upload completion mutates maps by tile ID without checking grid/session/upload generation. | Reject callbacks for removed tiles, replaced grids, or superseded uploads. |
| Store-level grid loads can resolve out of order. | `GridPage` ignores an obsolete caller result, but `loadGrid` itself can still assign a stale response. | `gridSession` generation rejects stale responses before state mutation. |
| Demo rendering replaces global live state. | `LandingPageGridEmbed` snapshots and restores `currentGrid`, ownership, and forced breakpoint manually. | Demo uses an isolated read-only `GridViewContext`. |
| Object URL ownership is ambiguous. | Upload failure and tile removal can both revoke previews, with no ownership/generation record. | `gridUploads` owns each URL and revokes it exactly once. |
| Breakpoint history delay lacks a layout-ready contract. | `applySnapshot` waits a fixed 500 ms after forcing a breakpoint. | Wait at least 500 ms and also await responsive-layout readiness. |

## Step 1 Exit Criteria

- Every matrix row is `covered`, `covered elsewhere`, or `confirmed defect`.
- The legacy 615-test baseline remains green.
- New tests verify observable state, calls, arguments, and ordering without
  changing production code.
- Confirmed defects remain documented for later implementation steps and are
  not silently encoded as desired behavior.
