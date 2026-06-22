# Store Refactor Step 3 Implementation Plan

## Purpose

Implement Step 3 from `notes/store-refactor-plan.md`:

- Introduce the focused Pinia stores.
- Introduce one `GridController` per Pinia application context.
- Move cross-store orchestration out of `apps/web/src/stores/grid.ts`.
- Keep `useGridStore()` as a temporary compatibility facade.
- Remove module-global history and transaction state.
- Make session changes reset history, viewport, upload, menu, and focus state.

This step changes internal ownership and dependency direction without migrating
the existing `useGridStore()` consumers. The behavior matrix remains the
compatibility contract.

## Step 3 Goals and Boundaries

The intended dependency direction is:

```text
Existing components and composables
                 |
                 v
       temporary useGridStore facade
                 |
                 v
           GridController
        /       |        \
focused stores services adjacent stores
```

Focused stores own state and local state transitions. `GridController` owns
workflows that touch more than one store, call services, apply permission
rules, coordinate history, or produce side effects. Focused stores must not
import or mutate each other.

Step 3 must preserve:

- The public state, getters, action names, argument shapes, return values, and
  async behavior documented in
  `notes/store-refactor-behavior-matrix.md`.
- The position-only rendered layout introduced in Step 2.
- `GridSnapshotCodec` as the only owner of snapshot field knowledge.
- The existing minimum 500 ms cross-breakpoint history transition.
- Lazy service lookup. The service factory is registered after static imports
  during application startup, so controller construction must not resolve
  services at module load.
- Existing direct facade writes until consumers are migrated. Current code
  assigns fields such as `pendingFocusTileId`, `currentGrid`, `isOwner`, and
  `isDemoGrid`, and also mutates nested canonical grid fields.

Approved compatibility deviation:

- The facade `isLoading` value uses aggregate loading semantics. Collection
  and active-grid loads are tracked independently, and the facade remains
  loading until every overlapping operation finishes.
- This intentionally replaces the legacy shared-field behavior, where the
  first completed overlapping operation could clear `isLoading` while another
  operation was still pending.
- `grid.facade.test.ts` and `gridFacadePolicy.test.ts` define the approved
  replacement contract.

Step 3 does not:

- Migrate components or composables away from `useGridStore()`.
- Remove the legacy facade.
- Make canonical grid state deeply readonly to components.
- Replace every legacy mutation with the final typed command API from Step 4.
- Introduce session-scoped persistence queues or `scheduleSave()` /
  `flushSaves()`.
- Add upload generations, cancellation, or complete object-URL ownership.
- Reject stale grid-load responses.
- Introduce the isolated demo `GridViewContext`.
- Change persisted grid schemas or move `GridLayoutItem` into contracts.

Step 3 does fix the reset defects required by its own exit criteria: changing
or clearing a session must clear upload state and all pending history
transactions.

## Current Baseline

The current `grid.ts` still owns:

- All collection, session, viewport, upload, UI, and preference state.
- A module-global `UndoRedoManager`.
- Module-global edit, move, resize, and stable snapshots.
- Collection and session service calls.
- Cross-store calls to theme and toast stores.
- History, mutation, persistence, upload, and analytics orchestration.

Step 2 has already established reusable boundaries:

- `apps/web/src/undo/GridSnapshotCodec.ts`
- `apps/web/src/undo/UndoRedoManager.ts`
- `apps/web/src/types/GridLayout.ts`
- `apps/web/src/utils/GridLayoutUtils.ts`
- `apps/web/src/composables/useResponsiveGridLayout.ts`
- Position-only rendering in `Grid.vue` and `Tile.vue`

There are still many direct production imports of `@/stores/grid`, so Step 3
must be completed behind the facade rather than through a consumer migration.

## Target Files and Responsibilities

### Focused stores

Add these stores under `apps/web/src/stores/grid/`:

