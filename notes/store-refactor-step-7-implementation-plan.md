# Store Refactor Step 7 Implementation Plan

## Purpose

Implement only Step 7, **Migrate Consumers Incrementally**, from
`notes/store-refactor-plan.md`.

This is a plan only. Do not begin source implementation as part of this step.

Steps 1–6 are assumed complete:

- Focused stores own state; `GridController` owns cross-store workflows.
- Live mutations use typed controller commands with `scheduleSave()` /
  `flushSaves()` and session-scoped persistence.
- Upload/history coordination is hardened.
- The canvas subtree reads/dispatches through `GridViewContext`; the **live**
  context still delegates to the `useGridStore()` facade (Step 6).
- Demo-mounted canvas renderers must not resolve live store/auth/service
  dependencies at setup time. Step 6 made upload/input/profile renderer helpers
  lazy; preserve that isolation while removing the facade.

Step 7 retires the facade: it migrates every remaining consumer off
`@/stores/grid`, repoints the live context onto stores + typed commands directly,
deletes `grid.ts`, and locks the architecture with lint and readonly state.

## Goal

- Zero production imports of `@/stores/grid`.
- Zero component assignments to canonical grid state.
- Zero component persistence calls.

Failure: the facade becomes permanent or consumers require untyped escape
hatches.

## Migration Targets

The current `@/stores/grid` importers, grouped by the order in the master plan.
Confirm the live set with `rg -l "from ['\"]@/stores/grid['\"]" apps/web/src`
before starting; canvas-subtree files already moved to `GridViewContext` in
Step 6.

| Group | Destination | Files |
| --- | --- | --- |
| 1. Dashboard / auth / navigation | `gridCollection` (+ controller) | `pages/DashboardPage.vue`, `pages/AuthPage.vue`, `components/grid/LeftNavBar.vue`, `components/grid/UseTemplateButton.vue` |
| 2. Grid route / app shell / title / analytics | `gridSession` (+ controller) | `pages/GridPage.vue`, `App.vue`, `components/app/AppBar.vue`, `composables/useAnalytics.ts` |
| 3. Breakpoint controls | `gridViewport` / view context | `components/grid/ViewControls.vue`, `components/grid/ViewportWarning.vue` |
| 4. Undo controls / keyboard | controller / `gridHistory` | `components/grid/UndoRedoControls.vue`, `composables/useUndoRedoKeys.ts` |
| 5. Settings / toolbar / tile actions / captions | controller / `gridUi` | `components/grid/GridSettings.vue`, `components/grid/GridToolbar.vue`, `components/grid/GridStats.vue`, `components/grid/GridNameEditor.vue`, `components/modal/OgImageModal.vue`, `composables/useColorPicker.ts`, `composables/useTileInput.ts`, `composables/useTileLink.ts`, `composables/useTileContentWriter.ts`, `composables/useEditingLifecycle.ts`, `composables/useDragAndPaste.ts`, `types/TileToolbar.ts` |
| 6. Upload composables | controller / `gridUploads` | `composables/useFileUpload.ts` |
| 7. Live context internals + tile-content commands | stores + typed controller commands | `grid-view/createLiveGridViewContext.ts`; verify `components/tilecontent/*` |

`components/tilecontent/*`, `Tile.vue`, `TileCaption.vue`, `TileToolbar.vue`,
`TileActions.vue`, and `Grid.vue` already consume `GridViewContext`. They are
migrated in Step 7 only indirectly: by repointing the live context in Group 7.

## Migration Strategy

Each consumer currently reaches the same focused state through the facade.
Migration means importing the focused store(s) and/or `useGridController()`
directly and dropping `useGridStore()`.

- Reads: replace `gridStore.x` with `storeToRefs(useGridSessionStore()).x`
  (or the owning store), or a controller selector.
- Writes/commands: replace `gridStore.someAction(...)` with the typed controller
  command or focused-store action.
- Forbid direct canonical assignments (`gridStore.currentGrid = ...`,
  `gridStore.isOwner = ...`, `gridStore.pendingFocusTileId = ...`). Each becomes
  a store action or controller command. Audit these first — they are the
  writable escape hatches the facade currently permits.

Per the master plan, after **each** group:

- Run that group's targeted tests.
- Verify facade compatibility for not-yet-migrated consumers (the facade stays
  alive until the final group).
- Search for residual direct canonical-grid assignments and direct save calls.

