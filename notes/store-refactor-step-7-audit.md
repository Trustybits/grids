# Store Refactor Step 7 — Pre-Migration Audit

Produced for Implementation Slice 1 of
`notes/store-refactor-step-7-implementation-plan.md`. This is the per-file
migration checklist that the subsequent group slices execute against.

Snapshot taken on branch `refactoring-the-stores`. Re-run the audit commands
before each group, since the live set changes as groups land.

## Audit Commands & Raw Results

```sh
rg -l "from ['\"]@/stores/grid['\"]" apps/web/src
rg -n "gridStore\.(currentGrid|isOwner|isDemoGrid|pendingFocusTileId)\s*=" apps/web/src
rg -n "gridStore\.(saveGrid|updateGrid|scheduleSave|flushSaves)\(" apps/web/src
```

### Importers (26 files)

24 production files + 2 test files import `@/stores/grid`:

- Production: `pages/DashboardPage.vue`, `pages/AuthPage.vue`, `pages/GridPage.vue`,
  `App.vue`, `components/app/AppBar.vue`, `components/grid/LeftNavBar.vue`,
  `components/grid/UseTemplateButton.vue`, `components/grid/ViewControls.vue`,
  `components/grid/ViewportWarning.vue`, `components/grid/UndoRedoControls.vue`,
  `components/grid/GridSettings.vue`, `components/grid/GridToolbar.vue`,
  `components/grid/GridStats.vue`, `components/grid/GridNameEditor.vue`,
  `components/modal/OgImageModal.vue`, `composables/useAnalytics.ts`,
  `composables/useColorPicker.ts`, `composables/useTileInput.ts`,
  `composables/useTileLink.ts`, `composables/useTileContentWriter.ts`,
  `composables/useEditingLifecycle.ts`, `composables/useDragAndPaste.ts`,
  `composables/useFileUpload.ts`, `composables/useUndoRedoKeys.ts`,
  `grid-view/createLiveGridViewContext.ts`.
- Test-only: `composables/__tests__/useColorPicker.test.ts` imports the facade;
  `composables/__tests__/useFileUpload.test.ts` `vi.mock`s `@/stores/grid`
  (no static import line, so it is not in the `rg -l` list but must migrate).

### Direct canonical assignments (escape hatches to remove first)

| Location | Statement | Owning store action |
| --- | --- | --- |
| `composables/useDragAndPaste.ts:123` | `gridStore.pendingFocusTileId = tileId` | `gridUi.setPendingFocusTileId(tileId)` |
| `components/grid/GridToolbar.vue:253` | `gridStore.pendingFocusTileId = tileId` | `gridUi.setPendingFocusTileId(tileId)` |
| `components/grid/GridToolbar.vue:261` | `gridStore.pendingFocusTileId = tileId` | `gridUi.setPendingFocusTileId(tileId)` |
| `composables/useEditingLifecycle.ts:66,68` | reads `pendingFocusTileId === tileId` then `= null` | `gridUi.consumePendingFocus(tileId)` (single atomic action) |
| `composables/__tests__/useColorPicker.test.ts:109,110,172` | `gridStore.isOwner = …`, `gridStore.currentGrid = …` | test setup → `session.setOwner(...)` / `session.setCurrentGrid(...)` |
| `composables/__tests__/useFileUpload.test.ts:130` | `gridStore.currentGrid = { id: "grid-1" }` | mock now targets focused stores (see Group 6) |

### Direct save calls

| Location | Statement | Replacement |
| --- | --- | --- |
| `composables/useFileUpload.ts:324` | `await gridStore.flushSaves()` | `await controller.flushSaves()` |

No `saveGrid` / `updateGrid` / `scheduleSave` direct component calls exist today.

## Facade Member → Destination Map

The facade (`stores/grid.ts`) is a thin re-export over focused stores + the
controller. Every member maps cleanly to a single owner:

| Facade member | Owner | How migrated consumers obtain it |
| --- | --- | --- |
| `currentGrid`, `isOwner`, `isDemoGrid`, `verticalCompact`, `sessionGeneration`, `persistenceStatus`, `persistenceError` | `gridSession` | `storeToRefs(useGridSessionStore())` (`verticalCompact` is a getter) |
| `grids`, `recentGridIds` | `gridCollection` | `storeToRefs(useGridCollectionStore())` |
| `error` | `gridCompatibility` | `storeToRefs(useGridCompatibilityStore()).error` |
| `activeBreakpoint`, `viewportBreakpoint`, `forcedBreakpoint`, `displayPositions` | `gridViewport` | `storeToRefs(useGridViewportStore())` |
| `showMetaData`, `showMetaDataVerbose`, `activeTileId`, `activePanelId`, `pendingFocusTileId` | `gridUi` | `storeToRefs(useGridUiStore())` (focus writes via actions) |
| `uploadingTiles`, `resolvedUrls`, `resolvedDocumentItemUrls` | `gridUploads` | `storeToRefs(useGridUploadsStore())` |
| `canUndo`, `canRedo`, `undoActionLabel`, `redoActionLabel`, `undoRedoStacks`, `undoRedoVersion` | `gridHistory` | `storeToRefs(useGridHistoryStore())` |
| `isLoading` | computed (`gridCollection.isLoading \|\| gridSession.isLoading`) via `selectGridFacadeLoading` | rebuild the OR-combined computed at the consumer, or read the single owning store's loading flag where only one applies |
| `canEdit` | computed via `controller.canEdit({ isOwner, forcedBreakpoint, viewportBreakpoint })` | **shared concern — see below** |
| All actions/commands (`addTile`, `patchTileContent`, `loadGrid`, `fetchGrids`, `setGridTheme`, `setForcedBreakpoint`, `undo`/`redo`, upload commands, `flushSaves`, …) | `useGridController()` | call the controller method directly |
| `hasBreakpointOverride(bp)`, `getBreakpointPositions(bp)` | controller (closes over `session.currentGrid`) | `controller.hasBreakpointOverride(session.currentGrid, bp)` |
| menu/panel/metadata helpers (`setMenuActive`, `toggleMenuActive`, `closeMenus`, `setShowMetaData`, `getCookieValue`, …) | controller (delegates to `gridUi`) | controller; UI-only toggles may call `gridUi` directly |

## Shared Concerns (resolve before/while migrating)

1. **`canEdit` reconstruction.** The facade computes `canEdit` once. Consumers
   that currently read `gridStore.canEdit` (`useColorPicker`, `useUndoRedoKeys`,
   `useDragAndPaste`, `useEditingLifecycle`, `GridNameEditor.vue`, `GridPage.vue`)
   need a replacement. Two acceptable sources:
   - Canvas-subtree consumers: `useGridViewContext().canEdit` (already exposes it).
   - Non-canvas consumers: a `computed(() => controller.canEdit({ isOwner:
     session.isOwner, forcedBreakpoint: viewport.forcedBreakpoint,
     viewportBreakpoint: viewport.viewportBreakpoint }))`. Consider a small shared
     selector/composable so this is not re-derived per file.

2. **`isLoading` semantics.** The facade ORs collection + session loading
   (`selectGridFacadeLoading`). `DashboardPage` cares about collection loading;
   `GridPage` keeps its own local `isLoading` ref (it does **not** read the facade
   flag — confirmed). Migrate each consumer to the store flag it actually needs;
   do not blindly import both unless the OR semantics are required.

3. **`error` channel.** Only `GridPage.vue:327` reads `gridStore.error`, which is
   the `gridCompatibility` store's `error`. The controller writes that channel at
   load boundaries. Repoint to `useGridCompatibilityStore()`; if Slice 9 removes
   the compatibility store, switch to `gridSession.loadError`.

4. **Demo isolation (Step 6).** Preserve setup-time laziness: composables mounted
   by demo renderers (`useFileUpload`, tile-input/profile helpers) must not resolve
   live stores/auth/services at construction — only when a command runs. Keep this
   invariant intact while swapping the facade for focused stores + controller.

5. **Test migration.** `useColorPicker.test.ts` and `useFileUpload.test.ts` reach
   into the facade for setup. They migrate alongside their source (Groups 5 / 6):
   set session state via `session.setOwner` / `session.setCurrentGrid`, and mock
   the controller + focused stores rather than `@/stores/grid`.

## Per-File Migration Checklist

Grouped by the master-plan order. "Reads" = `storeToRefs` selectors; "Commands"
= `useGridController()` calls; "Group" = which slice migrates it.

### Group 1 — Dashboard / Auth / Navigation → `gridCollection` (+ controller)

- **`pages/DashboardPage.vue`** — Reads: `grids`, `isLoading` (collection).
  Commands: `fetchGrids`, `createGrid`, `duplicateGrid`, `deleteGrid`,
  `renameGrid`.
- **`pages/AuthPage.vue`** — Reads: `grids`. Commands: `fetchGrids`, `createGrid`.
- **`components/grid/LeftNavBar.vue`** — Reads: `grids`, `currentGrid` (session).
  Commands: `fetchGrids`.