| File | State and local behavior |
| --- | --- |
| `gridCollection.ts` | `grids`, collection loading/error state, `recentGridIds`, collection replacement/update helpers, and `reset()` |
| `gridSession.ts` | `currentGrid`, `isOwner`, `isDemoGrid`, session loading/error and persistence error state, `verticalCompact`, edit-permission inputs, and `reset()` |
| `gridHistory.ts` | Per-store `UndoRedoManager`, stack version/metadata, stable snapshot, pending edit/move/resize snapshots, editing tile ID, stack operations, URL replacement across all snapshots, and `reset()` |
| `gridViewport.ts` | `activeBreakpoint`, `viewportBreakpoint`, `forcedBreakpoint`, position-only `displayPositions`, breakpoint selectors, and `reset()` |
| `gridUploads.ts` | `uploadingTiles`, `resolvedUrls`, `resolvedDocumentItemUrls`, local map operations, and `reset()` |
| `gridUi.ts` | Active tile/panel, pending focus, metadata preferences, local menu/focus operations, and `reset()` |

The stores should expose narrow actions rather than allowing the controller to
replace entire Pinia state objects. Each store's `reset()` must restore the
same defaults used by a fresh store instance.

`gridHistory` must own all history and transaction data per Pinia instance.
Use a setup store with a non-deeply-reactive manager, such as a `shallowRef` or
`markRaw` instance, while keeping reactive stack metadata available to
consumers. No `UndoRedoManager`, snapshot, editing ID, or transaction variable
may remain at module scope.

### Controller

Add:

- `apps/web/src/controllers/GridController.ts`
- `apps/web/src/controllers/useGridController.ts`
- `apps/web/src/controllers/__tests__/GridController.test.ts`

`GridController` will receive the focused store instances and external
dependencies. Its dependency object should make service lookup, auth,
analytics, UUID generation, delay/timing, viewport-row measurement, and
layout readiness replaceable in tests.

Default dependencies must use lazy functions such as:

```ts
getGridService: () => getServiceFactory().getGridService()
```

They must not resolve the service factory when the controller module is
imported.

`useGridController(pinia?)` will return exactly one controller for a Pinia
instance. Use a `WeakMap<Pinia, GridController>` keyed by the explicit or
active Pinia instance. Creating a fresh Pinia in a test must produce fresh
stores, history, transactions, and controller state without requiring
`vi.resetModules()`.

The controller must receive the same Pinia instance when obtaining every
focused store and adjacent store:

```ts
useGridSessionStore(pinia)
useGridHistoryStore(pinia)
useThemeStore(pinia)
useToastStore(pinia)
```

This prevents commands from accidentally resolving stores from a different
active Pinia context.

### Compatibility facade

Refactor `apps/web/src/stores/grid.ts` into a setup-store facade.

The facade will:

- Expose writable computed proxies for every legacy state member.
- Expose computed proxies for every legacy getter.
- Forward every legacy action to a focused-store action or controller method.
- Preserve legacy method signatures, return values, promises, and error
  behavior.
- Provide an explicit `$reset()` implementation appropriate for a setup store.
- Contain no canonical state, history manager, transaction snapshots, service
  calls, analytics calls, or cross-store workflow logic of its own.

Writable proxies are required during the compatibility period. A getter-only
facade would break current assignments to `pendingFocusTileId`, demo session
state, test setup state, and similar fields.

Do not maintain a second synchronized copy of state inside the facade. Watchers
that mirror state between the facade and focused stores would create competing
owners and violate the Step 3 architecture.

## Ownership Mapping

The behavior matrix is the complete checklist. The high-level routing is:

| Legacy surface | Step 3 destination |
| --- | --- |
| Collection state, fetches, CRUD results, and recents | `gridCollection` state coordinated by `GridController` |
| Active grid, ownership, demo flag, load/save errors | `gridSession` state coordinated by `GridController` |
| Undo/redo stacks and pending transactions | `gridHistory`, orchestrated by `GridController` |
| Breakpoints and rendered positions | `gridViewport`; cross-history changes through `GridController` |
| Upload progress and resolved URL maps | `gridUploads`; history URL replacement through `GridController` |
| Menus, panels, focus, and metadata preferences | `gridUi`; browser preference access through an adapter/controller dependency |
| Tile/grid mutations, persistence, analytics, theme, and toast coordination | Legacy-compatible `GridController` methods |

Some actions appear local but are controller commands because they have hidden
cross-store effects:

- `setForcedBreakpoint()` also refreshes stable history.
- `setResolvedUrl()` and `setResolvedDocumentItemUrl()` also patch history and
  pending snapshots.
- `removeTile()` also changes upload, override, history, persistence, and
  analytics state.
- `loadGrid()` and `clearCurrentGrid()` reset multiple state owners.
- `deleteGrid()` may clear the active session.
- `applySnapshot()` coordinates viewport, history, session, theme, timing, and
  persistence.

## Implementation Sequence

### 1. Lock the Facade Contract Before Moving State

Create `apps/web/src/stores/__tests__/grid.facade.test.ts`.

Build a contract list directly from the behavior matrix and current store:

- Every legacy state member is present and writable where currently writable.
- All seven legacy getters retain their current values and reactivity.
- Every legacy action is callable with its existing signature.
- Async actions retain their promise and return-value behavior.
- Nested canonical mutations currently used by consumers remain observable.
- `storeToRefs()` and ordinary computed reads continue to react.

This test is structural compatibility coverage. Existing characterization
suites remain responsible for detailed behavior.

### 2. Add Focused Stores as State Owners

Introduce the six stores without changing `useGridStore()` yet.

For each store:

1. Move only its state defaults and local selectors.
2. Add narrow local mutation actions.
3. Add `reset()`.
4. Add a focused unit test for defaults, selectors, actions, and reset.
5. Verify it imports no other focused grid store.

Split the legacy shared `isLoading` and `error` fields internally:

- `gridCollection` owns collection loading and collection errors.
- `gridSession` owns active-grid loading, load errors, and persistence errors.
- The facade computes `isLoading` from both focused loading fields using the
  approved aggregate policy: it remains `true` while either owner is loading.
- The compatibility error channel preserves the characterized last-write
  sequencing for collection, session-load, and persistence failures.

The loading policy and error sequencing must be characterized before
extraction so simultaneous collection/session operations do not produce an
accidental UI change.

### 3. Move History and Transaction State First

Move the manager and all transaction variables into `gridHistory`.

The store should provide local operations for:

- Initializing or clearing the manager for a session.
- Capturing reactive stack metadata changes.
- Pushing, undoing, redoing, and navigating to a stack entry.
- Reading `canUndo`, `canRedo`, and labels.
- Beginning, reading, committing, and clearing edit/move/resize transaction
  snapshots.
- Reading and replacing the stable snapshot.
- Replacing blob URLs in undo, redo, stable, and pending snapshots.
- Resetting every history and transaction field.

The controller, not `gridHistory`, decides when to capture from `gridSession`,
when to apply a snapshot, and when to save.

Add an isolation test using two Pinia instances. History and pending
transactions created in one instance must be absent from the other. This is
the direct proof that the module-global defect is removed.

### 4. Create the Per-Pinia Controller

Construct the controller from explicit focused-store instances and dependency
ports. Keep the controller stateless with respect to domain state; its only
instance-level runtime concern may be replaceable adapters such as rendered
layout readiness.

Start with reset and session-boundary commands:

- `resetSessionDependents()`
- `loadGrid(id)`
- `loadDemoGrid(grid)`
- `clearSession()`
- Active-grid deletion cleanup

The reset sequence must explicitly cover:

```text
gridHistory.reset()
gridViewport.reset()
gridUploads.reset()
gridUi.resetSessionState()
gridSession.reset()
```

Metadata cookie preferences may survive session changes, but active menu,
panel, and pending focus state must not.

Reset dependent state before starting a replacement load so stale state is not
visible while the new request is pending. Preserve currently characterized
loading/error behavior. Stale-response rejection remains deferred unless it is
required to prevent the new ownership model from regressing current behavior.

### 5. Move Orchestration in Behavior-Matrix Slices

Move implementation from the legacy store to controller/store boundaries in
small slices. After each slice, remove the corresponding logic from
`grid.ts`, forward through the facade, and run its characterization suite.

Recommended order:

1. UI menus, focus, cookies, and permission selectors.
2. Viewport state and breakpoint selectors.
3. Collection fetch/create/duplicate/delete/rename and recents.
4. Session load, demo load, clear, and legacy save behavior.
5. History capture, transactions, undo, redo, and stack navigation.
6. Upload progress and resolved URL/history coordination.
7. Grid/tile mutation methods, theme/toast calls, analytics, and breakpoint
   override methods.

For Step 3, the controller may retain legacy-compatible methods such as
`saveGrid()` and `updateGrid()` so behavior remains stable behind the facade.
Step 4 will replace those ambiguous entry points with final typed commands and
explicit `scheduleSave()` / `flushSaves()` semantics.

Do not leave a legacy method half-owned by the facade and controller. Once a
slice moves, the facade method should contain only delegation.

### 6. Strengthen and Connect Layout Readiness

Before controller-managed `applySnapshot()`, `undo()`, or `redo()` relies on
Step 2's `waitForLayoutReady()`, strengthen that contract so it represents a
rendered target breakpoint rather than projection completion alone.

Update the responsive layout boundary so readiness resolves after:

1. The target breakpoint is selected.
2. Its position-only layout is projected.
3. Vue has committed the update.
4. The grid component has reported the corresponding rendered layout.

Expose this through a small runtime adapter registered with the controller by
`Grid.vue`. Registration must return a disposal function so an unmounted grid
cannot leave a stale readiness callback behind.

For cross-breakpoint history restoration, the controller must:

```text
set forced breakpoint
start minimum 500 ms delay
wait for rendered-layout readiness
apply snapshot only after both complete
persist and refresh stable history
```

Use an injected delay function and fake timers in tests. Direct user breakpoint
controls keep their existing timing.

### 7. Replace `grid.ts` with the Thin Facade

After all slices pass:

- Remove the Options-store state object from `grid.ts`.
- Remove all module-global history variables.
- Remove direct service, auth, analytics, UUID, theme, toast, snapshot codec,
  placement, and DOM-measurement imports that are no longer facade concerns.
- Return writable state proxies, getter proxies, and delegated actions from a
  setup store.

Keep the module path and `useGridStore` export unchanged. No production
consumer imports should change in Step 3.

Add a source-level architecture test or restricted import check asserting:

- Focused grid stores do not import each other.
- Focused stores do not import `GridController`.
- `GridController` may import focused stores and service interfaces.
- Components and composables still import only the compatibility facade during
  this step.

### 8. Validate Reset and Compatibility Behavior

Add controller/facade coverage for:

- Loading grid B after grid A clears A's history, viewport override, rendered
  positions, upload maps, menu, panel, and pending focus.
- `clearCurrentGrid()` clears pending edit, move, and resize transactions.
- `clearCurrentGrid()` clears all upload state.
- A fresh session has empty undo/redo stacks and no stable snapshot from the
  prior session.
- Metadata preference values survive session reset if that is the current
  intended preference scope.
- Two Pinia instances receive different controller and history instances.
- Repeated `useGridController()` calls for one Pinia return the same controller.
- Facade state reads and writes affect the focused owner immediately.
- Facade actions invoke one controller/store operation and preserve results.
- No focused store directly mutates another focused store.

## Test Plan

### New focused tests

Add:

- `apps/web/src/stores/grid/__tests__/gridCollection.test.ts`
- `apps/web/src/stores/grid/__tests__/gridSession.test.ts`
- `apps/web/src/stores/grid/__tests__/gridHistory.test.ts`
- `apps/web/src/stores/grid/__tests__/gridViewport.test.ts`
- `apps/web/src/stores/grid/__tests__/gridUploads.test.ts`
- `apps/web/src/stores/grid/__tests__/gridUi.test.ts`
- `apps/web/src/controllers/__tests__/GridController.test.ts`
- `apps/web/src/stores/__tests__/grid.facade.test.ts`

Prefer real focused stores with mocked controller dependencies. Do not mock the
focused stores in controller tests; the main risk is incorrect cross-store
sequencing and reset behavior.

### Existing characterization suites

Run the relevant suite after each migration slice:

| Slice | Existing regression suites |
| --- | --- |
| UI | `grid.ui.test.ts`, `useDragAndPaste.test.ts` |
| Collection | `grid.collection.test.ts` |
| Session | `grid.session.test.ts`, `GridPage.test.ts`, `LandingPageGridEmbed.test.ts` |
| History | `grid.history.test.ts`, `UndoRedoManager.test.ts`, `GridSnapshotCodec.test.ts`, `useUndoRedoKeys` coverage |
| Viewport | `grid.viewport.test.ts`, `Grid.test.ts`, `Tile.test.ts`, `useResponsiveGridLayout.test.ts` |
| Uploads | `grid.uploads.test.ts`, `useFileUpload.test.ts` |
| Mutations | `grid.tiles.test.ts`, `TileCaption.test.ts`, `useColorPicker.test.ts` |

Update the shared grid test harness so a fresh Pinia instance is sufficient for
isolation. It should no longer depend on resetting the `grid.ts` module to
clear history globals.

### Ordering assertions

Controller tests should assert observable ordering for the workflows moved in
this step:

- Session reset occurs before a replacement grid is installed.
- Snapshot capture occurs before mutation.
- History stack update occurs before persistence where currently required.
- Breakpoint switching occurs before the 500 ms/readiness wait.
- Snapshot application occurs after both wait conditions.
- Theme synchronization occurs after snapshot application when the theme
  changes.
- Upload URL resolution updates upload state and every history transaction
  snapshot before the next save.

Step 3 preserves currently characterized save counts. Step 4 is responsible for
normalizing all commands to exactly one scheduled persistence operation.

## Verification

Run targeted tests during each slice, followed by:

```sh
npm --prefix apps/web run lint
npm --prefix apps/web run test:run
npm --prefix apps/web run type-check
npm --prefix apps/web run build
git diff --check
```

Use the dependency-aware `type-check` script because it rebuilds workspace
dependencies before `vue-tsc`.

Also run:

```sh
rg -n "let (undoRedoManager|pendingDragSnapshot|pendingResizeSnapshot|lastStableSnapshot|pendingEditSnapshot|editingTileId)" apps/web/src
rg -n "from \"@/stores/grid/" apps/web/src/stores/grid
rg -l "from ['\"]@/stores/grid['\"]" apps/web/src
```

Expected results:

- No module-global history or transaction declarations.
- No focused-store-to-focused-store imports.
- Existing `@/stores/grid` consumer imports remain present until Step 7 of the
  overall refactor.

## Success Criteria

- Six focused stores own the state assigned by the behavior matrix.
- Every focused store has an explicit, tested reset method.
- One and only one controller exists per Pinia context.
- `grid.ts` is a forwarding facade rather than a state or orchestration owner.
- All legacy state, getters, and actions remain compatible.
- No history manager or transaction data is module-global.
- Focused stores do not import or mutate one another.
- Session replacement and clearing reset history, viewport, uploads, active
  menu/panel, and pending focus.
- Cross-breakpoint history still waits at least 500 ms and now also waits for
  rendered-layout readiness.
- The full existing characterization and application validation suites pass.

## Failure Conditions

- The facade stores a second copy of focused state or synchronizes copies with
  watchers.
- A focused store imports another focused store or calls its actions.
- Controller lookup can return a controller bound to a different Pinia.
- Fresh Pinia instances share history, transactions, or controller-owned
  runtime state.
- Current facade assignments become read-only before consumer migration.
- Session changes leave upload, menu, focus, viewport, or transaction state
  from the prior grid.
- Snapshot application uses projection-only readiness or removes the 500 ms
  minimum.
- Step 3 expands into consumer migration, demo isolation, upload generations,
  or persistence redesign.

## Handoff to Later Steps

After Step 3, the architecture supports later migration without another state
ownership change:

- Step 4 replaces legacy-compatible mutation/save methods with typed commands,
  `scheduleSave()`, `flushSaves()`, and session-scoped persistence.
- Step 5 adds upload generations, cancellation/abandonment, exact object-URL
  ownership, and final history/upload coordination.
- Step 6 introduces isolated live and demo `GridViewContext` instances.
- Step 7 migrates consumers off the facade, removes writable escape hatches,
  makes canonical state deeply readonly, and deletes `grid.ts`.