## Implementation Slices

### 1. Pre-Migration Audit

- List every `@/stores/grid` importer and every direct canonical assignment:

  ```sh
  rg -l "from ['\"]@/stores/grid['\"]" apps/web/src
  rg -n "gridStore\.(currentGrid|isOwner|isDemoGrid|pendingFocusTileId)\s*=" apps/web/src
  rg -n "gridStore\.(saveGrid|updateGrid|scheduleSave|flushSaves)\(" apps/web/src
  ```

- For each importer, record which focused store(s) / controller commands it
  needs. This is the per-file migration checklist.

### 2. Group 1 — Dashboard / Auth / Navigation → Collection

- Repoint dashboard list, recents, and CRUD-trigger reads to
  `useGridCollectionStore()` + `useGridController()` (`fetchGrids`,
  `createGrid`, `duplicateGrid`, `deleteGrid`, `renameGrid`, `loadRecents`).
- Auth/nav reads (claimed slug gating, recents) move to the collection store.
- Run `grid.collection` characterization + `DashboardPage`/`AuthPage` suites.

### 3. Group 2 — Grid Route / App Shell / Title / Analytics → Session

- `GridPage.vue`: `loadGrid`, `clearSession`, `currentGrid`, `isOwner`,
  `isLoading`, `persistenceStatus` via session store + controller.
- `App.vue` / `AppBar.vue`: document title and shell reads from session store.
- `useAnalytics.ts`: route session reads from the session store; keep analytics
  emission in the controller where commands already emit it.
- Run `grid.session`, `GridPage`, and analytics suites.

### 4. Group 3 — Breakpoint Controls → Viewport / View Context

- `ViewControls.vue`: `forcedBreakpoint`, `activeBreakpoint`,
  `viewportBreakpoint`, `hasBreakpointOverride`, `setForcedBreakpoint`,
  `saveBreakpointPositions`, `resetBreakpoint` via `gridViewport` + controller.
  Prefer routing through `useGridViewContext()` where the control sits inside the
  canvas; otherwise call the controller directly.
- `ViewportWarning.vue`: viewport breakpoint reads from `gridViewport`.
- Run `grid.viewport`, `Grid`, and `useResponsiveGridLayout` suites.

### 5. Group 4 — Undo Controls / Keyboard → Controller / History

- `UndoRedoControls.vue`: `canUndo`, `canRedo`, `undoActionLabel`,
  `redoActionLabel`, `undoRedoStacks` from `gridHistory`; `undo`/`redo`/
  `undoRedoUntil` from the controller.
- `useUndoRedoKeys.ts`: keyboard handlers call controller `undo`/`redo`.
- Run `grid.history`, `UndoRedoManager`, and undo-keys suites.

### 6. Group 5 — Settings / Toolbar / Tile Actions / Captions → Controller / UI

- Grid-level settings/toolbar/stats/name editor and `OgImageModal` move grid and
  tile mutations to typed controller commands (theme, background, OG image,
  duplicatable, rename, color) and menu/focus reads to `gridUi`.
- Composables (`useColorPicker`, `useTileInput`, `useTileLink`,
  `useTileContentWriter`, `useEditingLifecycle`, `useDragAndPaste`) move to
  controller commands + focused-store reads. `types/TileToolbar.ts` updates its
  store-facing types.
- Replace remaining `pendingFocusTileId` assignments with `gridUi` actions or
  controller commands; do not keep writable focus refs as a component escape
  hatch.
- Tile actions/captions are already on the view context (Step 6); ensure their
  command members resolve to typed controller commands once Group 7 repoints the
  live context.
- Preserve Step 6 setup-time isolation: renderer-mounted composables may create
  inert command functions, but they must not resolve live store/auth/service
  dependencies until a user command actually runs.
- Run `grid.tiles`, `TileCaption`, `useColorPicker`, `useTileInput`,
  `useTileLink`, `useTileContentWriter`, `useEditingLifecycle`, and
  `useDragAndPaste` suites.

### 7. Group 6 — Upload Composables → Controller / Uploads

- `useFileUpload.ts`: read upload progress/resolved URLs from `gridUploads`;
  dispatch start/progress/resolve/fail/abandon/cancel through the controller.
- No component-level save calls; persistence stays inside controller commands.
- Preserve the Step 6 lazy boundary: constructing `useFileUpload()` in a
  demo-mounted renderer must not resolve auth, storage services, focused stores,
  or the controller. Only upload commands resolve upload collaborators.