- **`components/grid/UseTemplateButton.vue`** — Reads: `currentGrid` (session).
  Commands: `duplicateGrid`.

### Group 2 — Grid Route / App Shell / Title / Analytics → `gridSession` (+ controller)

- **`pages/GridPage.vue`** — Reads: `currentGrid`, `isOwner` (session),
  `canEdit` (shared concern #1), `error` (compatibility, concern #3). Commands:
  `loadGrid`, `deleteGrid`, `clearCurrentGrid`→`clearSession`,
  `addBackgroundImage`. (Local `isLoading` ref stays local.)
- **`App.vue`** — Reads: `currentGrid`, `isDemoGrid` (session). Commands:
  `clearCurrentGrid`→`clearSession`.
- **`components/app/AppBar.vue`** — Reads: `currentGrid`, `isOwner` (session).
- **`composables/useAnalytics.ts`** — Reads: `currentGrid`, `isOwner` (session).
  Keep analytics emission in controller commands where it already lives.

### Group 3 — Breakpoint Controls → `gridViewport` / view context

- **`components/grid/ViewControls.vue`** — Reads: `forcedBreakpoint`,
  `viewportBreakpoint`, `activeBreakpoint` (viewport). Commands:
  `setForcedBreakpoint`, `hasBreakpointOverride` (pass `session.currentGrid`).
  Prefer `useGridViewContext()` if the control sits inside the canvas.
- **`components/grid/ViewportWarning.vue`** — Reads: `viewportBreakpoint`,
  `forcedBreakpoint` (viewport).

### Group 4 — Undo Controls / Keyboard → controller / `gridHistory`

- **`components/grid/UndoRedoControls.vue`** — Reads: `canUndo`, `canRedo`,
  `undoActionLabel`, `redoActionLabel`, `undoRedoStacks` (history). Commands:
  `undo`, `redo`, `undoRedoUntil`.
- **`composables/useUndoRedoKeys.ts`** — Reads: `canEdit` (concern #1). Commands:
  `undo`, `redo`.

### Group 5 — Settings / Toolbar / Tile Actions / Captions → controller / `gridUi`

- **`components/grid/GridSettings.vue`** — Reads: `currentGrid`, `isOwner`,
  `verticalCompact` (session); `activeBreakpoint`, `displayPositions` (viewport);
  `showMetaData`, `showMetaDataVerbose` (ui). Commands: `setGridTheme`,
  `setDuplicatable`, `addBackgroundImage`, `removeBackgroundImage`,
  `setBackgroundColor`, `removeBackgroundColor`, `setVerticalCompact`,
  `setShowMetaData`, `setShowMetaDataVerbose`, `saveBreakpointPositions`,
  `resetBreakpoint`, `hasBreakpointOverride`, `duplicateGrid`, `deleteGrid`.
- **`components/grid/GridToolbar.vue`** — Reads: `showMetaData` (ui). Commands:
  `addTile`, `setCookieValue`. **Escape hatch:** `pendingFocusTileId =` (×2) →
  `gridUi.setPendingFocusTileId`.
- **`components/grid/GridStats.vue`** — Reads: `currentGrid`, `isOwner` (session).
- **`components/grid/GridNameEditor.vue`** — Reads: `currentGrid`, `isOwner`
  (session), `canEdit` (concern #1). Commands: `renameCurrentGrid`.
- **`components/modal/OgImageModal.vue`** — Reads: `currentGrid` (session).
  Commands: `setCustomOgImage`, `removeCustomOgImage`.
- **`composables/useColorPicker.ts`** — Reads: `canEdit` (concern #1). Commands:
  `patchTileContent`. (+ test file migration.)
- **`composables/useTileInput.ts`** — Commands: `addTile`, `setTileContent`.
- **`composables/useTileLink.ts`** — Reads: `isOwner` (session). Commands:
  `patchTileContent`.
- **`composables/useTileContentWriter.ts`** — Commands: `patchTileContent`,
  `autosaveTileContent`.
- **`composables/useEditingLifecycle.ts`** — Reads: `canEdit` (concern #1).
  Commands: `beginEditing`, `commitEditing`. **Escape hatch:** read/clear
  `pendingFocusTileId` → `gridUi.consumePendingFocus(tileId)`.
- **`composables/useDragAndPaste.ts`** — Reads: `canEdit` (concern #1). Commands:
  `addTile`, `patchTileContent`. **Escape hatch:** `pendingFocusTileId =` →
  `gridUi.setPendingFocusTileId`.
- **`types/TileToolbar.ts`** — update store-facing types (referenced by toolbar
  consumers; confirm during Group 5).

### Group 6 — Upload Composables → controller / `gridUploads`

- **`composables/useFileUpload.ts`** — Reads: `currentGrid` (session, for grid id);
  upload progress / resolved urls from `gridUploads` where read. Commands:
  `startUpload`, `progressUpload`, `resolveUpload`, `failUpload`,
  `revokeOwnedObjectUrl`, `addTile`, `removeTile`, `setTileContent`,
  `patchDocumentItem`. **Save call:** `flushSaves()` → `controller.flushSaves()`.
  Preserve the Step 6 lazy boundary (no live resolution at construction).
  Migrate `useFileUpload.test.ts` mock from `@/stores/grid` to focused stores +
  controller.

### Group 7 — Live Context + Tile-Content Commands → stores + typed commands

- **`grid-view/createLiveGridViewContext.ts`** — Currently the single largest
  facade consumer (~42 members). Rewrite so each member resolves
  `storeToRefs(useGridSessionStore() / gridViewport / gridUi / gridUploads)` and
  `useGridController()` directly. This migrates the whole canvas subtree
  (`Grid.vue`, `Tile.vue`, `tilecontent/*`, captions, toolbars, actions) in one
  place, since they consume the context (already on `GridViewContext` from Step 6).
  - State members → focused stores: `grid`/`isOwner`/`verticalCompact`
    (session), `activeBreakpoint`/`viewportBreakpoint`/`forcedBreakpoint`/
    `displayPositions` (viewport), `showMetaData`/`showMetaDataVerbose`/
    `activeTileId`/`activePanelId`/`pendingFocusTileId` (ui),
    `uploadingTiles` (uploads), `isLoading` (concern #2), `canEdit` (concern #1).
  - Command members → controller: layout (`setActiveBreakpoint`,
    `setViewportBreakpoint`, `setForcedBreakpoint`, `setDisplayPositions`,
    `commitCompactedLayout`, `registerLayoutReadinessAdapter`), history
    (`beginMove`/`commitMove`/`beginResize`/`commitResize`/`beginEditing`/
    `commitEditing`), tile content (`setTileContent`, `patchTileContent`,
    `autosaveTileContent`, `patchDocumentItem`, `updateCaption`), tile ops
    (`removeTile`, `duplicateTile`, `resizeTile`, `toggleTileBorder`,
    `toggleLinkBackground`), menus (`setPanelActive`, `toggleMenuActive`,
    `togglePanelActive`, `closeMenus`), `getCookieValue`.
  - Verify each `tilecontent/*` command path lands on a typed controller command
    (`patchTileContent`, `patchDocumentItem`, `resolveUploadedUrl`, …). Confirm
    `useTileContentWriter`, `useTileLink`, `useEditingLifecycle`, `useTileInput`,
    `useFileUpload` already moved in Groups 5/6 (they are not covered by this
    repoint).
  - `createDemoGridViewContext.ts` does **not** import the facade — leave it; its
    lazy/inert command construction is the demo-isolation baseline to preserve.

## Slice 9 / 10 Follow-ups (recorded now, executed later)

- Delete `stores/grid.ts` and facade-only tests (`grid.facade.test.ts`;
  `gridFacadePolicy.ts` + `selectGridFacadeLoading` if nothing else references
  them — confirm first). `gridCompatibility` may also be removable if `error`
  migrates to `gridSession.loadError`.
- Add `no-restricted-imports` ESLint rule forbidding `@/stores/grid`.
- Make active grid state deeply `readonly()` from session/viewport selectors (or
  the live context) so components cannot reassign canonical fields.
- Remove writable escape hatches for `currentGrid`, `isOwner`, `isDemoGrid`,
  `pendingFocusTileId` (setters become actions/commands only).
- Drop the `isDemoGrid` global flag if nothing reads it after migration.

## Post-Group Verification (run after each group)

```sh
rg -l "from ['\"]@/stores/grid['\"]" apps/web/src           # shrinking importer set
rg -n "\.(currentGrid|isOwner|isDemoGrid|pendingFocusTileId)\s*=" \
  apps/web/src/components apps/web/src/pages apps/web/src/composables
rg -n "\.(saveGrid|updateGrid|scheduleSave|flushSaves)\(" \
  apps/web/src/components apps/web/src/pages
```

Plus the group's targeted test suites (see plan §§2–8). The facade stays alive
until Group 7 lands; verify not-yet-migrated consumers still compile against it
after each group.