- Run `useFileUpload` and `grid.uploads` suites.

### 8. Group 7 — Repoint the Live Context + Tile-Content Commands

- Rewrite `createLiveGridViewContext()` so each member resolves the focused
  stores (`storeToRefs`) and `useGridController()` directly instead of
  `useGridStore()`.
- This migrates the entire canvas subtree (`Grid.vue`, `Tile.vue`,
  `tilecontent/*`, captions, toolbars, actions) off the facade in one place,
  since they consume the context.
- Do not assume this covers support composables used by tile content. Confirm
  `useTileContentWriter`, `useTileLink`, `useEditingLifecycle`,
  `useTileInput`, and `useFileUpload` have already moved in Groups 5 and 6.
- Verify each `tilecontent/*` command path lands on a typed controller command
  (`patchTileContent`, `patchDocumentItem`, `resolveUploadedUrl`, …).
- Run the full canvas + tilecontent suites.

### 9. Delete the Facade and Lock the Architecture

After all groups pass and no production file imports `@/stores/grid`:

- Delete `apps/web/src/stores/grid.ts` and its facade-only tests
  (`grid.facade.test.ts`, `gridFacadePolicy` if no longer referenced — confirm
  first).
- Add a restricted-import lint rule (ESLint `no-restricted-imports`) forbidding
  `@/stores/grid` so the deleted path cannot be reintroduced.
- Expose active grid state to components as **deeply readonly**:
  - Return `readonly()` refs from `gridSession`/`gridViewport` selectors (or the
    live context) so components cannot assign canonical grid fields.
  - Remove the writable escape hatches that the facade exposed
    (`currentGrid`, `isOwner`, `isDemoGrid`, `pendingFocusTileId` setters become
    actions/commands only).
- Remove the now-unused `isDemoGrid` global flag if Step 6 left it only for
  compatibility and nothing reads it.
- Remove any unused parts of the GridController

### 10. Final Verification Pass

- Confirm zero legacy imports and zero direct canonical writes (see Verification).
- Run the full automated suite, type-check, lint, and build.

## Acceptance Criteria

- `rg -l "from ['\"]@/stores/grid['\"]" apps/web/src` returns no production files
  (test-only references, if any remain, are intentional and documented).
- No component assigns canonical grid state directly.
- No component calls a persistence/service save method directly.
- `grid.ts` and the compatibility facade are deleted.
- A lint rule blocks re-importing the deleted facade path.
- Active grid state is deeply readonly to components.
- The Step 6 demo-isolation regression still passes: mounting the marketing demo
  with representative real canvas renderers does not resolve live store, auth, or
  service dependencies during render.
- The full existing characterization and application suites pass unchanged.

## Verification

Run targeted tests during each group, then the full gate:

```sh
npm --prefix apps/web run lint
npm --prefix apps/web run test:run
npm --prefix apps/web run type-check
npm --prefix apps/web run build
git diff --check
```

Static guards:

```sh
# No production facade imports remain.
rg -l "from ['\"]@/stores/grid['\"]" apps/web/src

# No direct canonical-grid assignments survive.
rg -n "\.(currentGrid|isOwner|isDemoGrid|pendingFocusTileId)\s*=" apps/web/src/components apps/web/src/pages apps/web/src/composables

# No direct component save/service calls.
rg -n "\.(saveGrid|updateGrid|scheduleSave|flushSaves)\(" apps/web/src/components apps/web/src/pages
```

Expected: facade import search is empty for production code; assignment and save
searches return only store/controller internals.

Manual scenarios (master-plan parity):

- Load and rapidly switch between grids; confirm no stale state.
- Add, edit, move, resize, duplicate, delete tiles at all breakpoints.
- Undo/redo within and across breakpoints (500 ms transition intact).
- Exercise background, theme, gravity, color, caption, OG-image history.
- Upload media/documents; fail an upload; remove a tile mid-upload; navigate
  mid-upload.
- Mount/unmount the landing demo while a live session exists (Step 6 isolation
  still holds after the facade is gone).

## Failure Conditions

- Any production file still imports `@/stores/grid` after the final group.
- A component retains a writable canonical-grid escape hatch.
- A component calls persistence/service methods directly.
- The facade is kept "temporarily" rather than deleted.
- Readonly enforcement is skipped, leaving assignable canonical state.
